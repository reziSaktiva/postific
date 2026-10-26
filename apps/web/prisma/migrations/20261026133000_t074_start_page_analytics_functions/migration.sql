-- T-074 — Analytics dasar Start Page lewat fungsi SECURITY DEFINER sempit
-- (pola ADR-141 / t070). Halaman publik dan route klik diakses TANPA session,
-- jadi tidak ada `app.current_user_id` untuk RLS `workspace_isolation`.
-- Hanya counter: tanpa PII, tanpa tabel event. `updated_at` sengaja TIDAK
-- disentuh (counter bukan perubahan konten). Tidak ada policy baru.
--
--  * start_page_record_view(p_slug): +1 view_count bila halaman published.
--    Mengembalikan boolean (ada/tidak baris terhitung); bukan void karena
--    $queryRaw Prisma tidak bisa men-deserialisasi tipe void.
--  * start_page_record_click_and_get_url(p_slug, p_link_id): atomik — hanya
--    tautan AKTIF milik halaman PUBLISHED dengan slug itu, url berskema
--    http(s) (defense-in-depth; aplikasi memvalidasi ulang dengan new URL()),
--    +1 click_count dan kembalikan url. Selain itu NULL tanpa efek.
--
-- Hak akses: REVOKE dari PUBLIC/anon/authenticated (cek pg_roles supaya tidak
-- gagal di shadow/local DB), GRANT EXECUTE hanya ke app_runtime.

CREATE FUNCTION "public"."start_page_record_view"(p_slug text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
  WITH bumped AS (
    UPDATE "start_page_pages"
       SET "view_count" = "view_count" + 1
     WHERE "slug" = p_slug
       AND "is_published" = true
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM bumped)
$$;

CREATE FUNCTION "public"."start_page_record_click_and_get_url"(p_slug text, p_link_id uuid)
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
  RETURNING l."url"
$$;

REVOKE ALL ON FUNCTION "public"."start_page_record_view"(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."start_page_record_click_and_get_url"(text, uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION "public"."start_page_record_view"(text) FROM "anon";
    REVOKE ALL ON FUNCTION "public"."start_page_record_click_and_get_url"(text, uuid) FROM "anon";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION "public"."start_page_record_view"(text) FROM "authenticated";
    REVOKE ALL ON FUNCTION "public"."start_page_record_click_and_get_url"(text, uuid) FROM "authenticated";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT EXECUTE ON FUNCTION "public"."start_page_record_view"(text) TO "app_runtime";
    GRANT EXECUTE ON FUNCTION "public"."start_page_record_click_and_get_url"(text, uuid) TO "app_runtime";
  END IF;
END
$$;
