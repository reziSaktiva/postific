-- T-304 (ADR-166 decision 7, S-009): additive composite index for the
-- Notifications panel cursor query (WHERE user_id ORDER BY created_at DESC,
-- id DESC). Index only; no table rewrite of data and safe for old code.
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at" DESC, "id" DESC);
