-- T-005.5 — fix CRITICAL finding (Ridwan Architecture Reviewer, confirmed
-- by King Rezi): the previous migration
-- (20261014120000_t005_5_accept_invite_prevverified_lookup) let
-- `databaseHooks.user.create.before` read `WorkspaceInvitation.
-- email_verified_at` as a durable, non-single-use, up-to-7-day-valid
-- signal. Concrete exploit: Alice opens `/invite/[token]`, requests +
-- correctly confirms the OTP code (`email_verified_at` gets set,
-- invitation stays `pending`), then her tab crashes/closes BEFORE
-- `signUp.email()` completes. Anyone who knows/guesses her email can call
-- `POST /api/auth/sign-up/email` directly (bypassing the UI and the OTP
-- entirely) at any point before the invitation's 7-day expiry, and the
-- hook would find that still-pending, still-verified row and mark THEIR
-- account `emailVerified: true` — full identity takeover of Alice's email,
-- the attacker never needed the OTP code at all. There was also a
-- narrower TOCTOU race even in the non-abandoned case: the previous
-- lookup was a plain SELECT, read separately from any write, so nothing
-- stopped the same signal being read (and trusted) more than once.
--
-- Fix (two independent layers, per Ridwan's recommendation):
-- 1. SINGLE-USE — the signal is now consumed ATOMICALLY in one UPDATE
--    statement (`SET email_verified_at = NULL ... RETURNING`), not a
--    separate SELECT-then-write. The invitation's `email_verified_at` is
--    irreversibly cleared the instant a signUp successfully reads it as
--    true, so a second signUp attempt for that email (replay, or two
--    concurrent requests racing the same row) can never reuse it — Postgres
--    row-level locking inside the single UPDATE makes this safe under
--    concurrency too (no separate check-then-act window to race).
-- 2. SHORT TTL — independent of the invitation's own 7-day
--    `expires_at`, the signal is only honored within
--    `ACCEPT_INVITE_VERIFIED_SIGNAL_TTL_MINUTES` (5 minutes, see
--    `workspace.service.ts`) of the OTP confirm succeeding. The real UI
--    flow (`AcceptInviteForm.tsx`) calls `signUp.email()` immediately
--    after `confirmAcceptInviteVerificationAction` resolves — on the order
--    of a couple of network round-trips, not minutes — so 5 minutes is
--    generous for the legitimate path but closes the "confirmed OTP, then
--    abandoned the tab for hours/days" window almost entirely, even before
--    layer 1 would otherwise still correctly prevent reuse.
--
-- Replaces the SELECT-only policy from the previous migration (that
-- policy only ever backed a read, which is no longer how this is queried —
-- the repository method now performs the atomic UPDATE directly) with an
-- UPDATE policy scoped by the SAME `app.invite_lookup_email` GUC
-- (`current_invite_lookup_email()`, unchanged) plus the TTL condition.
-- `WITH CHECK (true)` is required (not the default, which re-applies
-- `USING`) because the row produced by this UPDATE sets
-- `email_verified_at` to NULL, which would otherwise fail its own `USING`
-- clause (`email_verified_at IS NOT NULL`) the moment it's cleared.
DROP POLICY IF EXISTS "workspace_invitations_public_email_verified_lookup" ON "workspace_invitations";

CREATE POLICY "workspace_invitations_public_email_verified_consume"
  ON "workspace_invitations"
  FOR UPDATE
  USING (
    "status" = 'pending'
    AND "expires_at" > now()
    AND "email_verified_at" IS NOT NULL
    AND "email_verified_at" > now() - interval '5 minutes'
    AND "email" = "public"."current_invite_lookup_email"()
  )
  WITH CHECK (true);
