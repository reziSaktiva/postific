# Deployment & Infrastructure

This document defines the **deployment platform, region, environment topology, and infrastructure strategy** for the Postific product.

This document is the concrete implementation of the pre-architecture decisions (Railway as the deployment platform, Supabase as the database/storage/realtime) and sets the operational details that were not yet decided: the hosting region, the number of environment tiers, and the Supabase project per environment strategy.

---

# Goals

- Set the hosting platform and region definitively before Repository & Bootstrap (M7).
- Define the environment topology (production, staging) and the responsibilities of each.
- Set the Supabase project per environment strategy.
- Define the service architecture on Railway (web app + cron).
- Set a build & deploy pipeline aligned with the Bun Workspaces monorepo.
- Set the domain, TLS, scaling, and rollback strategy for the MVP.

---

# Pre-Architecture Decisions

The following decisions were set before this document was created and are the foundation:

| Topic             | Decision                                                | Source                                          |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------- |
| App Hosting       | Railway                                                 | pre-architecture decision (ADR-025 summary)     |
| Database Platform | Supabase PostgreSQL Cloud                               | `database-strategy.md` (ADR-015)                |
| Storage           | Supabase Storage                                        | `database-strategy.md`                          |
| Realtime          | Supabase Realtime (in-app notifications)                | `realtime-strategy.md` (ADR-023)                |
| Background Jobs   | PostgreSQL job queue + Railway Cron as the trigger      | `background-jobs.md` (ADR-022)                  |
| Runtime           | Bun                                                     | ADR-002                                         |
| Framework         | Next.js (App Router)                                    | ADR-003                                         |
| Monorepo          | Hybrid Monorepo — `apps/web` as a single deployment unit | ADR-001, ADR-026                               |

---

# Deployment Decisions (Set in This Document)

| ID     | Topic                    | Decision                                                                                                                                              |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| DI-D01 | Region                   | **Singapore / Southeast Asia** — Railway and Supabase co-located in the SEA region for the lowest latency to the target market (Marketing Team Indonesia) |
| DI-D02 | Environment Topology     | **Production + Staging** — two persistent environments; staging mirrors production for pre-release testing                                             |
| DI-D03 | Supabase per Environment | **Separate Supabase projects** per environment (production & staging) — full data isolation                                                            |
| DI-D04 | Service Architecture     | Two Railway services per environment: **`web`** (Next.js) and **`cron`** (background job trigger)                                                      |
| DI-D05 | Deploy Trigger           | Automatic deploy from Git — branch `main` → production, branch `staging` → staging                                                                     |
| DI-D06 | Rollback                 | Redeploy from the previous deployment (Railway immutable deployments) + reversible Supabase migrations                                                 |

---

# Platform Overview

The MVP infrastructure consists of two providers with separate responsibilities:

```
┌────────────────────────────────────────────────────────────┐
│                        RAILWAY (SEA)                          │
│                                                               │
│   ┌──────────────────┐          ┌──────────────────┐         │
│   │   web service    │          │   cron service   │         │
│   │   (Next.js/Bun)  │          │  (Railway Cron)  │         │
│   │                  │          │                  │         │
│   │  - App Router    │          │  calls           │         │
│   │  - Server Actions│          │  POST /api/jobs/ │         │
│   │  - Route Handlers│          │  run (web) on    │         │
│   │  - Middleware    │          │  schedule        │         │
│   └────────┬─────────┘          └────────┬─────────┘         │
└────────────┼─────────────────────────────┼──────────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────────────────────────────────────────┐
│                    SUPABASE (SEA, ap-southeast-1)             │
│                                                               │
│   PostgreSQL  ·  Storage (media bucket)  ·  Realtime          │
└────────────────────────────────────────────────────────────┘
```

**Division of responsibilities:**

- **Railway** — runs the Next.js application and the cron scheduler. The compute layer.
- **Supabase** — provides PostgreSQL (data), Storage (media), and Realtime (notifications). The managed data layer.

The Outstand API (social media integration) is an external dependency accessed from the `web` service via the OutstandAdapter (`integration-layer.md`), and is not deployed by us.

---

# Region & Latency

## Region Choice (DI-D01)

| Component | Region                       |
| --------- | ---------------------------- |
| Railway   | Southeast Asia (Singapore)   |
| Supabase  | `ap-southeast-1` (Singapore) |

**Reasons:**

- The main target market is the **Marketing Team in Indonesia** — the SEA region gives the lowest latency.
- Railway and Supabase are **co-located** in Singapore — minimizing the round trip between the compute layer and the database (queries, RLS, storage signed URLs).
- The Outstand API is an asynchronous/background call for most operations (publishing, sync), so latency to the provider is not on the UX critical path.

**Consequence:** all environments (production and staging) use the same region to keep parity.

---

# Environment Topology

## Two Persistent Tiers (DI-D02)

