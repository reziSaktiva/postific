-- T-114 review — tandai PublishingPost Imported yang sudah dibandingkan
-- dengan riwayat Outstand tetapi tidak bisa diisi `outstand_post_id`
-- (id sudah dipakai post lain, atau platform post id tidak ada di riwayat).
-- Existence check backfill mengabaikan kolom ini supaya satu baris yang
-- tidak pernah cocok tidak memicu GET /v1/posts penuh di setiap sync.
-- Nullable, tanpa default: baris yang ada tetap eligible sampai backfill
-- benar-benar melewatinya.
ALTER TABLE "publishing_posts"
  ADD COLUMN "outstand_id_backfill_skipped_at" TIMESTAMPTZ(6);
