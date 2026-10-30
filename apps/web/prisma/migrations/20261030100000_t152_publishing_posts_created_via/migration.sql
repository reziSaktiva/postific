-- T-152 (ADR-138 poin 6): penanda sumber pembuatan post di `publishing_posts`.
--
-- `created_via`: 'app' | 'mcp'. Default 'app' sehingga seluruh baris lama
-- (termasuk post hasil import, T-090) otomatis dianggap dibuat manusia di
-- aplikasi, tanpa backfill terpisah. ADD COLUMN ... NOT NULL DEFAULT konstan
-- tidak menulis ulang tabel di Postgres 11+ (metadata saja).
--
-- `created_via_client_id`: `clientId` OAuth klien AI (nilai yang sama dengan
-- `mcp_grants.client_id`). Tanpa FK: tabel `identity_oauth_client` milik
-- plugin dan tidak diubah bentuknya (T-149.1), sama seperti `mcp_grants`.
-- Nullable; wajib terisi bila dan hanya bila `created_via = 'mcp'`.
--
-- RLS: tidak ada perubahan. Policy `publishing_posts` yang ada berlaku untuk
-- seluruh kolom; kolom baru tidak membuka akses baru.

ALTER TABLE "publishing_posts" ADD COLUMN "created_via" TEXT NOT NULL DEFAULT 'app';

ALTER TABLE "publishing_posts" ADD COLUMN "created_via_client_id" TEXT;

-- Nilai ilegal tidak bisa disimpan lewat jalur apa pun (SQL manual, seed),
-- pola sama `identity_user_time_zone_source_check` (T-147). Satu constraint
-- untuk nilai dan pasangan klien-nya supaya baris 'mcp' tanpa klien (atau
-- baris 'app' dengan klien) mustahil ada.
ALTER TABLE "publishing_posts"
  ADD CONSTRAINT "publishing_posts_created_via_check"
  CHECK (
    ("created_via" = 'app' AND "created_via_client_id" IS NULL)
    OR ("created_via" = 'mcp' AND "created_via_client_id" IS NOT NULL)
  );