| Aspect              | Production                                                                              | Staging                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Purpose             | Serve real users                                                                        | Pre-release testing, QA, internal demos                                                      |
| Git branch          | `main`                                                                                  | `staging`                                                                                    |
| Railway environment | `production`                                                                            | `staging`                                                                                    |
| Supabase project    | Separate project (prod)                                                                 | Separate project (staging)                                                                   |
| Domain              | production domain (custom)                                                              | staging subdomain (e.g. `staging.<domain>`)                                                  |
| Data                | Real user data                                                                          | Dummy / sanitized data — must not contain production data                                    |
| Outstand            | Production API/webhook credentials; prod X BYOK configured manually in the Outstand dashboard | Staging API/webhook credentials; staging/test X BYOK configured separately if available |
| Access              | Public                                                                                  | Restricted (internal team)                                                                   |

**Principles:**

- Staging is a **structural mirror** of production — identical configuration, migrations, and versions; only the data and credentials differ.
- Changes must pass through staging before being promoted to production.
- Per-PR preview environments (ephemeral) are **not** used in the MVP to hold down complexity and cost — they can be added post-MVP if contribution volume increases.

---

# Supabase Project per Environment (DI-D03)

Each environment has a **separate Supabase project**:

```
Supabase Org
├── social-media-prod       ← used by the Railway environment "production"
└── social-media-staging    ← used by the Railway environment "staging"
```

**Reasons:**

- Full data isolation — no risk of staging reading/writing production data.
- Migrations can be tested on the staging project before being applied to production.
- Credentials (service role key, JWT secret, connection string) are separate and do not leak to each other.

**Consequences:**

- Migrations must be run on both projects (staging first, then production) — see `database-orm.md` for the migration workflow.
- Each environment holds its own set of Supabase env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, etc.) — see `environment-management.md`.

---

# Railway Service Architecture (DI-D04)

Each Railway environment contains two services:

## 1. `web` Service — Next.js Application

| Aspect         | Configuration                                                                 |
| -------------- | ----------------------------------------------------------------------------- |
| Runtime        | Bun                                                                           |
| Root directory | monorepo root (the build needs workspace access)                              |
| Install        | `bun install` (at the root — one lockfile for the whole monorepo)             |
| Build          | `bun run build` → builds `apps/web` (Next.js)                                 |
| Start          | `bun run --cwd apps/web start`                                                |
| Port           | Railway injects `PORT` — Next.js listens on `$PORT`                           |
| Health check   | `GET /api/health` (Route Handler, already present in monorepo-setup)          |

This service runs all the entry points: the App Router (UI), Server Actions (mutations), Route Handlers (Outstand webhook, job runner, health), and Middleware (auth guard + workspace context).

## 2. `cron` Service — Background Job Trigger

Aligned with ADR-022 (`background-jobs.md`): Railway Cron acts as the **trigger**, not the executor. It calls the job runner endpoint on the `web` service periodically.

| Aspect     | Configuration                                                                |
| ---------- | ---------------------------------------------------------------------------- |
| Mechanism  | Railway Cron schedule                                                        |
| Action     | `POST /api/jobs/run` to the `web` service                                    |
| Protection | The `X-Job-Secret` header is compared against an env var (`auth-architecture.md`) |
| Frequency  | As the job queue needs (e.g. every 1 minute) — details in `background-jobs.md` |

The `web` service then pulls jobs from the `background_jobs` table using `SELECT FOR UPDATE SKIP LOCKED` and executes them. This logic is unchanged from the architecture — this document only sets that the trigger is deployed as Railway Cron.

The JOB-03 comments sync is scheduled every 30 minutes and can also be triggered manually through the Application Service. JOB-01 only processes the internal durable receipt; webhook delivery retries remain Outstand's mechanism, which ends after a `2xx` ACK.

---

# Build & Deploy Pipeline

## Deploy Trigger (DI-D05)

```
git push origin staging   ──►  Railway (staging env)  ──►  build & deploy web + cron
git push origin main       ──►  Railway (production env) ──►  build & deploy web + cron
```

- Deploys are triggered automatically by a push to the branch mapped to each environment.
- The quality gates (typecheck, lint, test, prisma validate) run in **GitHub Actions** before merge — see `cicd-pipeline.md` (ADR-032). Railway only builds after the code enters the environment branch; `prisma migrate deploy` runs in the release/pre-start.

## Build Notes for the Bun Monorepo

- `bun install` runs at the monorepo **root** because the lockfile (`bun.lock`) and the workspace protocol (`@postific/shared`) are at the root.
- The build only produces artifacts for `apps/web` — `packages/shared` is resolved as a workspace source (no separate build needed in the MVP).
- The Next.js output mode and detailed build configuration are set during Repository & Bootstrap (M7); this document sets the command and the runtime.

---

# Domain, Networking & TLS

