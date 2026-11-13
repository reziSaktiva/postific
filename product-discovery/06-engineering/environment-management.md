# Environment Management

This document defines the **environment variables catalog, secret management strategy, and per-tier configuration** (local, staging, production) for the Postific product.

This document makes the credential isolation consequences of `deployment-infrastructure.md` (DI-D03, ADR-029) and the CI secret policy of `cicd-pipeline.md` (CI-D06) concrete. The MVP database hosting stays **Supabase Cloud**; the migration path to self-host is recorded as a plan for after the schema stabilizes, not part of the M7 bootstrap.

---

# Goals

- Set the source of truth for env var naming across the whole application.
- Separate secrets per environment (local / staging / production) without sharing credentials.
- Define how a developer runs the app locally against Supabase Cloud.
- Set where secrets are stored (Railway, Supabase dashboard, `.env.local`) and what may enter Git.
- Record the cloud → self-host plan without locking in self-host tooling now.

---

# Locked Decisions (from Baseline)

| Topic               | Decision                                                | Source          |
| ------------------- | ------------------------------------------------------- | --------------- |
| Deploy topology     | Production + Staging (Railway)                          | ADR-029, DI-D02 |
| Supabase project    | Separate per deploy environment                         | ADR-029, DI-D03 |
| Secrets in PR CI    | Not required / does not store production secrets        | CI-D06, ADR-032 |
| DB runtime URLs     | `DATABASE_URL` (pooled) + `DIRECT_URL` (migrate)        | DO-D04, ADR-031 |
| Auth URLs & OAuth   | `BETTER_AUTH_*`, Google OAuth separate per env          | AS-D05, ADR-030 |

---

# Environment Management Decisions (Set in This Document)

| ID     | Topic                                                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EM-D01 | MVP DB platform                                          | **Supabase Cloud** for local, staging, and production. Self-host is deferred until the schema & cloud operations are stable (see the Cloud → Self-host section).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| EM-D02 | Local database _(ADR-081 amendment — final 2026-08-14)_  | ~~A separate Supabase Cloud project `social-media-local`.~~ The **existing** Supabase Cloud project ("Sosial Media Management", ref `ndcrkzqgqukqfmekgoze`, region `ap-southeast-1`) is officially designated the **staging** project — no longer called/used as the "local" project. There is no longer a plan to create a new `social-media-local` project. **Final:** local development officially **shares** the same staging project — developers fill in `.env.local` with this staging project's credentials, with no local↔staging database isolation. See the Environment Tiers section. |
| EM-D03 | Secret management                                        | **Native only** — Railway Variables (staging/prod), the Supabase dashboard (project credentials), `.env.local` (local, gitignored). No Doppler/Infisical/Vault in the MVP.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| EM-D04 | Env files in the repo                                    | Location: `apps/web/`. Commit `.env.example` (placeholders, no secrets). Do not commit `.env`, `.env.local`, `.env.*.local`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| EM-D05 | Env validation                                           | Fail-fast at server startup for required server vars; the client may only read `NEXT_PUBLIC_*`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| EM-D06 | Credential isolation                                     | One set of secrets per tier; **forbidden** to copy production secrets to local/staging or vice versa. **Explicit exception (ADR-081):** the local↔staging pair is knowingly excepted from this rule — local deliberately shares the same staging project (see EM-D02, EM-D09/EM-D10). EM-D06 still applies in full to staging↔production and local↔production — not excepted.                                                                                                                                                                                                                                                                                                                           |

---

# Environment Tiers

