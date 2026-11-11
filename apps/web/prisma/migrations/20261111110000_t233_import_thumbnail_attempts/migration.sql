-- T-233 (ADR-158 addendum): penghitung kegagalan SEMENTARA thumbnail posting
-- impor. Kolom aditif dengan default 0 (aman untuk kode lama, tanpa penulisan
-- ulang tabel di PostgreSQL 11+); baris yang sudah ada mulai dari 0.
ALTER TABLE "publishing_post_targets"
  ADD COLUMN "thumbnail_attempts" INTEGER NOT NULL DEFAULT 0;
