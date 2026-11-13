# Database Strategy

This document defines the database strategy for the **Postific** product — covering the platform, multi-tenancy, schema organization, naming convention, table schema per bounded context, Row-Level Security, and storage.

All decisions in this document refer to the **Domain Model & Bounded Context** (`domain-model.md`) as the foundation of entities and relations, and the **System Architecture README** (`README.md`) as the reference for pre-architecture decisions.

---

# Purpose

* Set the multi-tenancy strategy and data isolation between workspaces.
* Define a consistent schema organization and naming convention.
* Document the table schema for each bounded context.
* Set the Row-Level Security (RLS) pattern compatible with Better Auth.
* Define the storage strategy for media files.
* Produce enough input for Engineering Planning (M6) — SQL implementation details are defined in the Engineering Planning phase.

---

# Pre-Architecture Decisions

The following decisions were set before this document was created and are the foundation of the database strategy:

| Topic | Decision | Source |
|-------|-----------|--------|
| Database Platform | Supabase PostgreSQL Cloud | README.md |
| Multi-tenancy | Row-Level Security with `workspace_id` | README.md |
| Storage | Supabase Storage | README.md |
| Auth Library | Better Auth | README.md |

---

# Database Strategy Decisions

New decisions set in this document:

| ID | Topic | Decision |
|----|-------|-----------|
| DB-D01 | Schema Organization | Single `public` schema, tables grouped with a domain prefix. **Exception:** the main table (aggregate root) of a domain may use a short name without a prefix if its entity name is identical to the domain name (examples: `workspaces`, `notifications`) |
| DB-D02 | ID Generation | UUID v4 using `gen_random_uuid()` — native PostgreSQL/Supabase |
| DB-D03 | Soft Delete | Hard delete by default; `deleted_at` only on `publishing_posts` |
| DB-D04 | Identity Tables | BC-01 Identity is managed entirely by Better Auth with the `identity_` prefix |
| DB-D05 | RLS Approach | Application-enforced authorization as the main layer; RLS as a safety net (defense-in-depth) |
| DB-D06 | Timestamps | All tables use `created_at` and `updated_at` with `DEFAULT now()` |

---

# Multi-Tenancy Strategy

## Isolation Unit: `workspace_id`

All workspace-scoped data uses `workspace_id` as the isolation unit. Every table that stores domain data (except BC-01 Identity and part of BC-10 Billing) has a `workspace_id uuid NOT NULL` column.

```
Workspace A ──── workspace_id: abc-123 ────► publishing_posts WHERE workspace_id = 'abc-123'
Workspace B ──── workspace_id: def-456 ────► publishing_posts WHERE workspace_id = 'def-456'
```

## RLS and Better Auth

Better Auth **does not use Supabase Auth** as the session provider. As a result, the built-in Supabase `auth.uid()` function is **not available** for RLS policies.

**Approach taken (DB-D05):**

All database access is done through server-side code (Next.js Server Components, Server Actions, Route Handlers) using the **Supabase service role key**. The main authorization is enforced in the application layer before every database operation.

RLS functions as a **defense-in-depth safety net** — a second security layer to prevent data leaks if there is a bug in the application layer. The RLS pattern uses the session variable `app.current_user_id` set by the server before the query.

```
Request → Next.js Server Layer
              ↓
          Better Auth verifies the session → get user_id
              ↓
          Application Layer checks workspace membership
              ↓
          SET LOCAL app.current_user_id = '{user_id}';
              ↓
          Query Supabase (service role) → RLS checks the session variable
```

**Reasons for this approach:**
* Better Auth is not natively integrated with Supabase JWT.
* All DB access already goes through server-side code — there is no client-side DB access.
* Simpler and more predictable than a custom JWT claim setup for the MVP.
* Can be upgraded to custom JWT + Supabase Auth in the future if needed.

**Note on the two RLS contexts:**
* **Server-side queries** (service role key): RLS uses `current_setting('app.current_user_id', true)::uuid` because `auth.uid()` is not available with the service role.
* **Supabase Realtime subscriptions** (client anon key): RLS uses `auth.uid()`, which requires a Better Auth + Supabase JWT integration so that `auth.uid()` returns the correct userId. The configuration details are defined in `auth-architecture.md` and implemented in Engineering Planning (M6).

## RLS Policy Pattern

Tables that have `workspace_id` use the following pattern as a template:

```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Only users who are workspace members can access
CREATE POLICY "{table_name}_workspace_isolation"
  ON {table_name}
  FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = current_setting('app.current_user_id', true)
        AND wm.status = 'active'
    )
  );
```

> **Correction (2026-08-13, T-017):** The example above originally cast
> `current_setting('app.current_user_id', true)::uuid`. This is wrong for the
> actual schema — `identity_user.id` (Better Auth) is a `cuid()` string
> (`text`), not a UUID, and all `user_id` columns in the domain tables
> (`workspace_members.user_id`, etc.) are also of type `text`, not
> `uuid`. A `::uuid` cast on the value of `app.current_user_id` would fail at runtime
> (`invalid input syntax for type uuid`) once filled with a real cuid. `workspace_id`
> itself stays `uuid` in all tables — the `::uuid` cast was removed only for the
> `user_id`/`app.current_user_id` side, not for `workspace_id`. This is purely a
> type correction to the SQL, not a change to the RLS pattern/decision. See also
> `database-orm.md` § DO-D06 for the same note, and
> `apps/web/src/lib/prisma/with-current-user.ts` for the implementation of the wrapper
> that sets this variable (`set_config`, not a literal `SET LOCAL`, to
> avoid SQL injection through the Prisma tagged template).

The RLS SQL details per table are defined in Engineering Planning (M6), and
have been implemented as a Prisma migration (T-017) —
`apps/web/prisma/migrations/20260813045625_t017_add_rls_policies/migration.sql`.

