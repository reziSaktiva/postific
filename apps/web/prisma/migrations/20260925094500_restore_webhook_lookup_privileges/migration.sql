-- Restore EXECUTE privileges on SECURITY DEFINER webhook lookup functions.
-- Migration 20260924090000 DROPped/recreated
-- `webhook_find_account_owner_by_outstand_account_id`, which resets default
-- PUBLIC EXECUTE on the new function. Re-assert the hardening from
-- 20260907120000 for both sibling lookups (owner + post targets).

REVOKE EXECUTE ON FUNCTION "public"."webhook_find_account_owner_by_outstand_account_id"(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."webhook_find_post_targets_by_outstand_post_id"(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT EXECUTE ON FUNCTION "public"."webhook_find_post_targets_by_outstand_post_id"(text) TO "app_runtime";
    GRANT EXECUTE ON FUNCTION "public"."webhook_find_account_owner_by_outstand_account_id"(text) TO "app_runtime";
  END IF;
END
$$;
