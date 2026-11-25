-- T-302 (S-009, ADR-166 decision 7: additive composite indexes, pre-approved
-- by King Rezi 2026-11-25). Keyset pages of the Publish List tabs and Board
-- columns: each order ends with the id, and every query filters by
-- workspace and status first. Indexes only; no table or data change.

-- Drafts, Approvals; Board Draft, Approvals, Failed (`updated-desc`).
CREATE INDEX "publishing_posts_workspace_id_status_updated_at_id_idx"
  ON "publishing_posts"("workspace_id", "status", "updated_at" DESC, "id" DESC);

-- Queue; Board Scheduled (`scheduled-asc`).
CREATE INDEX "publishing_posts_workspace_id_status_scheduled_at_id_idx"
  ON "publishing_posts"("workspace_id", "status", "scheduled_at", "id");

-- History; Board Published (`occurred-desc`).
CREATE INDEX "publishing_posts_workspace_id_status_occurred_at_updated_at_idx"
  ON "publishing_posts"("workspace_id", "status", "occurred_at" DESC, "updated_at" DESC, "id" DESC);
