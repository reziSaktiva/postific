-- T-167.4 — Fungsi klik dan baca publik Start Page ikut menolak url dengan
-- kredensial inline (`https://user:pw@host/`), selaras dengan
-- `sanitizeLinkUrl` (`domains/start-page/value-objects/safe-url.ts`).
-- Migrasi BARU: t074 dan t162_3 tidak diubah.
--
-- Sebelumnya `start_page_record_click_and_get_url` menaikkan `click_count`
-- lalu aplikasi menolak url itu (404), sehingga klik terhitung tanpa
-- redirect. Pola `~* '^https?://'` tidak mendeteksi userinfo. Kini url yang
-- memuat `@` pada bagian authority (sebelum `/`, `?`, atau `#` pertama)
-- tidak lolos di kedua fungsi, jadi tidak terhitung dan tidak ditampilkan.
-- Hanya mungkin untuk baris manual/lama: nilai yang ditulis lewat aplikasi
-- selalu bentuk kanonik tanpa userinfo.
--
-- Signature, tipe kembalian, dan hak akses tidak berubah: CREATE OR REPLACE
-- mempertahankan GRANT yang ada.

CREATE OR REPLACE FUNCTION "public"."start_page_record_click_and_get_url"(p_slug text, p_link_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
  UPDATE "start_page_links" l
     SET "click_count" = l."click_count" + 1
    FROM "start_page_pages" sp
   WHERE l."id" = p_link_id
     AND l."start_page_id" = sp."id"
     AND sp."slug" = p_slug
     AND sp."is_published" = true
     AND l."is_active" = true
     AND l."url" ~* '^https?://'
     AND l."url" !~* '^https?://[^/?#]*@'
  RETURNING l."url"
$$;

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
   AND l."url" !~* '^https?://[^/?#]*@'
  WHERE sp."slug" = p_slug
    AND sp."is_published" = true
  ORDER BY l."position" ASC, l."id" ASC
$$;
