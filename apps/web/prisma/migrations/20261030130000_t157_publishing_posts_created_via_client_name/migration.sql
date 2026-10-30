-- T-157: nama klien AI dibekukan saat post dibuat lewat MCP.
--
-- `created_via_client_name`: salinan `mcp_grants.client_name` (sudah
-- dirapikan, maks 64 karakter) pada saat `create_draft`. Nama klien berasal
-- dari registrasi OAuth dinamis (tidak tepercaya) dan bisa berubah/dicabut
-- setelahnya; badge sumber di History/Drafts/Queue memakai nilai beku ini,
-- lalu fallback ke lookup `mcp_grants` untuk post lama atau kolom null.
-- Nullable tanpa default: baris lama tetap NULL (tanpa backfill, metadata
-- saja di Postgres). Tidak ada CHECK baru; constraint
-- `publishing_posts_created_via_check` (T-152) tidak berubah.
--
-- RLS: tidak ada perubahan. Policy `publishing_posts` yang ada berlaku untuk
-- seluruh kolom; kolom baru tidak membuka akses baru.

ALTER TABLE "publishing_posts" ADD COLUMN "created_via_client_name" TEXT;
