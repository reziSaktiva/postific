-- T-148 (spike MCP): koreksi migrasi 20261026120000.
-- Role aplikasi `app_runtime` tidak bypass RLS (berbeda dari `postgres`), jadi
-- tabel yang RLS-nya aktif tanpa policy menolak semua tulis (kesalahan 42501
-- saat Better Auth menulis ke identity_jwks). Policy di bawah hanya untuk
-- `app_runtime`; `anon` dan `authenticated` tetap tertolak karena tabel ini
-- menyimpan token dan kunci privat JWKS. Dijaga IF EXISTS seperti migrasi
-- lain yang menyebut `app_runtime` (shadow DB tidak punya role itu).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE POLICY "identity_jwks_app_runtime" ON "identity_jwks"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
    CREATE POLICY "identity_oauth_client_app_runtime" ON "identity_oauth_client"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
    CREATE POLICY "identity_oauth_refresh_token_app_runtime" ON "identity_oauth_refresh_token"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
    CREATE POLICY "identity_oauth_access_token_app_runtime" ON "identity_oauth_access_token"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
    CREATE POLICY "identity_oauth_consent_app_runtime" ON "identity_oauth_consent"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
  END IF;
END
$$;
