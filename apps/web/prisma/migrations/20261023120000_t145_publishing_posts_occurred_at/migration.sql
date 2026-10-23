-- T-145 — waktu bisnis History tersimpan di database supaya `listHistory`
-- bisa `ORDER BY occurred_at DESC` (dan kelak dipaginasi) tanpa sort di JS.
--
-- GENERATED ALWAYS ... STORED (bukan kolom biasa + backfill + trigger):
--   * nilai selalu konsisten dengan `status`/`failed_at`/`published_at`/
--     `updated_at` (retry Failed -> Published otomatis menghitung ulang);
--   * tidak ada langkah backfill terpisah dan tidak ada trigger;
--   * ekspresi hanya CASE/COALESCE atas timestamptz => IMMUTABLE, sah.
-- Semantik identik `historyItemOccurredAt` (group-history-items.ts):
--   Failed            -> failed_at    ?? updated_at
--   selain itu        -> published_at ?? updated_at
--
-- PERHATIAN: ADD COLUMN ... GENERATED STORED menulis ulang seluruh tabel dan
-- mengambil ACCESS EXCLUSIVE lock selama rewrite. Tabel publishing_posts
-- kecil (satu baris per post), jadi singkat; terapkan di luar jam sibuk.
ALTER TABLE "publishing_posts"
  ADD COLUMN "occurred_at" TIMESTAMPTZ(6)
  GENERATED ALWAYS AS (
    CASE
      WHEN "status" = 'failed' THEN COALESCE("failed_at", "updated_at")
      ELSE COALESCE("published_at", "updated_at")
    END
  ) STORED;

CREATE INDEX "publishing_posts_workspace_id_occurred_at_idx"
  ON "publishing_posts"("workspace_id", "occurred_at" DESC);
