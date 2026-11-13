# Database & ORM

This document defines the **data access strategy, ORM, schema migrations, and connection pooling** for the Postific product.

This document is the concrete implementation of the **Database Strategy** (`../05-architecture/database-strategy.md`, ADR-015), the **Repository Pattern** (ADR-017 as amended by ADR-031), and Better Auth's connection needs (`auth-strategy.md`, ADR-030). The table schema and RLS policies still refer to the Architecture Baseline — this document focuses on tooling and operational patterns.

---

# Goals

- Set Prisma as the formal ORM for domain persistence.
- Define the usage boundary between Prisma and the Supabase client.
- Set the schema migration strategy (Prisma Migrate) across Staging and Production.
- Set connection pooling and connection URLs (runtime vs migration).
- Align Better Auth with the same Prisma / PostgreSQL.
- Serve as the reference for Repository & Bootstrap (M7) to initialize the Prisma schema and client.

---

# Locked Decisions (from Baseline)

| Topic               | Decision                                                                | Source                          |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------- |
| Database Platform   | Supabase PostgreSQL Cloud                                               | ADR-015, `database-strategy.md` |
| Schema              | Single `public` schema, domain prefix (+ exception ADR-027)             | ADR-014, ADR-027                |
| Multi-tenancy / RLS | App-layer auth is primary; RLS defense-in-depth via `app.current_user_id` | DB-D05                        |
| Repository Pattern  | Interface in the domain; one repo per Aggregate Root                    | ADR-017                         |
| Auth tables         | `identity_` prefix, managed by Better Auth                              | DB-D04, ADR-030                 |
| Storage             | Supabase Storage                                                        | `database-strategy.md`          |
| Realtime            | Supabase Realtime for `notifications`                                   | ADR-023                         |
| Environment         | Separate Supabase projects for prod / staging                           | ADR-029                         |

---

# Database & ORM Decisions (Set in This Document)

| ID     | Topic                  | Decision                                                                                                                                                                                         |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DO-D01 | Formal ORM             | **Prisma** — repository implementations use the Prisma Client                                                                                                                                    |
| DO-D02 | Supabase client boundary | The Supabase JS client is **only** for Realtime and Storage — not for domain CRUD                                                                                                              |
| DO-D03 | Schema migrations      | **Prisma Migrate** as the source of truth for migrations in the repository                                                                                                                       |
| DO-D04 | Connection pooling     | Supabase **Supavisor**: `DATABASE_URL` (pooled) for runtime; `DIRECT_URL` for migrate                                                                                                            |
| DO-D05 | Better Auth ↔ Prisma   | Better Auth uses the Prisma adapter/connection to the same DB; the `identity_*` tables are in the Prisma schema                                                                                  |
| DO-D06 | RLS with Prisma        | Primary authorization stays in the Application Service; before a sensitive query, the server sets `app.current_user_id` via Prisma (`$executeRaw` / transaction) so the RLS safety net is active |

---

# Data Access Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Application Service (domain)                                    │
│    → calls IXxxRepository only                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Repository Implementation (`src/lib/repositories/…`)             │
│    → Prisma Client (CRUD, transactions, row ↔ entity mapping)    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL (via Supavisor / direct)                    │
└─────────────────────────────────────────────────────────────────┘

Separate paths (not domain CRUD):
┌──────────────────┐     ┌────────────────────────────────────────┐
│ Supabase Storage │     │ Supabase Realtime (browser + JWT)       │
│ (server upload)  │     │ — auth-strategy.md AS-D03               │
└──────────────────┘     └────────────────────────────────────────┘
         ▲
         │ Supabase JS client (service role on the server / anon on the client)
```

**Boundary principles (DO-D01, DO-D02):**

- Domain CRUD → Prisma only.
- Media files → the Supabase Storage client.
- Live notifications → the Supabase Realtime client.
- The Application Service does not import the Prisma Client or the Supabase client directly.

---

# Prisma Setup

## Location in the Monorepo

Aligned with `monorepo-setup.md`:

```
apps/web/
├── prisma/
│   ├── schema.prisma           ← models + datasource
│   └── migrations/             ← Prisma Migrate artifacts (version-controlled)
└── src/lib/
    ├── prisma/
    │   └── client.ts           ← singleton PrismaClient (server-only)
    ├── supabase/
    │   ├── client.ts           ← browser (Realtime)
    │   ├── server.ts           ← server (Storage; not domain CRUD)
    │   └── middleware.ts
    ├── better-auth/
    │   └── auth.ts
    └── repositories/           ← implementation via Prisma
