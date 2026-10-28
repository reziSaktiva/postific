-- T-072 — Satu workspace = satu Start Page (database-strategy.md BC-07:
-- "Enforce di application layer; dapat ditambahkan UNIQUE(workspace_id)").
-- Service sudah mengecek, tapi dua request bersamaan bisa lolos cek itu;
-- unique index menutup race-nya. Tabel belum punya jalur tulis sebelum T-072,
-- jadi tidak ada duplikat yang perlu dibersihkan. Menggantikan index biasa
-- (unique index tetap melayani lookup by workspace_id).

DROP INDEX IF EXISTS "start_page_pages_workspace_id_idx";
CREATE UNIQUE INDEX "start_page_pages_workspace_id_key" ON "start_page_pages"("workspace_id");
