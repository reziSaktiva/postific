-- T-005.5 — dua perbaikan review PR #168.
--
-- 1. Sinyal "OTP baru dikonfirmasi" tidak boleh cukup dengan mengetahui
--    email. Browser yang mengonfirmasi OTP menerima rahasia acak lewat
--    cookie httpOnly. Hash-nya disimpan di sini. Policy UPDATE hanya
--    mengizinkan consume kalau GUC `app.invite_email_proof_hash` sama
--    dengan hash itu, selain syarat single-use + TTL 5 menit yang sudah
--    ada. `WITH CHECK (true)` tetap diperlukan: baris sesudah UPDATE
--    mengosongkan hash dan mengisi `better_auth_email_verified_consumed_at`,
--    jadi ia tidak lagi lolos klausa USING-nya sendiri.
--
-- 2. Backfill `emailVerified` untuk akun yang sudah ada saat gate
--    verifikasi dinyalakan. Migrasi ini jalan sekali pada deploy. Akun
--    yang mendaftar setelahnya tetap `emailVerified = false` sampai
--    mereka mengklik tautan, atau sampai hook accept-invite menandai
--    mereka saat dibuat.

ALTER TABLE "workspace_invitations"
  ADD COLUMN "better_auth_email_proof_hash" TEXT;

DROP POLICY IF EXISTS "workspace_invitations_public_email_verified_consume" ON "workspace_invitations";

CREATE POLICY "workspace_invitations_public_email_verified_consume"
  ON "workspace_invitations"
  FOR UPDATE
  USING (
    "status" = 'pending'
    AND "expires_at" > now()
    AND "email_verified_at" IS NOT NULL
    AND "email_verified_at" > now() - interval '5 minutes'
    AND "better_auth_email_verified_consumed_at" IS NULL
    AND "better_auth_email_proof_hash" IS NOT NULL
    AND "better_auth_email_proof_hash" = current_setting('app.invite_email_proof_hash', true)
    AND "email" = "public"."current_invite_lookup_email"()
  )
  WITH CHECK (true);

UPDATE "identity_user"
SET "emailVerified" = true
WHERE "emailVerified" = false;
