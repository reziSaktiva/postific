-- T-005.5 (AS-D04) — mitigasi "accept-invite skip" yang disetujui King
-- Rezi: Better Auth `databaseHooks.user.create.before` (lib/better-auth/
-- auth.ts) butuh cara untuk tahu, SAAT user baru sedang dibuat lewat
-- `signUp.email()`, apakah email itu baru saja membuktikan kepemilikan
-- inbox lewat kode OTP accept-invite (T-110, kolom `email_verified_at` di
-- `workspace_invitations`) — supaya user itu bisa ditandai
-- `emailVerified: true` sekali di titik pembuatan, dan tidak kena gate
-- verifikasi native Better Auth (T-005.5) untuk kedua kalinya.
--
-- TIDAK memakai flag boolean dari body request client (`signUp.email()`)
-- sebagai sinyal — itu bisa dipalsukan oleh siapa pun yang memanggil
-- `/api/auth/sign-up/email` langsung (bypass UI/OTP sama sekali). Sinyalnya
-- HARUS berupa state yang sudah tervalidasi server-side SEBELUM titik ini:
-- ada baris `workspace_invitations` pending, belum expired, untuk email
-- yang sama, dengan `email_verified_at` sudah terisi (hanya mungkin terisi
-- lewat `WorkspaceService.confirmInviteEmailVerification` setelah kode OTP
-- benar — lihat workspace.service.ts).
--
-- `workspace_invitations` sudah RLS-protected (workspace-scoped). Hook ini
-- berjalan TANPA session/membership (user belum dibuat), persis situasi
-- yang sama dengan lookup token anonim T-093/T-110
-- (`current_invite_lookup_token()`, migrasi 20260831044328) — pola GUC yang
-- sama diulang di sini, scoped ke EMAIL alih-alih TOKEN, dan kondisi
-- pending/belum-expired/sudah-terverifikasi DIKUNCI DI DALAM POLICY itu
-- sendiri (bukan cuma di query aplikasi) supaya default-deny: GUC yang
-- tidak pernah di-set (raw SQL, tool lain, bug) tidak pernah meloloskan
-- baris apa pun, dan bahkan kalau caller lupa menambahkan WHERE
-- pending/belum-expired/verified di query-nya sendiri, RLS tetap menyaring.
CREATE OR REPLACE FUNCTION "public"."current_invite_lookup_email"()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_setting('app.invite_lookup_email', true)
$$;

CREATE POLICY "workspace_invitations_public_email_verified_lookup"
  ON "workspace_invitations"
  FOR SELECT
  USING (
    "status" = 'pending'
    AND "expires_at" > now()
    AND "email_verified_at" IS NOT NULL
    AND "email" = "public"."current_invite_lookup_email"()
  );
