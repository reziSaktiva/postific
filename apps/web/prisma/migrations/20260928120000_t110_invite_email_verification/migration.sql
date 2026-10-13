-- T-110 (KI-053) — verifikasi kepemilikan email accept-invite, HANYA jalur
-- `isExistingUser: false`. Gap: invite via Copy Link ke email A yang belum
-- pernah punya akun bisa dibuka & diisi oleh email B (email di form
-- read-only, tapi tidak pernah membuktikan B benar-benar memegang inbox A).
-- Mitigasi: kode OTP 6 digit dikirim ke email lewat Resend, wajib
-- dikonfirmasi SEBELUM `authClient.signUp.email` dipanggil di client
-- (lihat `AcceptInviteForm.tsx`) dan digerbangi ulang di server
-- (`WorkspaceService.acceptInvite`, guard tidak percaya klaim client).

-- ─────────────────────────────────────────────
-- 1. Kolom baru `workspace_invitations` — state verifikasi kode OTP.
--    Kode disimpan HANYA sebagai hash (sha256, lihat workspace.service.ts),
--    tidak pernah plaintext. `verification_attempts` reset ke 0 tiap kode
--    baru diminta, increment tiap kode salah (maks 5 percobaan, anti
--    brute-force untuk ruang 1 juta kombinasi 6 digit).
-- ─────────────────────────────────────────────

ALTER TABLE "workspace_invitations"
  ADD COLUMN "verification_code_hash" TEXT,
  ADD COLUMN "verification_code_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "verification_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(6);

-- ─────────────────────────────────────────────
-- 2. RLS UPDATE policy — invitee ANONIM (belum punya akun sama sekali,
--    `isExistingUser: false`, jadi TIDAK ADA `app.current_user_id` untuk
--    dipakai) menulis state verifikasi (request kode / confirm kode) HANYA
--    untuk baris `pending` yang token-nya PERSIS dia pegang.
--
--    Reuse GUC `app.invite_lookup_token` + `current_invite_lookup_token()`
--    yang sudah ada (migration 20260831044328_t093_code_review_rls_hardening,
--    dipakai `findInvitationByToken`) — sama persis trust model-nya (token
--    32-byte hex unguessable, setara password-reset token). Policy ini
--    SENGAJA tidak mengizinkan perubahan `status`/`email`/`role` (WITH
--    CHECK memaksa `status` tetap `pending`) — hanya kolom verifikasi yang
--    dibutuhkan alur ini yang boleh berubah lewat jalur token-anonim ini;
--    aplikasi (bukan RLS, RLS di sini cuma defense-in-depth) yang menjamin
--    query repository HANYA menulis kolom verifikasi (lihat
--    `setInvitationVerificationCode`/`markInvitationEmailVerified`/
--    `incrementInvitationVerificationAttempts` di
--    `lib/repositories/workspace/workspace.repository.ts`).
--
--    Visibilitas SELECT untuk NEW row hasil UPDATE ini sudah tercakup
--    policy existing `workspace_invitations_public_pending_lookup`
--    (status='pending' AND token=current_invite_lookup_token()) — tidak
--    perlu policy SELECT baru karena status tetap `pending` sepanjang
--    alur ini (baik gagal maupun sukses verifikasi kode).
-- ─────────────────────────────────────────────

CREATE POLICY "workspace_invitations_verify_by_token"
  ON "workspace_invitations"
  FOR UPDATE
  USING (
    "status" = 'pending'
    AND "token" = "public"."current_invite_lookup_token"()
  )
  WITH CHECK (
    "status" = 'pending'
    AND "token" = "public"."current_invite_lookup_token"()
  );
