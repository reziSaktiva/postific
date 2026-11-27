## Decision ADR-167

### Title

The ADR-141 RLS pattern is extended to the eight `public` tables that had RLS disabled (`identity_user`, `identity_session`, `identity_account`, `identity_verification`, `workspaces`, `background_jobs`, `outstand_webhook_events`, `_prisma_migrations`) (amends the scope of ADR-141 and ADR-152; closes KI-106 through T-196)

### Status

**Accepted** (King Rezi's decision in chat, 2026-11-27, T-196.2).

### Date

2026-11-27

### Context

The Supabase advisor reported RLS disabled on eight `public` tables on staging (KI-106, 2026-11-03). T-196.1 (2026-11-04) proved that the `anon` and `authenticated` roles can read all eight and hold full write grants on them. The public Supabase key is already in the browser for Realtime and Storage (`AGENTS.md` rule 6), so login sessions, linked accounts, workspaces, jobs, and Outstand webhook bodies were exposed. Since 2026-11-27 the webhook table also receives real `comment.received` bodies (T-311).

Read-only checks on staging before the decision (2026-11-27):

- The app connects as `postgres` through Supavisor; no `app_runtime` session was seen. `postgres` owns all eight tables and has `BYPASSRLS`.
- `app_runtime` exists, does not bypass RLS, and holds SELECT, INSERT, UPDATE, and DELETE on all eight tables.
- The browser uses Realtime `postgres_changes` only on `notifications` and `publishing_posts`, the only `public` tables in the `supabase_realtime` publication. No browser code reads the eight tables.

ADR-141 (scope amended by ADR-152) names its tables explicitly, so using its pattern on other tables needs this decision (`AGENTS.md` rule 2).

### Decision

1. **Pattern:** each of the eight tables gets `ENABLE ROW LEVEL SECURITY` and one policy `FOR ALL TO "app_runtime" USING (true) WITH CHECK (true)`, created only if the `app_runtime` role exists (the shadow database has no such role). `anon` and `authenticated` get no policy, so they are denied by default. Same pattern as ADR-141 and ADR-152.
2. **Grants are not revoked.** RLS is the protection; revoking was offered and not chosen.
3. **No per-user or per-workspace policy.** Isolation stays in the application layer (DB-D05 exception, as in ADR-141).
4. **Rollout:** one migration for all eight tables, then sign-in, publish, webhook, and job-runner checks on staging and a fresh Supabase advisor run (T-196.3, T-196.4).
5. **Apply:** the migration goes to `staging` by PR; King Rezi runs `bun run db:deploy` after merge; the AI verifies afterwards.

### King Rezi's answers

| #   | Question       | Answer                                                        |
| --- | -------------- | ------------------------------------------------------------- |
| Q1  | RLS pattern    | ADR-141 pattern, without revoking grants (2026-11-27)         |
| Q2  | Rollout        | One migration for all eight tables (2026-11-27)               |
| Q3  | Who applies it | PR to `staging`, then King Rezi runs `db:deploy` (2026-11-27) |

### Consequences

- The app keeps working because it connects as `postgres`, which owns the tables and bypasses RLS. If the app is later moved to `app_runtime`, the policies already allow it.
- The public Supabase key can no longer read or write these eight tables.
- Rollback per table: `DROP POLICY IF EXISTS "<table>_app_runtime" ON "<table>"; ALTER TABLE "<table>" DISABLE ROW LEVEL SECURITY;`.
- Production does not exist yet (KI-028); it gets the same migration when it is created.

### Alternatives considered

- **Also revoke grants from `anon` and `authenticated`:** two layers of protection, but a larger migration and rollback; not chosen.
- **RLS with no policy at all:** simplest, but would deny everything to `app_runtime`; rejected.
- **One table at a time:** the original T-196.3 plan; safest, but eight deploy-and-test rounds for a change the app's role bypasses; not chosen.
