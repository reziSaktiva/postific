-- T-070.5 — Akses baca publik Start Page lewat fungsi SECURITY DEFINER sempit
-- (ADR-128, AU-D06). Mengikuti preseden t026/t048/t115.
--
-- Halaman publik `/u/[slug]` diakses TANPA session, jadi tidak ada
-- `app.current_user_id` untuk `withCurrentUser`. Policy `*_workspace_isolation`
-- (T-017.2) mensyaratkan membership aktif, sehingga query biasa di role
-- `app_runtime` (non-BYPASSRLS, KI-026) mendapat NOL row.
--
-- Revisi atas review arsitektur (versi awal migrasi ini memakai policy RLS
-- SELECT publik di dua tabel):
--   - F1 (HIGH): policy RLS tidak membatasi kolom. Policy untuk `anon`
--     (PostgREST/anon key) membuka `workspace_id`, `view_count`, `click_count`
--     dst. ke siapa pun yang memegang anon key. Fungsi di bawah hanya
--     mengembalikan kolom aman anonim, dan TIDAK ada GRANT ke `anon`.
--   - F2 (MEDIUM): policy tambahan di tabel memperluas permukaan akses
--     `app_runtime` ke seluruh baris published untuk query apa pun, bukan
--     hanya lookup slug. Kini tidak ada policy baru di tabel; policy
--     `workspace_isolation` tidak disentuh.
--
-- Fungsi: lookup EXACT per slug, hanya halaman `is_published = true`,
-- tautan `is_active = true` terurut `position` ASC. Hasil flat: satu baris
-- per tautan aktif (kolom halaman berulang); halaman tanpa tautan aktif
-- menghasilkan satu baris dengan kolom `link_*` NULL; slug tak ada/draft
-- menghasilkan nol baris. SECURITY DEFINER + `SET search_path = public`;
-- EXECUTE dicabut dari PUBLIC, `anon`, dan `authenticated` (grant default
-- Supabase tidak tercabut oleh REVOKE FROM PUBLIC; review F4) dan hanya
-- diberikan ke `app_runtime` (semua dicek lewat pg_roles agar tidak gagal
-- di shadow/local DB). RLS/fungsi ini hanya
-- defense-in-depth; primary check tetap di aplikasi.

CREATE FUNCTION "public"."start_page_get_public_by_slug"(p_slug text)
RETURNS TABLE (
  slug text,
  title text,
  bio text,
  avatar_url text,
  theme text,
  link_id uuid,
  link_label text,
  link_url text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    sp."slug" AS slug,
    sp."title" AS title,
    sp."bio" AS bio,
    sp."avatar_url" AS avatar_url,
    sp."theme" AS theme,
    l."id" AS link_id,
    l."label" AS link_label,
    l."url" AS link_url
  FROM "start_page_pages" sp
  LEFT JOIN "start_page_links" l
    ON l."start_page_id" = sp."id"
   AND l."is_active" = true
  WHERE sp."slug" = p_slug
    AND sp."is_published" = true
  ORDER BY l."position" ASC, l."id" ASC
$$;

REVOKE ALL ON FUNCTION "public"."start_page_get_public_by_slug"(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION "public"."start_page_get_public_by_slug"(text) FROM "anon";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION "public"."start_page_get_public_by_slug"(text) FROM "authenticated";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT EXECUTE ON FUNCTION "public"."start_page_get_public_by_slug"(text) TO "app_runtime";
  END IF;
END
$$;