> **Note (2026-09-11, T-092.1) — the next instance of the
> DO-D06/T-017 precedent (cuid vs uuid):** the RLS Policy Pattern variant for
> Supabase Realtime connections (anon key, ADR-094 point 3) also cannot use
> the Supabase `auth.uid()` function as-is, because that function performs a
> forced `::uuid` cast on the JWT `sub` claim — while the `user_id` column
> is a cuid string throughout the system (the same root cause as the
> `app.current_user_id` correction above). The policy
> `publishing_posts_realtime_workspace_members`
> (`20260911090000_t092_1_publishing_posts_realtime_rls`) uses
> `current_setting('request.jwt.claim.sub', true)` (fallback parse of
> `request.jwt.claims`) to read `sub` as `text`, instead of
> calling `auth.uid()` directly. Full details: ADR-094 point 3 (implementation
> note 2026-09-11).

> **Runtime status note (2026-08-13, T-017 — see the related KI in
> `PROJECT_STATE.md`):** The policies above have been applied to the database, but
> the `DATABASE_URL`/`DIRECT_URL` connections currently use the Postgres role
> `postgres`, which in Supabase has the `BYPASSRLS` attribute by default.
> As a result RLS is **not effectively active** for queries through this
> connection — the "defense-in-depth" described above does not yet function in
> the real runtime until the application connection is moved to a role without `BYPASSRLS`
> (a separate follow-up task, needs Supabase dashboard access). The main authorization
> still depends 100% on the Application Service (RBAC), per
> DB-D05.

---

# Schema Organization

## Decision: Single `public` Schema with Domain Prefix (DB-D01)

All tables are in a single `public` schema. Domains are separated using a **prefix on the table name**:

| Domain Prefix | Bounded Context |
|--------------|----------------|
| `identity_` | BC-01 Identity (managed by Better Auth) |
| `workspace_` | BC-02 Workspace |
| `publishing_` | BC-03 Publishing |
| `mcp_` | BC-04 MCP Access |
| `engagement_` | BC-05 Engagement |
| `analytics_` | BC-06 Analytics |
| `start_page_` | BC-07 Start Page |
| `media_` | BC-08 Media |
| `notification_` | BC-09 Notification |
| `billing_` | BC-10 Billing |

**Table naming convention:** `{domain_prefix}_{entity_plural}` in `snake_case`.

Examples: `publishing_posts`, `workspace_members`, `engagement_inbox_items`.

**Exception — main table without a redundant prefix:** If the plural entity name is identical to the domain name (which would produce a name like `workspace_workspaces` or `notification_notifications`), that main table uses a short name without a prefix: `workspaces` and `notifications`. Derived tables in that domain still use the prefix (`workspace_members`, `workspace_connected_accounts`, etc.).

---

# ID Convention (DB-D02)

All primary keys use **UUID v4** generated by PostgreSQL:

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
```

This applies to all tables except those managed by Better Auth (Better Auth also uses UUID, configured in the Better Auth setup).

Mapping to the TypeScript branded ID types in `packages/shared` is done in the application layer.

---

# Table Schema per Bounded Context

---

## BC-01 — Identity (Better Auth Managed)

The BC-01 Identity tables are managed entirely by **Better Auth**. Better Auth is configured to use the `identity_` prefix to stay consistent with the project's naming convention.

| Table | Managed By | Notes |
|-------|--------------|------------|
| `identity_user` | Better Auth | Registered user data; per-user time zone in `time_zone` (IANA, default `Asia/Jakarta`) and `time_zone_source` (`pending\|legacy\|detected\|manual`), ADR-146 |
| `identity_session` | Better Auth | The user's active sessions |
| `identity_account` | Better Auth | OAuth accounts linked to the user |
| `identity_verification` | Better Auth | Email verification / password reset tokens |

**Note:** The column schema of these tables follows the Better Auth schema spec. The project does not create or modify these tables manually — Better Auth manages the Identity table migrations.

`identity_user.id` is the global reference (`UserId`) consumed by all other bounded contexts.

---

## BC-02 — Workspace

### `workspaces`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Workspace ID |
| `name` | `text NOT NULL` | Workspace name |
| `slug` | `text NOT NULL UNIQUE` | Internal unique identifier, not used in routing/URL (`domain-model.md`) |
| `owner_id` | `uuid NOT NULL` | Reference to `identity_user.id` |
| `pending_owner_transfer_to` | `uuid` | Reference to `identity_user.id`; filled when `transferOwnership` is triggered, cleared after `acceptOwnershipTransfer` or cancellation (ADR-050) |
| `plan` | `text NOT NULL DEFAULT 'free'` | `free \| pro` |
| `brand_name` | `text` | BrandSettings: brand name |
| `brand_tone` | `text` | BrandSettings: tone of voice guidance |
| `brand_guidelines` | `text` | BrandSettings: brand guidelines notes |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

> `BrandSettings` (Value Object) is embedded directly into `workspaces` as separate columns — no separate table is created for the MVP.

### `workspace_members`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Member ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `user_id` | `uuid NOT NULL` | Reference to `identity_user.id` |
| `role` | `text NOT NULL` | `owner \| admin \| creator` (ADR-074 — previously included `manager`) |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| active \| removed` |
| `invited_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `joined_at` | `timestamptz` | Null until the member accepts the invitation |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, user_id)` — one user can be a member of a workspace with only one role.

### `workspace_connected_accounts`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Connected Account ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `platform` | `text NOT NULL` | `instagram \| facebook \| twitter \| linkedin \| tiktok \| youtube \| threads \| pinterest` |
| `outstand_account_id` | `text NOT NULL` | ID from the Outstand API (external reference) |
| `handle` | `text NOT NULL` | Account name (@handle or page name) |
| `status` | `text NOT NULL DEFAULT 'active'` | `active \| disconnected \| error` |
| `reconnect_required` | `boolean NOT NULL DEFAULT false` | `true` after `account.token_expired`; back to `false` after reconnect |
| `connected_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, outstand_account_id)` — an Outstand account can be connected only once per workspace.

