-- Review finding 2026-09-22 (PR #129): `listHistory`'s `publishedAtRange`
-- filter (T-045/T-046/T-047, /analyze) narrowed by `workspace_id`+`status`
-- but had no index covering `published_at`, so Postgres still scanned every
-- matching row to apply the date range. This composite index lets it use
-- the index for the range bound directly.
CREATE INDEX "publishing_posts_workspace_id_status_published_at_idx" ON "publishing_posts"("workspace_id", "status", "published_at");
