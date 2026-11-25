-- T-303 (S-009, ADR-166, keputusan 7): indeks komposit aditif untuk daftar
-- komentar Engage berhalaman (cursor = `received_at` + `id`, tanpa offset).
--
-- (a) Semua komentar workspace, terbaru dulu (tampilan List, sort "Terbaru"
--     dan "Terlama" lewat pemindaian terbalik): `workspace_id` lalu
--     `received_at DESC, id DESC`.
-- (b) Bagian per status (`unread` dulu pada "Belum dibalas dulu", dan filter
--     Status): `workspace_id, status` lalu `received_at DESC, id DESC`.
-- Komentar satu posting sudah dilayani indeks T-218.8
-- (`workspace_id, post_id, received_at DESC`); id hanya tie-breaker pada
-- himpunan kecil. Hanya `CREATE INDEX`: tidak ada perubahan kolom/data.
CREATE INDEX IF NOT EXISTS "engagement_inbox_items_workspace_id_received_at_id_idx"
  ON "engagement_inbox_items" ("workspace_id", "received_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "engagement_inbox_items_workspace_id_status_received_at_id_idx"
  ON "engagement_inbox_items" ("workspace_id", "status", "received_at" DESC, "id" DESC);
