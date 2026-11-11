-- T-231 (ADR-158) / JOB-10 — daftar path thumbnail posting impor yang MASIH
-- dirujuk `publishing_post_targets.thumbnail_storage_path`, untuk job sapu
-- berkas yatim di bucket `media`. Job runner tidak punya sesi Better Auth dan
-- `publishing_post_targets` ber-RLS, jadi query biasa tanpa
-- `app.current_user_id` mengembalikan nol baris di role `app_runtime`
-- (berkas yang masih dipakai akan dikira yatim dan terhapus). Pola sama
-- `import_list_accounts_for_periodic_sync` (T-115).
--
-- Hanya mengembalikan path yang diminta (bukan seluruh tabel) dan hanya kolom
-- `thumbnail_storage_path`; tidak ada data pengguna lain yang terbuka.

CREATE FUNCTION "public"."import_thumbnail_referenced_paths"(paths text[])
RETURNS TABLE (storage_path text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT t."thumbnail_storage_path" AS storage_path
  FROM "publishing_post_targets" t
  WHERE t."thumbnail_storage_path" = ANY(paths)
$$;

REVOKE ALL ON FUNCTION "public"."import_thumbnail_referenced_paths"(text[]) FROM PUBLIC;

-- Grant default Supabase ke `anon` dan `authenticated` tidak tercabut oleh
-- REVOKE FROM PUBLIC (pola T-070/T-074, review Ridwan H1). Dicek lewat
-- pg_roles agar tidak gagal di shadow/local DB.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION "public"."import_thumbnail_referenced_paths"(text[]) FROM "anon";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION "public"."import_thumbnail_referenced_paths"(text[]) FROM "authenticated";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT EXECUTE ON FUNCTION "public"."import_thumbnail_referenced_paths"(text[]) TO "app_runtime";
  END IF;
END
$$;
