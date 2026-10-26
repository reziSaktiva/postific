-- T-005.5 — SELECT-visibility gap in the UPDATE policy added by
-- 20261014130000_t005_5_accept_invite_signal_single_use_ttl. Found while
-- manually verifying the single-use fix actually works end-to-end
-- (simulating the exact replay/abandoned-session attack Ridwan described):
-- `WorkspaceRepository.consumeVerifiedPendingInvitationForEmail`'s UPDATE
-- always matched 0 rows, even for a row whose columns independently
-- satisfy every condition in the policy's own USING expression — so the
-- fix was accidentally ALSO blocking the legitimate path, not just the
-- attack.
--
-- Root cause: this project already hit and documented this exact class of
-- Postgres RLS gotcha once before, for a different table/policy
-- (20260831042017_t093_invitation_select_visibility_fix, worth reading for
-- the full repro) — an UPDATE needs the row to pass an applicable SELECT
-- (or ALL) policy, not just its own UPDATE policy's USING/WITH CHECK, both
-- for the pre-image (row being targeted) and the post-image (row being
-- written). The previous migration DROPPED the only SELECT policy that
-- covered this row (`workspace_invitations_public_email_verified_lookup`)
-- on the assumption it was no longer needed once lookups moved to a direct
-- UPDATE — that assumption was wrong; Postgres still needs SOME SELECT (or
-- ALL) policy to grant visibility, the UPDATE policy's `USING`/`WITH
-- CHECK` alone are not sufficient.
--
-- Fix: restore a SELECT policy scoped by the SAME `app.invite_lookup_email`
-- GUC, narrower than "any field freely", but broad enough to cover BOTH
-- the row's pre-image (status=pending, email_verified_at set) and its
-- post-image after this UPDATE clears `email_verified_at` to NULL
-- (status=pending, email_verified_at now NULL) — the TTL/verified
-- conditions are deliberately NOT repeated here (unlike the UPDATE
-- policy), since the post-image would otherwise never satisfy them and the
-- write would still be rejected. This does not reopen the vulnerability:
-- the actual state change (`emailVerified: true` on the new Better Auth
-- user) is still gated entirely by the UPDATE policy's full condition set
-- (single-use consume + 5-minute TTL) — this SELECT policy only grants
-- row visibility, mirroring exactly how
-- `workspace_invitations_public_pending_lookup` (token-scoped) already
-- grants visibility for its own single consumer
-- (`findInvitationByToken`) without further restriction.
CREATE POLICY "workspace_invitations_public_email_pending_lookup"
  ON "workspace_invitations"
  FOR SELECT
  USING (
    "status" = 'pending'
    AND "email" = "public"."current_invite_lookup_email"()
  );
