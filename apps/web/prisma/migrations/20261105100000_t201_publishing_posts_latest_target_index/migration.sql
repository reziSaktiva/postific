-- T-201.2 — query "Terakhir dipakai" (`findLatestPostTargetAccountIds`).
--
-- Query-nya: post terbaru per `created_at` dalam satu workspace, tidak
-- soft-deleted, status bukan `imported`, punya target. Indeks yang ada
-- (`workspace_id`, `workspace_id+status`) hanya menyempitkan ke workspace,
-- lalu Postgres menyaring dan mengurutkan SEMUA post workspace (top-N sort),
-- jadi biayanya linear terhadap jumlah post, dan mayoritas barisnya adalah post
-- `imported` yang tidak pernah relevan bagi query ini (lihat EXPLAIN di tiket
-- T-201, 2026-11-05).
--
-- Indeks parsial ini (raw SQL, tidak representable di schema Prisma, sama
-- seperti `publishing_posts_outstand_post_id_unique`): predikatnya sama persis
-- dengan filter query, sehingga post `imported` dan soft-deleted tidak
-- ikut di indeks (tanpa biaya tulis untuk impor massal) dan `ORDER BY
-- created_at DESC LIMIT 1` bisa berhenti di entri pertama yang punya target.
-- Jaga predikat tetap sinkron dengan repository (ada tes penjaga).
CREATE INDEX IF NOT EXISTS "publishing_posts_workspace_id_created_at_latest_idx"
  ON "publishing_posts" ("workspace_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL AND "status" <> 'imported';