---

## BC-03 — Publishing

### `publishing_posts`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Post ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `author_id` | `uuid NOT NULL` | Reference to `identity_user.id` |
| `status` | `text NOT NULL DEFAULT 'draft'` | `draft \| in_review \| ready_to_schedule \| scheduled \| published \| failed` |
| `caption` | `text NOT NULL DEFAULT ''` | Post caption text |
| `media_ids` | `uuid[] NOT NULL DEFAULT '{}'` | Array of references to `media_items.id` |
| `scheduled_at` | `timestamptz` | Desired publish time; null if not yet scheduled |
| `published_at` | `timestamptz` | Time it was successfully published |
| `failed_at` | `timestamptz` | |
| `failure_reason` | `text` | |
| `outstand_post_id` | `text` | **(amendment to ADR-092)** ONE post ID from the Outstand API, covering all `PostTarget`s of this post at once (1 `schedulePost`/`publishNow` call for all targets). Filled at the post level, not per `PostTarget` — see `domain-model.md` |
| `deleted_at` | `timestamptz` | Soft delete — a deleted post is not actually removed (DB-D03) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Soft Delete Note:** `publishing_posts` is the only table that uses soft delete. Deleted posts only set `deleted_at`. All queries must include the filter `deleted_at IS NULL` except for audit/recovery queries.

### `publishing_post_targets`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Post Target ID |
| `post_id` | `uuid NOT NULL REFERENCES publishing_posts(id) ON DELETE CASCADE` | |
| `connected_account_id` | `uuid NOT NULL REFERENCES workspace_connected_accounts(id)` | |
| `platform` | `text NOT NULL` | Platform snapshot at the time the target was created |
| `content_format` | `text NOT NULL DEFAULT 'post'` | `post \| reel \| story \| pin` (ADR-039). DB default = technical fallback; **the Application Service must set the business value** (Pinterest → `pin`) and validate the platform matrix |
| `platform_options` | `jsonb` | Platform-specific fields (e.g. Pinterest title/link/board); null if unused |
| `platform_post_id` | `text` | **(amendment to ADR-092, renamed from `outstand_job_id`)** the post ID on the ACTUAL platform (e.g. Instagram) per account — different from the post-level `publishing_posts.outstand_post_id`. Filled async through `fetchPostOutcome`/webhook, not synchronously from `schedulePost`/`publishNow` |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| scheduled \| published \| failed` |
| `platform_post_url` | `text` | **(amendment to ADR-092, renamed from `published_url`)** the URL of the published post per account, filled async together with `platform_post_id` |
| `error` | `text` | Error message from the Outstand API if publishing failed |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### ~~`publishing_queue_slots`~~ — deprecated (ADR-083, 2026-08-19)

The physical table still exists in the DB, but the `QueueSlot` entity has been removed from
`domain-model.md` — Queue is now a computed view over `Post`/`PostTarget`.
Scheduled to be removed through a migration when T-032.5 is worked. The schema below
is kept as a historical reference, not actively used.

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Queue Slot ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `connected_account_id` | `uuid NOT NULL REFERENCES workspace_connected_accounts(id)` | |
| `scheduled_at` | `timestamptz NOT NULL` | Slot time in the queue |
| `post_id` | `uuid REFERENCES publishing_posts(id) ON DELETE SET NULL` | Null if the slot is empty |
| `order` | `integer NOT NULL` | Order in the queue for the same account |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(connected_account_id, scheduled_at)` — one time slot per account.

---

## BC-04 — MCP Access

Final columns (ADR-138, ADR-139 Accepted 2026-10-26; grant model decision by King Rezi 2026-10-26, T-149.1). Types checked against `apps/web/prisma/schema.prisma`: `workspaces.id` is of type `uuid` (`@db.Uuid`), while `identity_user.id` is `cuid()` (`text`), so `user_id` here is `text`, the same as `workspace_members.user_id` (the T-017 correction precedent, see § RLS Policy Pattern).

### `mcp_grants`

The authorization source of MCP calls. One row per approval: user + client + workspace + scope. The rules for its use (per call, revocation, relation to the OAuth plugin tables) are in `application-layer.md` § McpAccessService.

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Grant ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | One workspace per connection. Its value is the same as the plugin consent `referenceId` (in the plugin table of type `text`) |
| `user_id` | `text NOT NULL` | `identity_user.id` (cuid). No FK, like `workspace_members.user_id`. This user's membership in the workspace is what applies |
| `client_id` | `text NOT NULL` | The AI client's `clientId` from dynamic client registration (`identity_oauth_client."clientId"`). No FK: the plugin tables are not changed in shape |
| `client_name` | `text` | A copy of the client name at the time of approval, so the AI client list screen (T-156) does not read the plugin table. Nullable because the client name is optional at registration |
| `scopes` | `text[]` | Logical names `read \| draft \| schedule` (MVP). Wire names (`mcp:read` and so on) are mapped in the adapter, not stored here. Intended as NOT NULL, but Prisma does not support NOT NULL on a list: the migration creates the column without NOT NULL and the repository enforces it |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `last_used_at` | `timestamptz` | The last call that passed authorization; updated at most once per minute |
| `revoked_at` | `timestamptz` | Filled when revoked. Revoked rows are kept as history |

**Indexes:**
- Partial unique `(user_id, client_id, workspace_id) WHERE revoked_at IS NULL`: at most one active grant per user, client, and workspace. Re-approval when an active grant already exists updates that grant's `scopes`, not adds a row. After revocation, connecting again creates a new row. This index also serves `listGrants` (`user_id` prefix).
- `(workspace_id)` (Mandatory Indexes).