```

## Datasource & Generator (reference)

Prisma **7+**: the connection URL is no longer in `schema.prisma`. The DO-D04 semantics stay the same — split between the migrate CLI and the runtime client.

```prisma
// apps/web/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

```ts
// apps/web/prisma.config.ts — CLI migrate / introspect
datasource: {
  url: env("DIRECT_URL"), // direct/session — not pooled
}
```

```ts
// apps/web/src/lib/prisma/client.ts — runtime
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter }); // pooled Supavisor
```

> A structural reference. The table models follow `database-strategy.md`.

## Prisma Client Lifecycle

- Instantiate **one** `PrismaClient` per Node/Bun process (a singleton in `src/lib/prisma/client.ts`).
- Imported only from server code (Repository, Better Auth config, job runner) — not from Client Components.
- In development, use the globalThis pattern so hot-reload does not open too many connections.

---

# Connection Pooling (DO-D04)

Supabase provides a connection pooler (**Supavisor**). Prisma distinguishes two URLs:

| Env Var        | Mode                                    | Used for                                                                                           |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Pooled (transaction mode / pooler port) | Application runtime: Next.js Server Components, Server Actions, Route Handlers, Better Auth        |
| `DIRECT_URL`   | Session / direct to Postgres            | `prisma migrate`, `prisma db push` (local), introspect                                             |

**Rules:**

- Do not run migrations through the pooled URL — use `DIRECT_URL`.
- Different credentials per environment (prod vs staging) — aligned with DI-D03.
- The full env var naming details are in `environment-management.md`.

Connection bottlenecks are mitigated by the pooler (not by adding Railway instances) — aligned with `deployment-infrastructure.md`.

---

# Migration Strategy (DO-D03)

## Tooling

| Aspect               | Decision                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Primary tool         | **Prisma Migrate** (`prisma migrate dev` / `prisma migrate deploy`)                                      |
| Artifacts            | `apps/web/prisma/migrations/` in Git                                                                     |
| Staging → Production | Migrate on the Supabase staging project first, then production (DI-D03)                                  |
| Rollback             | Prefer **expand-and-contract** + forward-fix migrations; avoid `migrate reset` in shared environments    |

The architecture note in `database-strategy.md` that previously named the Supabase CLI as the migration tooling is **superseded** by this M6 decision for domain migrations. The Supabase CLI may still be used for platform tasks (e.g. generating types locally, inspecting the project), but it is **not** the source of truth for the application schema.

## Workflow

```
1. Change prisma/schema.prisma
2. prisma migrate dev --name <description>   ← against the staging project that local shares (EM-D02, ADR-081)
3. Review the SQL in prisma/migrations/
4. Merge via CI (quality gate — cicd-pipeline.md)
5. Deploy to staging → prisma migrate deploy (staging DIRECT_URL)
6. Verify staging
7. Deploy to production → prisma migrate deploy (production DIRECT_URL)
```

## Bootstrap Order (M7)

1. Initialize the Prisma schema + datasource.
2. `identity_*` table models / migrations aligned with Better Auth (+ the Prisma adapter).
3. Domain table migrations per `database-strategy.md` (including `background_jobs`, `outstand_webhook_events`, RLS policies as SQL in migrations or a separate script tracked in the repo).
4. Minimal seed only if needed for local/staging — not production user data.

The ADR-040 alignment uses the additive migration `20260723121000_align_outstand_contract` for the durable webhook receipt, reconnect state, Outstand media metadata, and Engagement constraints. Application status and runtime implementation refer only to `PROJECT_STATE.md`.

## RLS Policies in Migrations

