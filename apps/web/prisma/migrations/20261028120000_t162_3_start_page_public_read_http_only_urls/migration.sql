-- T-162.3 — Fungsi baca publik Start Page menyaring skema url tautan
-- (QA M3; ADR-142 / ADR-143). Migrasi BARU: t070 tidak diubah.
--
-- Sebelumnya `start_page_get_public_by_slug` mengembalikan `link_url` apa
-- adanya; penyaringan skema hanya ada di aplikasi (`sanitizeLinkUrl` di
-- `domains/start-page/value-objects/safe-url.ts`) dan di fungsi klik
-- (`start_page_record_click_and_get_url`, t074). Kini fungsi baca ikut
-- menyaring sebagai defense-in-depth: hanya url `http://` / `https://`
-- (case-insensitive, pola yang sama dengan fungsi klik) yang dikembalikan.
--
-- Filter ada di klausa ON (bukan WHERE) supaya halaman published yang tautan
-- aktifnya semua tidak valid tetap menghasilkan satu baris dengan kolom
-- `link_*` NULL — perilaku yang sama dengan halaman tanpa tautan aktif;
-- slug tak ada/draft tetap nol baris. Signature, tipe kembalian, urutan
-- (`position` ASC, `id` ASC), dan hak akses tidak berubah: CREATE OR REPLACE
-- mempertahankan GRANT yang ada; REVOKE/GRANT diulang secara idempoten
-- (dicek lewat pg_roles agar tidak gagal di shadow/local DB).
--
-- Sinkron dengan aplikasi: nilai tersimpan selalu bentuk kanonik `URL#href`
-- (`sanitizeLinkUrl` saat tulis), jadi baris sah selalu lolos pola ini;
-- aplikasi tetap memvalidasi ulang dengan `new URL()` saat membaca.

CREATE OR REPLACE FUNCTION "public"."start_page_get_public_by_slug"(p_slug text)
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
   AND l."url" ~* '^https?://'
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