### `mcp_audit_logs`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Audit ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `user_id` | `text NOT NULL` | `identity_user.id` (cuid), no FK |
| `grant_id` | `uuid REFERENCES mcp_grants(id) ON DELETE SET NULL` | Empty if the call was rejected because there is no grant |
| `client_id` | `text NOT NULL` | |
| `tool_name` | `text NOT NULL` | |
| `scope` | `text NOT NULL` | Logical name of the tool scope |
| `input_summary` | `text` | Redacted summary |
| `status` | `text NOT NULL` | `success \| denied \| error` |
| `error_code` | `text` | |
| `duration_ms` | `integer` | |
| `target_id` | `text` | ID of the action result, for example a post |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | 90-day retention (deleted by cron JOB-08) |

**Indexes:**
- `(workspace_id, created_at)` for audit queries per workspace; the `workspace_id` prefix already satisfies Mandatory Indexes, so a separate `(workspace_id)` index is not needed.
- `(created_at)` for the global JOB-08 purge (deleting by `created_at` across workspaces, which the index above does not serve). Added in T-149.3 with King Rezi's approval.

### `mcp_rate_limit_windows`

Postgres-based per-workspace rate limit counter (ADR-138 point 7; T-154; ADR-152). Fixed windows at multiples of the UTC epoch: 60 seconds (`calls`), 1 hour (`write_actions`), 1 day (`scheduled_contents`). Usage rules are in `application-layer.md` § McpAccessService.

| Column | Type | Notes |
|-------|------|-----------|
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `quota` | `text NOT NULL` | Quota kind |
| `window_start` | `timestamptz NOT NULL` | Start of the window |
| `expires_at` | `timestamptz NOT NULL` | End of the window; `CHECK (expires_at > window_start)` |
| `count` | `integer NOT NULL` | Counter; `CHECK (count >= 0)` |

PK `(workspace_id, quota, window_start)`; index `(expires_at)` for cleanup. Counting uses a single statement `INSERT ... ON CONFLICT DO UPDATE ... WHERE count + n <= limit` (atomic; a rejection does not increment the counter). Expired rows are cleaned up by JOB-08.

### `mcp_workspace_choices`

Workspace choice per login session in the OAuth approval flow (T-151; ADR-152), replacing an in-memory server `Map`.

| Column | Type | Notes |
|-------|------|-----------|
| `session_id` | `text PK` | Better Auth login session |
| `user_id` | `text NOT NULL` | `identity_user.id`, no FK |
| `workspace_id` | `uuid NOT NULL` | The chosen workspace; no FK |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `expires_at` | `timestamptz NOT NULL` | Valid for 10 minutes; index `(expires_at)` for JOB-08 cleanup |

### Source marker in `publishing_posts` (BC-03)

