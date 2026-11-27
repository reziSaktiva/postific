-- T-196 (KI-106, ADR-167): enable RLS on the eight `public` tables that had it
-- disabled and were readable and writable with the public Supabase key.
--
-- Pattern (ADR-141, scope extended by ADR-167): ENABLE ROW LEVEL SECURITY plus
-- one `FOR ALL TO "app_runtime"` policy per table. The policy is created only if
-- the role exists (the shadow database has no `app_runtime`). `anon` and
-- `authenticated` get no policy, so they are denied by default.
--
-- The app connects as `postgres`, which owns these tables and bypasses RLS, so
-- sign-in, jobs, webhooks, and migrations keep working.
--
-- Rollback (per table):
--   DROP POLICY IF EXISTS "<table>_app_runtime" ON "<table>";
--   ALTER TABLE "<table>" DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  has_app_runtime boolean := EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime'
  );
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'identity_user',
    'identity_session',
    'identity_account',
    'identity_verification',
    'workspaces',
    'background_jobs',
    'outstand_webhook_events',
    '_prisma_migrations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    IF has_app_runtime THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_app_runtime', t);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO "app_runtime" USING (true) WITH CHECK (true)',
        t || '_app_runtime',
        t
      );
    END IF;
  END LOOP;
END
$$;
