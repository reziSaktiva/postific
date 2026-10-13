-- Redesain KI-068/ADR-113 (`fetchComments`/`replyToComment` scope) — API
-- resmi Outstand men-scope komentar PER POST
-- (`GET/POST /v1/posts/{postId}/replies`, query `network` WAJIB,
-- `username` opsional tapi kita selalu mengirimnya untuk menghindari 400
-- disambiguasi multi-akun). `SyncCommentsUseCase.sync` karena itu butuh
-- `accountUsername` (`WorkspaceConnectedAccount.handle`), bukan cuma
-- `outstandAccountId` seperti sebelumnya.
--
-- `EngagementSyncJobHandler` (JOB-03) tidak punya Better Auth session
-- (chicken-and-egg yang sama dengan webhook T-026) — satu-satunya cara ia
-- resolve data akun (termasuk `handle`) adalah lewat lookup SECURITY
-- DEFINER `webhook_find_account_owner_by_outstand_account_id` yang SUDAH
-- dipakai untuk resolve acting `userId` (T-051). Extend fungsi yang sama
-- (pola persis migration `20260922110000_t051_filter_active_status_engagement_sync_lookup`
-- yang menambah kolom `status`) untuk juga mengembalikan `handle` —
-- daripada menambah lookup terpisah untuk satu kolom.
--
-- `DROP FUNCTION` dulu: Postgres menolak `CREATE OR REPLACE FUNCTION` saat
-- OUT-parameter row type berubah (menambah `handle` mengubahnya), error
-- 42P13 "cannot change return type of existing function" kalau tidak.
DROP FUNCTION IF EXISTS "public"."webhook_find_account_owner_by_outstand_account_id"(text);

CREATE FUNCTION "public"."webhook_find_account_owner_by_outstand_account_id"(
  p_outstand_account_id text
)
RETURNS TABLE (
  workspace_id uuid,
  connected_account_id uuid,
  owner_user_id text,
  status text,
  reconnect_required boolean,
  handle text
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
    wca."reconnect_required" AS reconnect_required,
    wca."handle" AS handle
  FROM "workspace_connected_accounts" wca
  JOIN "workspaces" w ON w."id" = wca."workspace_id"
  WHERE wca."outstand_account_id" = p_outstand_account_id
$$;
