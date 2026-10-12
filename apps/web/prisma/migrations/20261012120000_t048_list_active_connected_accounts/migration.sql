-- T-048 / JOB-04 — daftar ConnectedAccount aktif untuk fan-out cron
-- harian. Job runner tidak punya sesi Better Auth, dan
-- `workspace_connected_accounts` ber-RLS, jadi query biasa tanpa
-- `app.current_user_id` mengembalikan nol baris di role `app_runtime`.
-- Pola sama `webhook_find_account_owner_by_outstand_account_id` (T-026):
-- SECURITY DEFINER, GRANT hanya ke `app_runtime`.
--
-- Akun `disconnected` atau `reconnect_required` tidak ikut — sama filter
-- yang dipakai `findAccountOwnerByOutstandAccountId` sebelum JOB-03 sync.

CREATE FUNCTION "public"."analytics_list_active_connected_accounts"()
RETURNS TABLE (
  workspace_id uuid,
  connected_account_id uuid,
  outstand_account_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    wca."workspace_id" AS workspace_id,
    wca."id" AS connected_account_id,
    wca."outstand_account_id" AS outstand_account_id
  FROM "workspace_connected_accounts" wca
  WHERE wca."status" = 'active'
    AND wca."reconnect_required" = false
$$;

REVOKE ALL ON FUNCTION "public"."analytics_list_active_connected_accounts"() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT EXECUTE ON FUNCTION "public"."analytics_list_active_connected_accounts"() TO "app_runtime";
  END IF;
END
$$;