SQL policies (`ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, helper functions for `app.current_user_id`) are stored as part of the Prisma migrations (raw SQL in the migration folder) so the schema + policies stay in step across both Supabase projects.

## Shadow Database & External Tables (ADR-073)

Every `prisma migrate dev` replays the **entire** migration history into an
empty shadow database for validation. A migration containing raw SQL against
tables owned by another platform (e.g. `storage.buckets`, owned by Supabase
Storage, not a Prisma model) fails (**P3006**) because that table does not
exist in the freshly created empty shadow DB.

Decision (**ADR-073**): use the official **Prisma 7 External Tables** feature,
configured in `apps/web/prisma.config.ts`:

| Config field                           | Purpose                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `experimental.externalTables: true`    | Enables external table support                                                                                  |
| `tables.external: ["storage.buckets"]` | Marks tables owned by another platform, not managed by Prisma                                                   |
| `migrations.initShadowDb`              | The setup SQL content (external table stubs) that Prisma runs against the shadow DB before replaying the migration history |

The stub SQL itself is kept in a separate file so it is reviewable
(`apps/web/prisma/shadow-init.sql`), read via `readFileSync` in
`prisma.config.ts` — **important note**: `migrations.initShadowDb` in
Prisma 7.8.0 expects the SQL script content (a string), not a file path.

This approach is purely configuration (`prisma.config.ts` + one SQL file) —
it does not change `schema.prisma` or any migration.sql that has already been applied in
any DB. The shadow DB is ephemeral (created and dropped automatically by Prisma
on every run), so there is no state to undo on rollback.

---

# Repository Implementation with Prisma

Aligned with ADR-017 (amended) and `application-layer.md`:

| Rule           | Detail                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Interface      | In `src/domains/<bc>/` (e.g. `IPostRepository`)                                                     |
| Implementation | In `src/lib/repositories/<bc>/` using the Prisma Client                                             |
| Mapping        | The repository maps Prisma model ↔ domain entity / aggregate                                        |
| Transactions   | Use `prisma.$transaction` for multi-aggregate operations that must be atomic within a single BC     |
| Soft delete    | Respect `deleted_at` on `publishing_posts` (`database-strategy.md`)                                 |

The Application Service does **not** import `@prisma/client` or `src/lib/prisma/client` directly.

## Durable Webhook Receipt (ADR-040)

The system repository for webhooks runs a single Prisma transaction:

1. Insert `outstand_webhook_events` with a deterministic unique vendor event identity/fingerprint.
2. If the receipt is new, insert a `background_jobs` row of type `outstand.webhook.process` that references the receipt ID.
3. Commit the transaction, and only then does the Route Handler return `2xx`.
4. If it is a duplicate, no second job is created and it may still ACK `2xx`.

The raw body is stored after the HMAC is valid so JOB-01 can process the same payload without depending on Outstand re-delivery. `processing_attempts`/receipt status records internal processing; vendor delivery attempts are not mixed into those columns.

---

# RLS with Prisma (DO-D06)

The dual-context pattern from `auth-strategy.md` still applies; the only thing that changes is **how the server talks to Postgres** for Context 1:

**Context 1 — Server-side (domain CRUD via Prisma)**

1. Better Auth session → `userId`.
2. Within a transaction / before the query:  
   set `app.current_user_id = '<userId>'` (via Prisma `$executeRaw`,
   the function `set_config('app.current_user_id', <userId>, true)` — not
   the literal `SET LOCAL app.current_user_id = <userId>`, because `SET LOCAL`
   does not accept the value as a bound parameter; `set_config(...)` is safe
   to use with a Prisma tagged template so `userId` stays a bound
   parameter, not a manual string concat).
3. Subsequent Prisma queries run in the same connection/transaction.
4. Business authorization stays in the Application Service (RBAC); RLS is a safety net.

> **Correction (2026-08-13, T-017):** SQL policies that compare
> `app.current_user_id` must **not** cast to `::uuid` — Better
> Auth's `identity_user.id` is a `cuid()` string (`text`), not a UUID, and
> the `user_id` column in domain tables is also `text`. Compare as text
> directly: `wm.user_id = current_setting('app.current_user_id', true)`.
> `workspace_id` is still `uuid` in all domain tables, so the `::uuid` cast
> is still used for that side. The wrapper implementation is in
> `apps/web/src/lib/prisma/with-current-user.ts` (the `withCurrentUser` function).
>
> **Runtime status note:** the `DATABASE_URL`/`DIRECT_URL` connections currently
> use the Postgres role `postgres`, which in Supabase has the
> `BYPASSRLS` attribute by default — RLS is not yet effectively active in the
> real runtime until the connection is moved to a role without `BYPASSRLS` (see Known
> Issues in `PROJECT_STATE.md`). RLS is still correct by SQL design; this is
> an infra/role gap, not a policy design gap.

**Context 2 — Realtime** does not use Prisma — it is still the Supabase-compatible JWT + the Supabase Realtime client (AS-D03).

> Note: if a query uses a role that bypasses RLS (e.g. a privileged connection), the Application Service remains the primary authorization enforcer (DB-D05). `SET LOCAL` is mandatory for paths that rely on RLS policies.

---

# Better Auth + Prisma (DO-D05)

| Aspect      | Decision                                                                               |
| ----------- | -------------------------------------------------------------------------------------- |
| Database    | The same Supabase PostgreSQL as the domain tables                                      |
| Integration | Better Auth **Prisma adapter** (or an official equivalent that writes to Prisma models) |
| Schema      | The `identity_*` models are defined in `schema.prisma` so there is a single migrate    |
| Connection  | Uses the same pooled `DATABASE_URL` as the application                                 |
| Session     | Database session (AS-D02) — the session table is managed by Better Auth through the adapter |

This completes the placeholder in `auth-strategy.md`: Better Auth's driver/dialect = the Prisma path to `DATABASE_URL`.

---

# Supabase Client — Narrow Scope (DO-D02)

| Use the Supabase client                | Do not use the Supabase client                                  |
| -------------------------------------- | --------------------------------------------------------------- |
| Storage upload / signed URL            | `select` / `insert` / `update` / `delete` on domain tables      |
| Subscribe to Realtime `notifications`  | Job queue CRUD (`background_jobs`)                              |
| Storage bucket admin operations        | Analytics / engagement / publishing queries                     |

Supabase Storage stores the original media. The Outstand working copy flow (request upload URL → `PUT` → confirm) is HTTP through the ACL, not Supabase/Prisma CRUD. Outstand media metadata may optionally be persisted via the Media repository.

Domain repositories must **not** depend on `@supabase/supabase-js` for persistence.

---

# Local Development

| Aspect          | MVP approach                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Local DB target | The same Supabase Cloud project as staging (EM-D02, ADR-033, amendment to ADR-081) — no local↔staging isolation                 |
| Local migrate   | `prisma migrate dev` with `DIRECT_URL` from `.env.local`                                                                        |
| Generate client | `prisma generate` after changing the schema (hook in install/bootstrap)                                                         |
| Seed            | Optional on local; do not rely on staging/production data                                                                       |

The Bun script details (`db:migrate`, `db:generate`) are set in `dx-tooling.md` (DX-D04).

---

# Decision Log

| ID     | Decision                                                              | Reason                                                                                                      | Alternatives                                                                                     |
| ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DO-D01 | Prisma as the formal ORM; repositories via the Prisma Client          | Type-safe persistence, clear migrate, aligned with earlier stack decisions & ORM portability                | Supabase client only; Drizzle                                                                    |
| DO-D02 | Supabase client only for Realtime + Storage                           | Platform features are not replaced by the ORM; avoids dual-write CRUD                                       | Prisma for everything (not feasible); Supabase client for CRUD too (blurs the boundary)          |
| DO-D03 | Prisma Migrate as the migration source                                | One toolchain with the ORM; reviewable in Git; deploys to two Supabase projects                             | Supabase CLI as the main source (M5 note)                                                        |
| DO-D04 | Supavisor: pooled `DATABASE_URL` + `DIRECT_URL` migrate               | Prevents connection exhaustion in Next.js; migrate needs a direct session                                   | Direct-only (risk of connection exhaustion); pooled-only for migrate (often fails)               |
| DO-D05 | Better Auth via the Prisma adapter on the same DB                     | One schema/migrate path; consistent with AS-D01                                                             | Better Auth raw SQL driver separate from the Prisma schema                                       |
| DO-D06 | `SET LOCAL app.current_user_id` via Prisma for RLS                    | Keeps the DB-D05 defense-in-depth after moving from Supabase JS to Prisma                                   | Disable RLS entirely (removes the safety net)                                                    |
| DO-D07 | Webhook receipt + JOB-01 created atomically before ACK                | No gap of a stored receipt without a job or an ACK without durable state                                    |
| DO-D08 | Original media stays in Storage; Outstand working copy metadata optional | Asset ownership does not move to the publishing provider                                                 |
| DO-D09 | ADR-040                                                               | DO-D07–D08 amend the operational database model of the Engineering Baseline                                 |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `monorepo-setup.md` — location of `src/lib/repositories/`, `src/lib/prisma/`
- `auth-strategy.md` — Better Auth, dual-context RLS, `DATABASE_URL`
- `deployment-infrastructure.md` — staging/prod Supabase, expand-and-contract rollback
- `cicd-pipeline.md` — `prisma migrate deploy` in the Railway release/pre-start (CI-D05, ADR-032)
- `environment-management.md` — `DATABASE_URL`, `DIRECT_URL`, secrets, local sharing the staging project (ADR-033, ADR-081)
- `dx-tooling.md` — local migrate/generate scripts (ADR-034)
- `../05-architecture/database-strategy.md` — table schema, RLS, soft delete
- `../05-architecture/application-layer.md` — Repository Pattern
- `../../project-os/DECISIONS.md` — ADR-017 (amended), ADR-031