| Aspect            | MVP decision                                                                         |
| ----------------- | ------------------------------------------------------------------------------------ |
| Production domain | A custom domain attached to the Railway `web` service (production)                   |
| Staging domain    | A separate subdomain (e.g. `staging.<domain>`) or the default `*.up.railway.app` domain |
| TLS               | Automatic via Railway (Let's Encrypt) — HTTPS is required in all environments        |
| Cookie `Secure`   | `true` in production & staging (both HTTPS) — aligned with `auth-strategy.md`        |

The final domain name is decided at go-live; this document sets that production uses a custom domain and staging uses a separate subdomain so cookies/CORS are isolated.

---

# Scaling Strategy (MVP)

| Aspect             | MVP decision                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Horizontal scaling | Not in the MVP — a single instance per service                                             |
| Vertical scaling   | Raise the Railway service resources if needed                                              |
| Statelessness      | The `web` service is stateless — session in cookie + DB, no in-memory state                |
| Database scaling   | Managed by Supabase (managed) — connection pooling via Supabase (see `database-orm.md`)    |
| Main bottleneck    | Database connections — mitigated with connection pooling, not by adding instances          |

Because the `web` service is stateless, horizontal scaling can be added post-MVP without an architecture change. The job runner is concurrency-safe through `SKIP LOCKED` (ADR-022), so running more than one instance does not cause double-processing.

---

# Rollback Strategy (DI-D06)

| Layer               | Rollback Mechanism                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Application (Railway) | Redeploy the previous deployment — Railway keeps an immutable deployment history              |
| Database (Supabase) | Reversible migrations; every migration has a down/rollback — see `database-orm.md`              |
| Config/Secrets      | Env vars are versioned per environment; changes are recorded — see `environment-management.md`  |

**Principle:** an application rollback must be safe against the database schema. Breaking schema changes are applied with the **expand-and-contract** pattern (add the column/table first, remove it after the old code is no longer used) so an application rollback does not collide with the new schema.

---

# Secrets & Environment Variables (Summary)

Each environment holds its own set of env vars in Railway. The main categories:

| Category    | Examples                                                                            |
| ----------- | ----------------------------------------------------------------------------------- |
| Supabase    | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`  |
| Auth        | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Integration | `OUTSTAND_API_KEY`, `OUTSTAND_WEBHOOK_SECRET`                                       |
| Jobs        | `JOB_SECRET` (X-Job-Secret)                                                         |

The full details of naming, sources, and secret management are defined in `environment-management.md`. This document only sets that **secrets are not shared across environments** — a direct consequence of DI-D03.

**X/Twitter operational prerequisite:** the Project Owner fills in the X BYOK directly in the Outstand dashboard for the relevant environment. There is no Railway Variable for the X Client ID/Client Secret and no X secret passes through the application.

**Media path:** the `web` service reads the original from Supabase Storage, requests an Outstand upload URL, performs a `PUT`, then confirms. Supabase→Railway/Outstand egress and upload timeouts need to be monitored; the Outstand working copy URL is used when scheduling.

---

# Decision Log

| ID     | Decision                                                                   | Reason                                                                                              | Alternatives                                                                                           |
| ------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DI-D01 | Singapore / Southeast Asia region for Railway + Supabase                   | Lowest latency to the Indonesian target market; compute↔DB co-location                              | US (mature ecosystem but high latency to ID); mixed regions (adds an app↔DB round trip)                |
| DI-D02 | Production + Staging (two persistent tiers)                                | Staging as a mirror for pre-release testing without touching production data                        | Production-only (no safe place to test); +per-PR preview (excessive complexity & cost for the MVP)     |
| DI-D03 | Separate Supabase project per environment                                  | Full data isolation, migrations can be tested on staging first, separate credentials                | One shared Supabase project (risk of staging touching prod data)                                       |
| DI-D04 | Two Railway services per environment: `web` + `cron`                       | Separates the cron trigger from the app; aligned with ADR-022 (Railway Cron as the trigger)         | Cron inside the web process (less explicit, hard to schedule independently)                            |
| DI-D05 | Automatic deploy from the branch (`main`→prod, `staging`→staging)          | A simple and deterministic deploy flow; quality gate in CI before merge                             | Manual deploy (prone to human error); deploy from a tag (adds release overhead for the MVP)            |
| DI-D06 | Rollback via a Railway redeploy + reversible migrations + expand-and-contract | Rollback is safe against the DB schema; no state is lost                                         | App-only rollback (can collide with the new schema)                                                    |
| DI-D07 | JOB-03 scheduled every 30 minutes; JOB-01 internal processing only         | Runs the main Engagement source and separates two kinds of retry                                    |
| DI-D08 | X BYOK configured manually per environment in the Outstand dashboard       | The application does not become a custodian of the X platform's secret                              |
| DI-D09 | ADR-040                                                                    | DI-D07–D08 and the working copy media path amend the operational baseline                           |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `monorepo-setup.md` — build structure (`apps/web`, Bun Workspaces)
- `auth-strategy.md` — cookie `Secure` configuration, `BETTER_AUTH_URL` per environment
- `database-orm.md` — migration workflow across Supabase projects
- `environment-management.md` — env var & secret details per environment (ADR-033)
- `cicd-pipeline.md` — GitHub Actions gates, migrate on release (ADR-032)
- `../../product-discovery/05-architecture/background-jobs.md` — Railway Cron as the job trigger (ADR-022)
- `../../product-discovery/05-architecture/database-strategy.md` — Supabase PostgreSQL, Storage
- `../../project-os/DECISIONS.md` — ADR-028, ADR-029
