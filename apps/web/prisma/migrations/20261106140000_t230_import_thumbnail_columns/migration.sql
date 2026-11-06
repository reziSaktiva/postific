-- T-230 (ADR-158): thumbnail kecil posting impor disimpan di bucket `media`.
-- Tiga kolom nullable (aditif, aman untuk kode lama): path file, jenis
-- ("image" | "video_poster"), dan waktu percobaan terakhir (agar URL CDN
-- yang sudah mati tidak dicoba ulang di setiap import).
ALTER TABLE "publishing_post_targets"
  ADD COLUMN "thumbnail_storage_path" TEXT,
  ADD COLUMN "thumbnail_kind" TEXT,
  ADD COLUMN "thumbnail_attempted_at" TIMESTAMPTZ(6);

ALTER TABLE "publishing_post_targets"
  ADD CONSTRAINT "publishing_post_targets_thumbnail_kind_check"
  CHECK ("thumbnail_kind" IS NULL OR "thumbnail_kind" IN ('image', 'video_poster'));
