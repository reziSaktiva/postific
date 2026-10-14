-- T-005.5 — fix REGRESSION found while browser-verifying the single-use
-- fix (20261014130000_t005_5_accept_invite_signal_single_use_ttl) end to
-- end: that migration made `databaseHooks.user.create.before` clear
-- `email_verified_at` to NULL the instant it consumed the signal. But
-- `WorkspaceService.acceptInvite` (`workspace.service.ts`) — which always
-- runs AFTER `signUp.email()`/`signIn.email()` succeed, via
-- `acceptInviteAction` — independently reads that SAME `email_verified_at`
-- column as its own proof that OTP was confirmed for this token. Once the
-- Better Auth hook cleared it first, `acceptInvite` wrongly concluded OTP
-- was never completed and rejected the legitimate golden path with
-- "Verifikasi email diperlukan sebelum bergabung ke workspace ini." — a
-- real regression, not a security fix refinement.
--
-- Fix: track the Better Auth hook's single-use consumption in a SEPARATE
-- column (`better_auth_email_verified_consumed_at`) instead of reusing
-- `email_verified_at`. `email_verified_at` goes back to being a permanent
-- record (set once by `markInvitationEmailVerified`, never cleared again)
-- — exactly its original T-110 behavior, undoing the previous migration's
-- change to wipe it. The NEW column is what
-- `consumeVerifiedPendingInvitationForEmail` actually reads/writes for
-- single-use gating (`IS NULL` in WHERE = not yet consumed; set to `now()`
-- on successful consume) — the TTL condition moves to comparing against
-- `email_verified_at` still (freshness of the ORIGINAL OTP confirm is what
-- matters for the abandoned-session window), while the single-use
-- uniqueness comes from this new column instead.
ALTER TABLE "workspace_invitations"
  ADD COLUMN "better_auth_email_verified_consumed_at" TIMESTAMPTZ(6);

DROP POLICY IF EXISTS "workspace_invitations_public_email_verified_consume" ON "workspace_invitations";
DROP POLICY IF EXISTS "workspace_invitations_public_email_pending_lookup" ON "workspace_invitations";

-- SELECT visibility (pre-image AND post-image of the UPDATE below both
-- satisfy this — only `better_auth_email_verified_consumed_at` changes,
-- `status` stays `pending` throughout) — same lesson as
-- 20260831042017_t093_invitation_select_visibility_fix /
-- 20261014140000_t005_5_accept_invite_consume_select_visibility_fix: an
-- UPDATE needs the row to pass an applicable SELECT (or ALL) policy, not
-- just its own UPDATE policy.
CREATE POLICY "workspace_invitations_public_email_pending_lookup"
  ON "workspace_invitations"
  FOR SELECT
  USING (
    "status" = 'pending'
    AND "email" = "public"."current_invite_lookup_email"()
  );

CREATE POLICY "workspace_invitations_public_email_verified_consume"
  ON "workspace_invitations"
  FOR UPDATE
  USING (
    "status" = 'pending'
    AND "expires_at" > now()
    AND "email_verified_at" IS NOT NULL
    AND "email_verified_at" > now() - interval '5 minutes'
    AND "better_auth_email_verified_consumed_at" IS NULL
    AND "email" = "public"."current_invite_lookup_email"()
  )
  WITH CHECK (true);