Column `created_via TEXT NOT NULL DEFAULT 'app'` (`app | mcp`) and `created_via_client_id TEXT NULL` (the AI client's OAuth `clientId`, no FK; T-152, ADR-152). CHECK `publishing_posts_created_via_check`: `app` must have no client id, `mcp` must have a client id. The value is `app`, not `manual`. `update_draft` through MCP does not change the marker. There is no index on `created_via` yet; decided together with the source filter in T-157.

### BC-04 RLS Policy (final, ADR-141)

Decided by King Rezi 2026-10-26 and recorded in ADR-141 (an exception to DB-D05). The per-workspace isolation pattern in § RLS Policy Pattern (DB-D05) depends on `app.current_user_id` set by `withCurrentUser` from the Better Auth session. The BC-04 path does not have that context: tool calls are authenticated through a JWT bearer (not a session), grant creation runs inside the OAuth plugin consent flow, and the audit purge (JOB-08) runs without a user. Therefore the policy is:

- `ENABLE ROW LEVEL SECURITY` on `mcp_grants` and `mcp_audit_logs`; the same pattern applies to `mcp_rate_limit_windows` and `mcp_workspace_choices` (scope extended by ADR-152).
- One policy per table `FOR ALL TO "app_runtime" USING (true) WITH CHECK (true)`, guarded by `IF EXISTS` on `pg_roles` (the shadow DB does not have that role), in the same form as the migration `20261026130000_t148_oauth_tables_app_runtime_policy`.
- `anon` and `authenticated` have no policy, so they are denied (default-deny). These tables must not be readable through PostgREST or the Realtime anon key.
- The `app_runtime` role does **not** bypass RLS: a table with RLS enabled and no policy for that role rejects all writes (error `42501`). Therefore the `app_runtime` policy must exist in the same migration as `ENABLE ROW LEVEL SECURITY`.

**Consequence (a deviation from DB-D05):** this policy does not separate workspaces or users at the database level; isolation between workspaces and between users is enforced entirely by the application layer (every repository query (`IMcpGrantRepository`, `IMcpAuditRepository`, and the `IMcpGrantRevocationPort` adapter) must filter `workspace_id` and/or `user_id`, and `listGrants` only returns those owned by the currently logged-in user). The DB-D05 safety net does not apply to these two tables; RLS only closes access from roles other than `app_runtime`. The same already applies to the OAuth plugin tables (T-148) and server-only infrastructure tables (`background_jobs`, `outstand_webhook_events`; see § System Tables, without RLS at all).

**Rejected alternative (ADR-141):** a per-user policy (`user_id = current_setting('app.current_user_id', true)`) for the read, list, and revoke paths with `withCurrentUser(sub)` from the token claim, plus a `SECURITY DEFINER` function for the purge and the consent hook (the ADR-099 pattern). Keeps the safety net, but every caller must set that variable and the purge needs its own system path; the per-user safety net is not worth it for tables that are only read through the service.

---

## BC-05 — Engagement

### `engagement_inbox_items`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Inbox Item ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `connected_account_id` | `uuid NOT NULL REFERENCES workspace_connected_accounts(id)` | |
| `platform` | `text NOT NULL` | Platform the interaction came from |
| `type` | `text NOT NULL DEFAULT 'comment'` | MVP only `comment` |
| `external_id` | `text NOT NULL` | Comment ID from the Outstand Comments API |
| `author_handle` | `text NOT NULL` | Sender username |
| `content` | `text NOT NULL` | Interaction content |
| `status` | `text NOT NULL DEFAULT 'unread'` | `unread \| replied \| resolved \| dismissed` (ADR-157); no database constraint. Old `done` rows are migrated to `resolved` (T-217.4). Previously written as `unread \| read \| replied \| archived` and in code as `unread \| done` |
| `post_id` | `uuid` | Soft ref to `publishing_posts.id` — no FK enforced |
| `received_at` | `timestamptz NOT NULL` | Time the item was received on the platform |
| `read_at` | `timestamptz` | Kept but unused: not related to the `read` status (no longer exists, ADR-157). King Rezi's decision 2026-11-06: no migration, reviewed if a need arises |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, connected_account_id, external_id)` — keeps the periodic/manual sync upsert idempotent.

**Indexes (T-218.8, an agent decision for King Rezi to review, 2026-11-06):** previously `(workspace_id)`, `(workspace_id, status)`, `(external_id)`, and the unique above. The per-post Engage (ADR-157) adds two query patterns: an aggregation `GROUP BY post_id, connected_account_id, platform, status` with filter `workspace_id` and `received_at >= since`, and the comment list of one post (`workspace_id` + `post_id`, ordered `received_at DESC`). Decision: one new composite index `(workspace_id, post_id, received_at DESC)` (`engagement_inbox_items_workspace_id_post_id_received_at_idx`, migration `20261106120000_t218_engagement_inbox_post_index`, not yet applied to any DB). Reason: serves the per-post comment list without a sort, the grouped aggregation per post, and `post_id IS NULL` (the "Tanpa posting" group). `(workspace_id, received_at)` is not added because the default 12-month range covers nearly all rows so the benefit is small, and every index adds write cost to the sync upsert; the existing `(workspace_id, status)` still serves the `unread` count (badge, T-217.7). **Not yet proven:** the real benefit at large volume has not been measured with `EXPLAIN (ANALYZE)` on real data; measure before treating as final.

**Note:** `post_id` does not use a FOREIGN KEY because it is a soft reference — the referenced post may not exist (deleted) without having to delete the inbox item.

### `engagement_replies`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Reply ID |
| `inbox_item_id` | `uuid NOT NULL REFERENCES engagement_inbox_items(id)` | |
| `user_id` | `uuid NOT NULL` | Reference to `identity_user.id` |
| `content` | `text NOT NULL` | Reply content |
| `outstand_reply_id` | `text` | ID from Outstand after the reply is sent |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| sent \| failed` |
| `sent_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## BC-06 — Analytics

### `analytics_post_metrics`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Post Metrics ID |
| `post_id` | `uuid NOT NULL` | Soft ref to `publishing_posts.id` |
| `connected_account_id` | `uuid NOT NULL` | Soft ref to `workspace_connected_accounts.id` |
| `platform` | `text NOT NULL` | Platform snapshot |
| `impressions` | `integer NOT NULL DEFAULT 0` | |
| `reach` | `integer NOT NULL DEFAULT 0` | |
| `likes` | `integer NOT NULL DEFAULT 0` | |
| `comments` | `integer NOT NULL DEFAULT 0` | |
| `shares` | `integer NOT NULL DEFAULT 0` | |
| `clicks` | `integer` | Nullable — not all platforms provide it |
| `engagement_rate` | `numeric(5,4) NOT NULL DEFAULT 0` | Computed: (likes + comments + shares) / reach |
| `fetched_at` | `timestamptz NOT NULL` | When the data was last fetched from Outstand |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Note:** `post_id` and `connected_account_id` use soft references (no FK enforced) — metrics must stay stored even if the post or account has been deleted, for historical analytics.

### `analytics_workspace_snapshots`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Snapshot ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `period` | `text NOT NULL` | `weekly \| monthly` |
| `period_start` | `date NOT NULL` | |
| `period_end` | `date NOT NULL` | |
| `total_posts` | `integer NOT NULL DEFAULT 0` | |
| `total_reach` | `bigint NOT NULL DEFAULT 0` | |
| `total_engagements` | `bigint NOT NULL DEFAULT 0` | |
| `avg_engagement_rate` | `numeric(5,4) NOT NULL DEFAULT 0` | |
| `top_post_id` | `uuid` | Soft ref to `publishing_posts.id` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, period, period_start)` — one snapshot per workspace per period.

---

## BC-07 — Start Page

### `start_page_pages`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Start Page ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `slug` | `text NOT NULL UNIQUE` | Public URL identifier (e.g. `nama-brand`) |
| `title` | `text NOT NULL` | Page title |
| `bio` | `text` | Short description |
| `avatar_url` | `text` | Page avatar URL |
| `theme` | `text NOT NULL DEFAULT 'default'` | `default \| dark \| accent` (allowlist `START_PAGE_THEMES`, ADR-144; previously written as `default \| minimal \| bold`) |
| `is_published` | `boolean NOT NULL DEFAULT false` | |
| `view_count` | `bigint NOT NULL DEFAULT 0` | Visit counter, only increases through `start_page_record_view` (ADR-143) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Note:** One workspace has only one Start Page, guarded by the constraint `UNIQUE(workspace_id)` (migration `20261026130000_t072_start_page_unique_workspace`, ADR-144) in addition to the application layer.

**Anonymous access (public page `/u/[slug]`):** this table has **no** RLS policy for `anon` or `app_runtime` and is not opened through PostgREST. Read and counters go through three `SECURITY DEFINER` Postgres functions with limited columns: `start_page_get_public_by_slug` (read, only published pages, ADR-142), `start_page_record_view` and `start_page_record_click_and_get_url` (counters, ADR-143). All three are `REVOKE`d from `PUBLIC`/`anon`/`authenticated`, `GRANT EXECUTE` only to `app_runtime`.

### `start_page_links`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Page Link ID |
| `start_page_id` | `uuid NOT NULL REFERENCES start_page_pages(id) ON DELETE CASCADE` | |
| `label` | `text NOT NULL` | Link display text |
| `url` | `text NOT NULL` | Target URL |
| `position` | `integer NOT NULL` | Display order |
| `is_active` | `boolean NOT NULL DEFAULT true` | |
| `click_count` | `bigint NOT NULL DEFAULT 0` | Click counter, only increases through `start_page_record_click_and_get_url` (ADR-143) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## BC-08 — Media

### `media_items`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Media Item ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `uploader_id` | `uuid NOT NULL` | Reference to `identity_user.id` |
| `filename` | `text NOT NULL` | Original file name |
| `mime_type` | `text NOT NULL` | Example: `image/jpeg`, `video/mp4` |
| `size` | `bigint NOT NULL` | File size in bytes |
| `url` | `text` | Application access URL cache that can expire; not the asset identity |
| `storage_path` | `text NOT NULL` | Internal path in the Supabase Storage bucket |
| `outstand_media_id` | `text` | Optional Outstand working copy metadata |
| `outstand_media_url` | `text` | Optional working copy URL metadata; not the source of truth for the original |
| `outstand_uploaded_at` | `timestamptz` | Time the working copy was last confirmed in Outstand |
| `outstand_expires_at` | `timestamptz` | Expiry time of the working copy per the Outstand response |
| `type` | `text NOT NULL` | `image \| video \| gif` |
| `width` | `integer` | Horizontal resolution (for image/video) |
| `height` | `integer` | Vertical resolution (for image/video) |
| `duration` | `numeric(10,2)` | Duration in seconds (for video) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## BC-09 — Notification

### `notifications`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Notification ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `user_id` | `uuid NOT NULL` | Recipient — reference to `identity_user.id` |
| `type` | `text NOT NULL` | `post_published \| post_failed \| account_reconnect_required \| engagement_new \| member_invited \| ...` |
| `title` | `text NOT NULL` | |
| `body` | `text NOT NULL` | |
| `is_read` | `boolean NOT NULL DEFAULT false` | |
| `related_entity_type` | `text` | `post \| inbox_item \| member \| ...` |
| `related_entity_id` | `uuid` | ID of the related entity |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `read_at` | `timestamptz` | |

---

## BC-10 — Billing (Post-MVP)

The Billing tables are defined for forward-compatibility — not implemented in the MVP.

### `billing_subscriptions` *(post-MVP)*

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Subscription ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `plan` | `text NOT NULL` | `free \| pro` |
| `status` | `text NOT NULL` | `active \| past_due \| canceled \| trialing` |
| `current_period_start` | `timestamptz NOT NULL` | |
| `current_period_end` | `timestamptz NOT NULL` | |
| `canceled_at` | `timestamptz` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### `billing_invoices` *(post-MVP)*

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Invoice ID |
| `subscription_id` | `uuid NOT NULL REFERENCES billing_subscriptions(id)` | |
| `amount` | `integer NOT NULL` | Amount in the smallest unit (e.g. cents) |
| `currency` | `text NOT NULL DEFAULT 'usd'` | |
| `status` | `text NOT NULL` | `draft \| open \| paid \| void` |
| `issued_at` | `timestamptz NOT NULL` | |
| `paid_at` | `timestamptz` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## System Tables (Cross-cutting Concerns)

The following tables do not belong to any bounded context — they are system infrastructure used across domains. These tables do **not** use a domain prefix and are not scoped per workspace.

### `background_jobs`

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Job ID |
| `type` | `text NOT NULL` | Job type — see Job Type Registry in `background-jobs.md` |
| `payload` | `jsonb NOT NULL` | Data needed by the job handler |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| running \| done \| failed` |
| `scheduled_at` | `timestamptz NOT NULL DEFAULT now()` | Time the job may be executed (for delay/retry) |
| `started_at` | `timestamptz` | |
| `completed_at` | `timestamptz` | |
| `attempts` | `integer NOT NULL DEFAULT 0` | Number of attempts already made |
| `max_attempts` | `integer NOT NULL DEFAULT 3` | Maximum attempt limit before becoming a dead letter |
| `last_error` | `text` | Last error message |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Note:** This table does not use a domain prefix because it is system infrastructure, not part of any bounded context. RLS is not applied to this table — access is only through server-side code (the JobRunner Route Handler).

