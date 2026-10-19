-- T-115 / JOB-05 — daftar ConnectedAccount aktif untuk fan-out import
-- harian. Job runner tidak punya sesi Better Auth, dan
-- `workspace_connected_accounts` ber-RLS, jadi query biasa tanpa
-- `app.current_user_id` mengembalikan nol baris di role `app_runtime`.
-- Pola sama `analytics_list_active_connected_accounts` (T-048).
--
-- Signature fungsi analytics TIDAK diubah: import butuh `platform`
-- (handler memproses post per platform), analytics tidak.
--
-- Akun `disconnected` atau `reconnect_required` tidak ikut — filter yang
-- sama dengan fan-out JOB-04.

CREATE FUNCTION "public"."import_list_accounts_for_periodic_sync"()
RETURNS TABLE (
  workspace_id uuid,
  connected_account_id uuid,
  outstand_account_id text,
  platform text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    wca."workspace_id" AS workspace_id,
    wca."id" AS connected_account_id,
    wca."outstand_account_id" AS outstand_account_id,
    wca."platform" AS platform
  FROM "workspace_connected_accounts" wca
  WHERE wca."status" = 'active'
    AND wca."reconnect_required" = false
$$;

REVOKE ALL ON FUNCTION "public"."import_list_accounts_for_periodic_sync"() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT EXECUTE ON FUNCTION "public"."import_list_accounts_for_periodic_sync"() TO "app_runtime";
  END IF;
END
$$;