> **ADR-081 amendment (final 2026-08-14):** the diagram and table below
> reflect current reality — the existing Supabase Cloud project ("Sosial
> Media Management", ref `ndcrkzqgqukqfmekgoze`) is officially the
> **staging** project, replacing the plan for separate `social-media-local` +
> `social-media-staging`. **Local development officially shares the same
> staging project** — no longer an open question.

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ Local           │     │ Staging          │     │ Production        │
│ Next.js @ :3000 │     │ Railway staging  │     │ Railway production│
│ .env.local      │     │ Railway Variables│     │ Railway Variables │
└────────┬────────┘     └────────┬─────────┘     └─────────┬─────────┘
         │                       │                         │
         └───────────┬───────────┘                         ▼
                      ▼                          ┌───────────────────┐
         ┌──────────────────────────┐            │ social-media-prod │
         │ Sosial Media Management  │            │ (not yet created —│
         │ ref ndcrkzqgqukqfmekgoze │            │ KI-028)            │
         │ (local + staging, one    │            └───────────────────┘
         │ and the same project)    │
         └──────────────────────────┘
```

| Tier       | Compute                                   | Supabase project                                                                                                                                                                | Env source                                                |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Local      | `bun run dev` on a laptop                 | **"Sosial Media Management"** (ref `ndcrkzqgqukqfmekgoze`) — **the same project as staging**, no isolation (ADR-081, final)                                                     | `.env.local` — filled with the staging project's credentials |
| Staging    | Railway env `staging` (`web` + `cron`)    | **"Sosial Media Management"** (ref `ndcrkzqgqukqfmekgoze`, the existing project — not a new `social-media-staging` project) _(ADR-081)_                                         | Railway Variables                                         |
| Production | Railway env `production` (`web` + `cron`) | `social-media-prod` — **not yet created**, see KI-028 in `PROJECT_STATE.md`                                                                                                     | Railway Variables                                         |

**Rules:**

- Per-PR preview environments are still not used (ADR-029).
- The Supabase project region follows Singapore/SEA (ADR-028); the existing staging project is in `ap-southeast-1`, and production must follow the same region when created.
- Production **still requires** a Supabase project separate from staging/local (DI-D03, not amended) — the ban on sharing a project with staging/local still applies in full to production.
- Local and staging **deliberately share one and the same Supabase project** (ADR-081, final 2026-08-14) — a conscious decision by King Rezi for operational simplicity, no longer an open question. Consequence: there is no data/schema isolation between local and staging; see the risk note in the "Local Setup Flow" section and ADR-081.

---

# Secret Management (EM-D03)

| Location                                                  | Contents                                                                                                                                                                                              | Who fills it                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Supabase dashboard (per project)                          | URL, anon key, service role, JWT secret, connection strings                                                                                                                                           | Developer when creating the project    |
| Railway Variables (per environment + per service if needed) | All runtime + migrate secrets for staging/prod                                                                                                                                                      | Developer when setting up Railway      |
| `.env.local` (developer machine)                          | A copy of the **staging** project credentials (ref `ndcrkzqgqukqfmekgoze`) + OAuth/dev secrets — local shares staging, there is no separate local project (ADR-081, final)                             | Developer; not committed               |
| GitHub Actions                                            | Does not store app/DB secrets for the MVP PR gates                                                                                                                                                    | — (CI-D06)                             |
| Git                                                       | Only `.env.example`                                                                                                                                                                                   | Repo                                   |

**Practices:**

- Secret rotation is done per environment (e.g. rotate the staging `BETTER_AUTH_SECRET` without touching production).
- After a rotation, redeploy the related Railway environment so the process loads the new value.
- Do not paste secrets into chat, issues, or project documents.

---

# File Strategy (EM-D04)

| File                  | In Git? | Role                                                                                            |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `.env.example`        | Yes     | Template of var names + comments; dummy / empty values                                          |
| `.env.local`          | No      | Local override for Next.js / Bun                                                                |
| `.env`                | No      | Avoid; prefer `.env.local` so it does not clash with the Next convention                        |
| Railway / Supabase UI | N/A     | Source of truth for staging & production                                                        |

File location in the monorepo (set in M7): **`apps/web/`** — `.env.example` (in Git) and `.env.local` (gitignored) live next to the Next.js app so env is loaded natively without extra wiring from the root. `.env.example` must reflect the same location.

---

# Environment Variables Catalog

## Server (required at web runtime)

| Variable                    | Local                   | Staging                    | Production                    | Notes                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------- | -------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | local pooled            | staging pooled             | prod pooled                   | Supavisor transaction mode — Prisma runtime, Better Auth                                                                                                                                                                                                                                                                               |
| `DIRECT_URL`                | local direct            | staging direct             | prod direct                   | Session/direct — `prisma migrate`                                                                                                                                                                                                                                                                                                      |
| `SUPABASE_URL`              | local project URL       | staging URL                | prod URL                      | Platform API (Realtime, Storage)                                                                                                                                                                                                                                                                                                       |
| `SUPABASE_SERVICE_ROLE_KEY` | local                   | staging                    | prod                          | **Server only** — do not expose to the browser                                                                                                                                                                                                                                                                                         |
| `SUPABASE_JWT_SECRET`       | local JWT secret        | staging                    | prod                          | Signs the Supabase-compatible JWT (AS-D03)                                                                                                                                                                                                                                                                                             |
| `BETTER_AUTH_SECRET`        | unique local            | unique staging             | unique prod                   | High minimum entropy; generate separately                                                                                                                                                                                                                                                                                              |
| `BETTER_AUTH_URL`           | `http://localhost:3000` | `https://staging.<domain>` | `https://<production-domain>` | Better Auth base URL + OAuth callback                                                                                                                                                                                                                                                                                                  |
| `BETTER_AUTH_API_KEY`       | not set                 | **not set**                | **not set**                   | Must be empty in all envs (ADR-070) — if filled, the `dash` plugin (Better Auth Cloud) becomes active and requires a public Base URL                                                                                                                                                                                                   |
| `GOOGLE_CLIENT_ID`          | local/dev OAuth client  | staging OAuth              | prod OAuth                    | A separate client or separate redirect URI per env (AS-D05)                                                                                                                                                                                                                                                                            |
| `GOOGLE_CLIENT_SECRET`      | local/dev               | staging                    | prod                          | The pair of the client above                                                                                                                                                                                                                                                                                                           |
| `OUTSTAND_API_KEY`          | sandbox/local key       | staging key                | prod key                      | Outstand integration                                                                                                                                                                                                                                                                                                                   |
| `OUTSTAND_WEBHOOK_SECRET`   | local                   | staging                    | prod                          | Webhook HMAC verification                                                                                                                                                                                                                                                                                                              |
| `JOB_SECRET`                | local                   | staging                    | prod                          | `X-Job-Secret` header for the cron → web trigger                                                                                                                                                                                                                                                                                       |
| `RESEND_API_KEY`            | local key               | staging key                | prod key                      | Resend (ADR-126, AS-D04). Required when sending invitation email (T-110, T-007.7): `getInviteEmailSender()` throws if empty. Pages that do not send email may boot without this value. Better Auth password reset and verification use the same env; wiring is still T-005.3                                                             |
| `RESEND_FROM_EMAIL`         | sender address          | sender address             | sender address                | Required together with `RESEND_API_KEY`                                                                                                                                                                                                                                                                                                |

**There is no X/Twitter Client ID or Client Secret env var.** The X BYOK is configured by the Project Owner directly in the Outstand dashboard per environment. That secret is not copied into `.env.local`, Railway Variables, GitHub Actions, the database, or the application.

## Client (may be bundled)

| Variable                               | Notes                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL — the same value as the `SUPABASE_URL` of the related tier; used by the browser Realtime/Storage client when needed                               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (replaces the anon/public key in the newest Supabase API key system) — **not** the service role; protected by RLS                              |

Only the `NEXT_PUBLIC_` prefix may be read in Client Components. The service role, DB URLs, auth secrets, Outstand secrets, `JOB_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` **must** be server-only.

## Optional / deferred

| Variable   | Status                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV` | Set by the runtime (`development` / `production`) — no need to fill in manually in Railway except for a special override |

---

# Configuration Differences per Tier

| Aspect              | Local                                                                  | Staging                                                                                | Production                |
| ------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------- |
| HTTPS               | HTTP `localhost`                                                       | Railway HTTPS                                                                          | Railway HTTPS             |
| Cookie `Secure`     | `false` (HTTP)                                                         | `true`                                                                                 | `true`                    |
| `BETTER_AUTH_URL`   | `http://localhost:3000`                                                | public staging URL                                                                     | production URL            |
| Google redirect     | `http://localhost:3000/api/auth/callback/google`                       | staging callback                                                                       | production callback       |
| Migrate             | `prisma migrate dev` → staging project (sharing, ADR-081 final)        | `prisma migrate deploy` in the Railway release                                         | same, prod project        |
| Seed / reset        | **Be careful** — same database as staging (sharing, ADR-081), do not reset carelessly | Be careful; do not reset carelessly                                             | Reset forbidden           |
| Cron (`JOB_SECRET`) | May call manually / a script                                           | Railway Cron → `web`                                                                   | Railway Cron → `web`      |

The local vs HTTPS cookie implementation must align with `auth-strategy.md` — staging/production use `useSecureCookies: true`; local uses a non-secure configuration for HTTP.

---

# Local Setup Flow (M7 Reference)

> **ADR-081 amendment (final 2026-08-14):** step 1 below (create a dedicated
> `social-media-local` Supabase Cloud project) no longer applies — that plan
> was cancelled as the existing project is used as staging. **Local
> development officially shares the same staging project** (ref
> `ndcrkzqgqukqfmekgoze`) — no longer an open question. Developers fill in
> `.env.local` with that staging project's credentials.

1. ~~Create the Supabase Cloud project `social-media-local` (Singapore/SEA region).~~ **Cancelled (ADR-081)** — local officially shares the existing staging project, there is no separate local project.
2. Copy the connection strings, URL, anon key, service role, and JWT secret of the **staging project** (`ndcrkzqgqukqfmekgoze`) into `.env.local`.
3. Copy `.env.example` → `.env.local`, fill in all required vars with those staging values.
4. Create a Google OAuth client (or add a local redirect URI) pointing to `http://localhost:3000/api/auth/callback/google`.
5. `bun install` → `bunx prisma migrate dev` (uses the staging `DIRECT_URL` — schema changes directly affect staging, see the risk note below).
6. `bun run dev` — verify auth, Realtime (anon + JWT), and basic Storage.
7. Configure the X BYOK in the Outstand dashboard for the test account/environment if the Twitter/X flow will be verified; do not copy the X secret into application env files.

Developers do **not** point the local `DATABASE_URL` at **production** — that
remains absolutely forbidden. Local **may and does** share the staging project
(`ndcrkzqgqukqfmekgoze`) — the final decision of ADR-081 (2026-08-14).
**Consequence to remember every working day:** there is no data/schema
isolation between local and staging — migrations, seeds, or resets
run from a developer's laptop directly touch the same database
that Railway staging uses. This is a trade-off made knowingly
for operational simplicity (not negligence), but still be careful
when running destructive operations locally.

---

# Env Validation (EM-D05)

At server bootstrap (`apps/web`):

- Validate the presence of required server vars at process start (fail-fast with a clear message).
- Do not silently fall back to an empty string for secrets.
- PR CI does **not** need real secret values — the typecheck/lint/test/validate gates may use dummy env only if a test actually reads it; prefer mocks in unit tests (see `dx-tooling.md`).

---

# Cloud → Self-host (Plan, Not MVP)

| Phase                  | Platform                                                          | Notes                                                                            |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| MVP / M7–M9            | Supabase Cloud (`local`, `staging`, `prod`)                       | Focus on stabilizing the Prisma schema, RLS, Realtime, Storage                   |
| After schema is stable | Evaluate self-hosted Supabase (or Postgres + equivalent components) | Needs a new ADR: hosting, backup, upgrade, secrets, region                     |

**Future migration principles:**

- The application depends only on Postgres + compatible APIs (Prisma `DATABASE_URL`/`DIRECT_URL`, the Supabase client for Realtime/Storage, the JWT secret for Realtime).
- Self-host does **not** massively change the env var name catalog — what mainly changes is the _values_ of URLs/keys and infra operations.
- Do not start self-host before the cloud migrate path, RLS, and backup are proven smooth.

A future self-host decision must have an ADR in `DECISIONS.md`; this document only locks **cloud-first**.

---

# Decision Log

| ID     | Decision                                                                                                                                                                      | Reason                                                                                                                                                                                                                       | Alternatives                                                                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EM-D01 | Supabase Cloud for all MVP tiers; self-host deferred                                                                                                                          | Reduce early ops burden; the schema can be stabilized first                                                                                                                                                                  | Self-host from day one (heavy ops); mix cloud/self-host per tier (complex)                                                                                                                                                                    |
| EM-D02 | A separate Cloud project `social-media-local` — **amended by EM-D09/EM-D11/ADR-081, see the rows below**                                                                      | Isolate experiments from staging/prod; still cloud-first                                                                                                                                                                     | Use staging as local (data risk); Supabase CLI Docker (heavier local ops for this phase)                                                                                                                                                      |
| EM-D03 | Native secrets (Railway + Supabase + `.env.local`)                                                                                                                            | Enough for a solo MVP; zero extra tooling                                                                                                                                                                                    | Doppler/Infisical (added value later if collaborators are added)                                                                                                                                                                              |
| EM-D04 | `.env.example` + `.env.local` in `apps/web/`; secret files gitignored                                                                                                         | Next.js loads env from the app dir natively; an onboarding template without leaking secrets                                                                                                                                  | Env at the monorepo root (needs extra wiring); commit an encrypted `.env` (overhead); no example (murky onboarding)                                                                                                                           |
| EM-D05 | Fail-fast validation of required server env                                                                                                                                   | Failing fast beats a vague runtime error                                                                                                                                                                                     | Optional env with dangerous defaults                                                                                                                                                                                                          |
| EM-D06 | Ban on sharing secrets across tiers — **excepted for the local↔staging pair by EM-D11/ADR-081**, still applies in full to staging↔production                                  | A direct consequence of DI-D03 / credential isolation                                                                                                                                                                        | One key used by all envs (large blast radius)                                                                                                                                                                                                 |
| EM-D07 | No X client credentials in the application env                                                                                                                                | The X BYOK is managed manually in the Outstand dashboard; reduces secret exposure                                                                                                                                            |
| EM-D08 | ADR-040                                                                                                                                                                       | EM-D07 amends the catalog/integration prerequisites of the Engineering Baseline                                                                                                                                              |
| EM-D09 | The existing Supabase project ("Sosial Media Management", ref `ndcrkzqgqukqfmekgoze`) is officially the staging project; the plan for a new `social-media-local` project is cancelled | Efficiency — the project already exists and is healthy, already verified via Railway staging (KI-025); no need to create a separate new project                                                                              | Create a new `social-media-staging` project per the original EM-D02 (migration work with no real benefit for a solo-developer MVP)                                                                                                            |
| EM-D10 | ADR-081                                                                                                                                                                       | EM-D09 amends EM-D02 (ADR-033)                                                                                                                                                                                               | —                                                                                                                                                                                                                                             |
| EM-D11 | Local development officially shares the same staging project (ref `ndcrkzqgqukqfmekgoze`) — final, closing the open question recorded in the body of ADR-081                   | Efficiency/operational simplicity (King Rezi, 2026-08-14) — this project is the only active one so far, no need to complicate things with a third project                                                                    | A separate Supabase Cloud project for local (back to the original three-project pattern of EM-D02) — rejected, the setup complexity is not worth it for a solo-developer MVP                                                                  |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `deployment-infrastructure.md` — Railway/Supabase topology, secrets summary
- `auth-strategy.md` — `BETTER_AUTH_*`, OAuth, Supabase-compatible JWT
- `database-orm.md` — `DATABASE_URL` / `DIRECT_URL`, migrate
- `cicd-pipeline.md` — CI-D06, Railway holds the deploy secrets
- `dx-tooling.md` — local scripts `dev`, `db:*`, tests without prod secrets
- `../05-architecture/database-strategy.md` — data platform, RLS
- `../../project-os/DECISIONS.md` — ADR-029, ADR-032, ADR-033 (Amended by ADR-081)