The background job architecture details are defined in `background-jobs.md`.

### `outstand_webhook_events`

A durable receipt to separate Outstand webhook delivery from internal processing.

| Column | Type | Notes |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Internal receipt ID |
| `outstand_event_id` | `text NOT NULL UNIQUE` | Vendor event ID if available; otherwise, use the SHA-256 fingerprint of the raw body |
| `event_type` | `text NOT NULL` | `post.published \| post.error \| account.token_expired` for the MVP |
| `raw_body` | `text NOT NULL` | The exact raw body verified by HMAC |
| `status` | `text NOT NULL DEFAULT 'received'` | `received \| processing \| processed \| failed \| dead_lettered` |
| `processing_attempts` | `integer NOT NULL DEFAULT 0` | Internal processing attempts; not Outstand delivery attempts |
| `last_error` | `text` | Last processing error |
| `received_at` | `timestamptz NOT NULL DEFAULT now()` | Time of the durable receipt |
| `processed_at` | `timestamptz` | Completion time |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

The Route Handler only gives an ACK `2xx` after the idempotent insert succeeds and the internal JOB-01 is available. A valid duplicate receipt is ACKed without a double enqueue. This table is server-only and does not use RLS.

---

# Index Strategy

The following indexes are recommended based on anticipated query patterns. Index details (including partial indexes and further composite indexes) are defined in Engineering Planning.

