-- Eskalasi review Ridwan Architecture Reviewer (T-050/T-051/T-052, JOB-03
-- Engagement Sync seeding) — `disconnectAccount` never cancels the running
-- `engagement.sync` self-reschedule chain (`background_jobs` has no cancel
-- mechanism, and `IJobScheduler` only exposes `scheduleJob`, no
-- cancel/deleteByCriteria). Combined with `WorkspaceService.
-- completeAccountConnection` seeding a brand-new chain on every
-- reconnect (T-051 fix), a repeated disconnect→reconnect cycle for the same
-- account would otherwise accumulate parallel self-reschedule chains
-- forever — with the Real Outstand adapter (T-025) that means an account
-- the user explicitly disconnected keeps getting polled and keeps
-- triggering `engagement_new` notifications, a privacy/control issue, not
-- just wasted API calls.
--
-- Fix: extend the shared SECURITY DEFINER lookup function
-- `webhook_find_account_owner_by_outstand_account_id` (migration
-- `20260907120000_t026_outstand_webhook_system_lookups`, already reused by
-- BOTH `markAccountReconnectRequired` (T-026.5 webhook path) and
-- `findAccountOwnerByOutstandAccountId` (T-051 JOB-03 read path)) to also
-- return `status`. This migration ONLY adds the extra output column — the
-- underlying SELECT still matches accounts of any status, so
-- `markAccountReconnectRequired`'s existing behavior (which already guards
-- its OWN write with `status: { not: "disconnected" }`) is unaffected.
--
-- The actual filtering happens in the TypeScript repository layer
-- (`findAccountOwnerByOutstandAccountId` in
-- `apps/web/src/lib/repositories/workspace/workspace.repository.ts`),
-- which now treats a non-`active` status the SAME as "account not found" —
-- reusing the EXISTING, already-tested dead-letter path in
-- `EngagementSyncJobHandler.handle` (`engagement-sync-job-handler.ts`):
-- the handler throws BEFORE calling `SyncCommentsUseCase.sync` and BEFORE
-- self-rescheduling, so a disconnected account's chain dies on its very
-- next invocation without ever hitting Outstand again. No new cancel
-- mechanism was added — evaluated against `IJobScheduler`/
-- `background_job_store.ts` first (no cancel/deleteByCriteria exists
-- today) and this narrower fix closes the root cause without adding one.
--
-- `DROP FUNCTION` first: Postgres refuses `CREATE OR REPLACE FUNCTION` when
-- the OUT-parameter row type changes (adding `status` changes it), erroring
-- 42P13 "cannot change return type of existing function" otherwise.
DROP FUNCTION IF EXISTS "public"."webhook_find_account_owner_by_outstand_account_id"(text);

CREATE FUNCTION "public"."webhook_find_account_owner_by_outstand_account_id"(
  p_outstand_account_id text
)
RETURNS TABLE (
  workspace_id uuid,
  connected_account_id uuid,
  owner_user_id text,
  status text,
  reconnect_required boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    wca."workspace_id" AS workspace_id,
    wca."id" AS connected_account_id,
    w."owner_id" AS owner_user_id,
    wca."status" AS status,
    wca."reconnect_required" AS reconnect_required
  FROM "workspace_connected_accounts" wca
  JOIN "workspaces" w ON w."id" = wca."workspace_id"
  WHERE wca."outstand_account_id" = p_outstand_account_id
$$;
