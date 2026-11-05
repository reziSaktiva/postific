-- T-201.2 — ganti indeks parsial 20261105100000.
--
-- Predikat `status <> 'imported'` ternyata tidak terpakai ketika Postgres
-- memakai rencana generik: Prisma mengirim status sebagai parameter ($2),
-- jadi predikat indeks tidak bisa dibuktikan oleh planner (EXPLAIN generik,
-- 2026-11-05). Predikat yang dipertahankan hanya `deleted_at IS NULL`
-- (literal di query). Filter status tetap disaring dari entri indeks.
DROP INDEX IF EXISTS "publishing_posts_workspace_id_created_at_latest_idx";
CREATE INDEX IF NOT EXISTS "publishing_posts_workspace_id_created_at_live_idx"
  ON "publishing_posts" ("workspace_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;