## Mandatory Indexes (Workspace Isolation)

The `workspace_id` column on all multi-tenant tables must be indexed for RLS performance and query filtering:

```sql
CREATE INDEX ON {table_name}(workspace_id);
```

Applies to: `workspace_members`, `workspace_connected_accounts`, `publishing_posts`, ~~`publishing_queue_slots`~~ (deprecated, ADR-083), `mcp_grants`, `mcp_audit_logs`, `engagement_inbox_items`, `analytics_workspace_snapshots`, `media_items`, `notifications`, `start_page_pages`.

## Query-Driven Indexes

| Table | Column | Reason |
|-------|-------|--------|
| `publishing_posts` | `(workspace_id, status)` | Filter content by status (Content Calendar, Queue) |
| `publishing_posts` | `scheduled_at` | Sort and filter scheduled content |
| `publishing_posts` | `deleted_at` | Soft delete filter (partial index: `WHERE deleted_at IS NULL`) |
| `publishing_post_targets` | `post_id` | Lookup targets per post |
| ~~`publishing_queue_slots`~~ | `(connected_account_id, scheduled_at)` | Deprecated (ADR-083) — Queue lookup now goes directly to `publishing_posts` |
| `engagement_inbox_items` | `(workspace_id, status)` | Filter inbox by status |
| `engagement_inbox_items` | `(workspace_id, connected_account_id, external_id)` | Idempotent upsert of sync results |
| `outstand_webhook_events` | `outstand_event_id` | Durable receipt/idempotency (already UNIQUE) |
| `outstand_webhook_events` | `(status, received_at)` | Claim receipts for JOB-01 and dead letter inspection |
| `analytics_post_metrics` | `post_id` | Metrics per post |
| `notifications` | `(user_id, is_read)` | Unread notifications per user |
| `start_page_pages` | `slug` | Public URL lookup (already UNIQUE) |
| `workspaces` | `slug` | Internal lookup by unique identifier — not a URL lookup (already UNIQUE) |

---

# Storage Strategy

## Platform: Supabase Storage

Media files are stored in **Supabase Storage** (pre-architecture decision). Supabase Storage uses an S3-compatible API.

## Bucket Structure

| Bucket | Type | Content |
|--------|------|--------|
| `media` | Private | Files uploaded by users: images, videos, gifs for content |
| `avatars` | Public | Workspace avatars, Start Page, and personal user avatars (T-016.2) |

**Reason for private `media`:** Content files must not be accessed directly via a public URL without authentication. A signed URL is used to generate a temporary link when rendering content.

**Reason for public `avatars`:** Workspace avatars, Start Page, and personal user avatars need to be publicly accessible (Start Page is a public page; user avatars are shown in various UIs without a signed URL).

## File Naming Convention

```
{bucket}/{workspace_id}/{year}/{month}/{uuid}.{ext}

Examples:
media/abc-123-workspace/2026/07/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg
avatars/abc-123-workspace/avatar-{uuid}.jpg   (Start Page, ADR-145)
avatars/users/{user_id}/avatar.{ext}
```

## Storage URL in the Database

`media_items.storage_path` is the source of truth for the original's location. `media_items.url`, if filled, is only an application access URL cache and may expire; the application layer generates a new signed URL from `storage_path`.

For publishing, the application does **not** send a Supabase signed URL to Outstand. The application requests an Outstand upload URL, performs a `PUT`, confirms the upload, then uses the Outstand working copy URL. `outstand_media_id`/`outstand_media_url` may be persisted optionally.

---

# Soft Delete Strategy (DB-D03)

## Decision: Hard Delete by Default

All tables use **hard delete** (data is removed from the database) except `publishing_posts`.

**Reasons:**
* Simplicity — there is no `deleted_at IS NULL` filter to remember in every query.
* Sensitive data (media, notifications, members) does not need to be kept after deletion.
* Easier GDPR/data privacy compliance.

## Exception: `publishing_posts` — Soft Delete

`publishing_posts` uses soft delete (`deleted_at timestamptz`) because:
* A post that has been published may still have `PostTarget`s and `PostMetrics` that reference it.
* Historical analytics needs the post reference even though it has been "deleted" from view.
* A Creator may want to recover a draft that was accidentally deleted.

The application layer must include `WHERE deleted_at IS NULL` on all `publishing_posts` queries except for audit/recovery purposes.

---

# Migration Strategy

The migration implementation details are defined in Engineering Planning (M6). Architecture points agreed:

* **Tooling:** **Prisma Migrate** as the source of truth for application migrations (ADR-031 / `../06-engineering/database-orm.md`). The Supabase CLI may be used for platform tasks, not as the source of the domain schema.
* **Tracking:** Migration artifacts in `apps/web/prisma/migrations/` (version-controlled).
* **Bootstrap Order:** Identity tables (`identity_*`) and domain tables are managed in the same Prisma schema; Better Auth uses the Prisma adapter.
* **Rollback:** Prefer expand-and-contract + forward-fix migrations; operational details in `database-orm.md` and `deployment-infrastructure.md`.

---

# Traceability to the Domain Model

