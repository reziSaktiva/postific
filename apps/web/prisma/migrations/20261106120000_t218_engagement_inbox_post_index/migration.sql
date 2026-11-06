-- T-218.8 — indeks untuk Engage per posting (ADR-157, S-006).
--
-- Query baru: (a) agregasi `GROUP BY post_id, connected_account_id, platform,
-- status` dengan filter `workspace_id` + `received_at >= since`, dan (b) daftar
-- komentar satu posting (`workspace_id` + `post_id`, urut `received_at DESC`).
-- Indeks yang ada (`workspace_id`, `workspace_id+status`) hanya menyempitkan ke
-- workspace; mengelompokkan per posting dan mengurutkan komentar satu posting
-- tetap memindai seluruh komentar workspace. Indeks komposit ini melayani
-- keduanya (kolom pertama sama dengan `workspace_id` sehingga dipakai juga
-- untuk filter rentang tanggal lewat indeks-scan terurut per posting).
-- `post_id` boleh NULL (kelompok "Tanpa posting"): NULL ikut terindeks di
-- Postgres, jadi `post_id IS NULL` juga terlayani.
CREATE INDEX IF NOT EXISTS "engagement_inbox_items_workspace_id_post_id_received_at_idx"
  ON "engagement_inbox_items" ("workspace_id", "post_id", "received_at" DESC);