| Domain Entity | Database Table | BC |
|---------------|---------------|-----|
| `User` | `identity_user` (Better Auth) | BC-01 |
| `Session` | `identity_session` (Better Auth) | BC-01 |
| `OAuthAccount` | `identity_account` (Better Auth) | BC-01 |
| `Workspace` + `BrandSettings` | `workspaces` | BC-02 |
| `Member` | `workspace_members` | BC-02 |
| `ConnectedAccount` | `workspace_connected_accounts` | BC-02 |
| `Post` | `publishing_posts` | BC-03 |
| `PostTarget` | `publishing_post_targets` | BC-03 |
| ~~`QueueSlot`~~ | ~~`publishing_queue_slots`~~ | BC-03 — **deprecated (ADR-083, 2026-08-19):** the entity was removed from `domain-model.md`, Queue became a computed view over `Post`/`PostTarget`. The physical table still exists in the DB (zero code references), scheduled to be removed through a migration when T-032.5 is worked |
| `McpGrant` | `mcp_grants` | BC-04 |
| `McpAuditLog` | `mcp_audit_logs` | BC-04 |
| `McpRateLimitWindow` | `mcp_rate_limit_windows` | BC-04 |
| `McpWorkspaceChoice` | `mcp_workspace_choices` | BC-04 |
| `InboxItem` | `engagement_inbox_items` | BC-05 |
| `Reply` | `engagement_replies` | BC-05 |
| `PostMetrics` | `analytics_post_metrics` | BC-06 |
| `WorkspaceSnapshot` | `analytics_workspace_snapshots` | BC-06 |
| `StartPage` | `start_page_pages` | BC-07 |
| `PageLink` | `start_page_links` | BC-07 |
| `MediaItem` | `media_items` | BC-08 |
| `Notification` | `notifications` | BC-09 |
| `Subscription` | `billing_subscriptions` (post-MVP) | BC-10 |
| `Invoice` | `billing_invoices` (post-MVP) | BC-10 |
| *(system)* | `background_jobs` | Cross-cutting — not tied to any BC |
| *(system)* | `outstand_webhook_events` | Cross-cutting — durable webhook receipt |

---

# Decision Log

| ID | Decision | Reason | Alternatives |
|----|-----------|--------|-----------|
| DB-D01 | Single `public` schema with a domain prefix; exception for the main table whose name is identical to the domain (use a short name: `workspaces`, `notifications`) | Supabase standard, simpler setup, RLS needs no cross-schema configuration; the exception avoids redundant names like `workspace_workspaces` | Per-domain PostgreSQL schema (more complex, needs search_path configuration) |
| DB-D02 | UUID v4 via `gen_random_uuid()` | Native PostgreSQL/Supabase, zero config, needs no additional library | ULID (sortable, but needs a library); CUID2 (better for URLs, but also needs a library) |
| DB-D03 | Hard delete by default; soft delete only on `publishing_posts` | Simplicity and privacy by default; Posts need soft delete because of relations and historical data | Soft delete on all tables (query complexity increases); hard delete on all (data loss risk for Posts) |
| DB-D04 | Better Auth uses the `identity_` prefix | Consistent with the domain naming convention; easy to tell apart from application tables | No prefix (generic table names like `user`, `session` — easy to conflict) |
| DB-D05 | Application-enforced auth + RLS as a safety net | Better Auth is not natively integrated with Supabase JWT; all access is already server-side | Custom JWT claim for Supabase RLS (more complex setup for the MVP) |
| DB-D05a | Exception to DB-D05 for the BC-04 tables (`mcp_grants`, `mcp_audit_logs`; `mcp_rate_limit_windows` and `mcp_workspace_choices` added through ADR-152): RLS enabled with one `app_runtime` policy (`USING (true) WITH CHECK (true)`), without per-workspace/user isolation at the DB level (ADR-141) | Callers use an OAuth token without `app.current_user_id`, and system paths (JOB-08 purge, consent hook) have no user; isolation lives in the application layer | A per-`user_id` policy via `withCurrentUser(sub)` + a `SECURITY DEFINER` function (extra work and risk, the safety net is not worth it) |
| DB-D06 | `created_at` and `updated_at` on all tables | Minimal audit trail standard; needed for sync, debugging, and cursor pagination | Only `created_at` (loses the ability to track update times) |
| DB-D07 | `outstand_webhook_events` as a durable idempotent receipt | Guarantees events are stored before ACK and separates vendor delivery from internal processing | ACK before persist; payload only in the job queue |
| DB-D08 | MVP Engagement schema is only comments/replies | Aligned with the Outstand contract and the source of JOB-03/manual sync | Store DMs/mentions that cannot be synchronized |
| DB-D09 | ADR-040 | DB-D07–D08 and the media working copy metadata amend the old conceptual schema | — |
| DB-D10 | Anonymous Start Page access through `SECURITY DEFINER` functions (read and counter), not an `anon` RLS policy | RLS cannot restrict columns (`workspace_id`, counters leak through PostgREST); an `app_runtime` policy weakens tenant isolation | An `anon`/`app_runtime` policy directly on the table; a limited-column view (ADR-142, ADR-143) |

---

# Related Documents

* `domain-model.md` — the foundation of entities and relations mapped to these database tables
* `application-layer.md` — how the application layer interacts with the database *(next document)*
* `integration-layer.md` — the Outstand Comments API/JOB-03 that fills `engagement_inbox_items`, the webhook receipt for publishing/account status, and analytics polling
* `background-jobs.md` — background jobs that access ~~`publishing_queue_slots`~~ (deprecated, ADR-083) and `analytics_post_metrics`
* `realtime-strategy.md` — Supabase Realtime for `notifications`
* `auth-architecture.md` — Better Auth and RLS details — `workspace_members` as the authorization table
* `../02-product/roles-permissions.md` — roles and canonical content status
* `../../project-os/DECISIONS.md` — ADR-014, ADR-015 (new decisions from this session)
