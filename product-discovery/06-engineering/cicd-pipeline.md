# CI/CD Pipeline

This document defines the **Continuous Integration and Continuous Deployment pipeline** for the Postific product: CI tooling, triggers, quality gates, the code promotion flow, and when database migrations run.

This document makes the deploy trigger from `deployment-infrastructure.md` (DI-D05) and the migration flow from `database-orm.md` (DO-D03) concrete. The details of the lint/format/test commands are set in `dx-tooling.md` (ESLint + Prettier + Vitest, ADR-034); this document sets **what must pass in CI**, not the tool configuration.

---

# Goals

- Fix the CI/CD tooling definitively before Repository & Bootstrap (M7).
- Ensure code does not enter `staging` / `main` without passing the quality gates.
- Align CI with Railway auto-deploy (DI-D05).
- Set when and where `prisma migrate deploy` runs.
- Define the feature → staging → production promotion flow for a solo developer.

---

# Locked Decisions (from Baseline)

| Topic                     | Decision                                                      | Source                    |
| ------------------------- | ------------------------------------------------------------- | ------------------------- |
| Deploy platform           | Railway                                                       | pre-architecture, ADR-029 |
| Deploy trigger            | Push `staging` → staging; push `main` → production            | DI-D05                    |
| Runtime / package manager | Bun                                                           | ADR-002                   |
| Monorepo                  | Hybrid — build from root, deploy unit `apps/web`              | ADR-026                   |
| Schema migrations         | Prisma Migrate; staging first, then production                | DO-D03, DI-D03            |
| App rollback              | Redeploy the previous Railway deployment                      | DI-D06                    |

---

# CI/CD Decisions (Set in This Document)

| ID     | Topic                  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI-D01 | CI tooling             | **GitHub Actions** — workflows in `.github/workflows/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CI-D02 | Quality gates (PR)     | Must pass before merge: **install → prisma generate → prisma validate → typecheck → lint → test**. The E2E gate for promotion to `main` is in CI-D07 (ADR-149)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CI-D03 | Branch & promotion     | `feature/*` → PR to `staging` → verification → PR `staging` to `main`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CI-D04 | CD (deploy)            | Stays **Railway auto-deploy** from the branch (not a deploy from GitHub Actions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CI-D05 | DB migration           | `prisma migrate deploy` in the **Railway release/pre-start** per environment (`DIRECT_URL`) — not in the PR job                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CI-D06 | Secrets in CI          | PR CI does **not** need production secrets; DB/migrate secrets live only in Railway (and optionally a staging mirror in GitHub Secrets if a separate migrate job is added later). **ADR-149 amendment:** the E2E job (CI-D07) uses GitHub Secrets for the staging test account, only on `pull_request` from the `staging` branch to `main` (ADR-150)                                                                                                                                                                                                                                                                                                            |
| CI-D07 | E2E gate _(ADR-149)_   | Playwright (Chrome) against **staging after deploy** on `pull_request` to `main` (head `staging`, ADR-150; `push` to `staging` is not used because Railway "Wait for CI" waits for that workflow while the workflow waits for the deploy); green becomes a required check for the `staging` → `main` PR (**deferred until MVP public launch, T-088.1, ADR-151**; until then only "Quality gates" is required). `feature/*` → `staging` PRs are not blocked by E2E in CI; the ticket author runs the suite locally and reports it in the PR. Spec: S-002                                                                                                          |

---

# Pipeline Overview

```
┌──────────────┐     PR + CI gates      ┌──────────┐     Railway      ┌─────────────┐
│ feature/*    │ ────────────────────►  │ staging  │ ───────────────► │ Staging env │
└──────────────┘                        └────┬─────┘   migrate+web   └─────────────┘
                                             │
                                             │ PR + CI gates
                                             ▼
                                        ┌──────────┐     Railway      ┌─────────────┐
                                        │   main   │ ───────────────► │ Production  │
                                        └──────────┘   migrate+web   └─────────────┘
```

1. **CI (GitHub Actions)** — validates quality on every Pull Request toward `staging` or `main`.
2. **Merge** — only after the gates are green (branch protection).
3. **CD (Railway)** — a push to an environment branch triggers the build & deploy of `web` + `cron`.
4. **Migrate** — before the new application serves traffic, Railway runs `prisma migrate deploy` against that environment's Supabase project.

---

# Continuous Integration — GitHub Actions (CI-D01, CI-D02)

## Trigger

| Event                | Target branch       | Purpose                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pull_request`       | `staging`, `main`   | Quality gates before merge                                                                                                                                                                                                                                                                                               |
| `push` (optional)    | `staging`, `main`   | Re-run the gates after merge (visibility); **not** a replacement for the Railway deploy                                                                                                                                                                                                                                  |
| `pull_request`       | `main` (head `staging`) | Playwright E2E workflow against staging after deploy (CI-D07, ADR-149, S-002); green becomes a required check for the `staging` → `main` PR. "After deploy" = the workflow waits for the GitHub deployment status `Postific / staging` (from Railway) for that commit SHA to be `success`                             |

Application deploys are **not** triggered from GitHub Actions (CI-D04).

## Jobs & Gates (MVP)

One main workflow (e.g. `ci.yml`) with sequential steps:

| Step            | Command (reference)                                                         | Failure = blocks merge |
| --------------- | --------------------------------------------------------------------------- | ---------------------- |
| Checkout        | `actions/checkout`                                                          | yes                    |
| Setup Bun       | version aligned with ADR-002 / M7                                           | yes                    |
| Install         | `bun install --frozen-lockfile` at the root                                 | yes                    |
| Prisma generate | `bunx prisma generate` (in `apps/web`)                                      | yes                    |
| Prisma validate | `bunx prisma validate`                                                      | yes                    |
| Typecheck       | `bun run typecheck`                                                         | yes                    |
| Lint            | `bun run lint` — rule details in `dx-tooling.md`                            | yes                    |
| Test            | `bun run test` — unit/domain tests; a minimal suite is fine early in M8     | yes                    |

**Outside the scope of MVP CI:**

- Browser E2E in the PR job (`pull_request`). E2E runs as a separate gate against staging (CI-D07, ADR-149).
- Railway per-PR deploy previews — rejected in ADR-029.
- `prisma migrate deploy` against staging/prod from the PR job — too dangerous and unnecessary (CI-D05).

## Branch Protection (recommended)

On `staging` and `main`:

- Require a PR before merge.
- Require the CI status check to be green.
- No force-push to `main` / `staging`.

For a solo developer, protection is still useful as a safeguard against accidental merges and as living documentation of the gates.

---

# Branch Strategy & Promotion (CI-D03)

| Branch                        | Role                                                                      |
| ----------------------------- | ------------------------------------------------------------------------- |
| `feature/<name>` or `fix/<name>` | Daily work; does not auto-deploy to a persistent Railway environment   |
| `staging`                     | Pre-release integration; auto-deploys to Railway **staging**              |
| `main`                        | Production; auto-deploys to Railway **production**                        |

**MVP release flow:**

```
1. Work on feature/*
2. Open a PR → staging
3. CI gates must be green → merge
4. Railway staging deploy + prisma migrate deploy (staging DIRECT_URL)
5. Manual verification on staging (smoke: login, critical flows)
6. Open a PR staging → main
7. CI gates green → merge
8. Railway production deploy + prisma migrate deploy (production DIRECT_URL)
```

Emergency hotfix: may branch from `main` with a PR directly to `main` **only** if the change is small and already verified; breaking migrations must still be expand-and-contract (DI-D06).

---

# Continuous Deployment — Railway (CI-D04)

Aligned with DI-D05 — not repeated as a new decision:

| Branch    | Railway environment | Services       |
| --------- | ------------------- | -------------- |
| `staging` | staging             | `web` + `cron` |
| `main`    | production          | `web` + `cron` |

Monorepo build notes (install at the root, start `apps/web`) still follow `deployment-infrastructure.md`.

**Separation of responsibilities:**

- GitHub Actions = **code quality**.
- Railway = **build the artifact + run the services + migrate the environment's DB**.

---

# Database Migration in the Pipeline (CI-D05)

## Where migrate runs

`prisma migrate deploy` runs as a **release / pre-start step** on the `web` service in Railway (each environment uses its own `DIRECT_URL`).

Example start sequence (M7 reference):

```bash
bunx prisma migrate deploy   # requires DIRECT_URL
bun run --cwd apps/web start
```

Or the Railway Release Command equivalent if it is split from the Start Command.

## What is not done

| Anti-pattern                                   | Reason                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Migrate from the PR job                        | A PR is not necessarily merged; risk of writing to the shared DB from a fork/experimental branch |
| Migrate only manually from a laptop to production | Easy to forget; not reproducible                                                       |
| `prisma migrate reset` on shared staging/prod  | Deletes data                                                                              |

## Safe order with two environments

1. The migration file is already in Git (the result of a local `migrate dev`).
2. Merge to `staging` → Railway staging runs `migrate deploy` → verify.
3. Merge to `main` → Railway production runs `migrate deploy`.

This embodies the flow in `database-orm.md` steps 4–7.

---

# Secrets & Environment (CI-D06)

| Location               | Contents                                                              | Used for                                                           |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| GitHub Actions (PR CI) | No app/DB secrets required for the MVP gates                          | typecheck/lint/test/validate are local to the runner               |
| Railway staging        | All staging env (`DATABASE_URL`, `DIRECT_URL`, auth, Outstand, …)     | staging runtime + migrate                                          |
| Railway production     | All production env                                                    | production runtime + migrate                                       |

Env var catalog details: `environment-management.md`.  
CI is not a place to store the production `SUPABASE_SERVICE_ROLE_KEY` or `DIRECT_URL`.

If a "migrate-only" job is added to GitHub Actions in the future, the secrets must be scoped per environment and the job may run only on `push` to the related branch — not on `pull_request` from a fork.

---

# Failure & Rollback in the Pipeline

| Failure                          | Action                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CI red on a PR                   | Do not merge; fix on the feature branch                                                                                    |
| Railway build fails              | The new deployment does not replace the healthy one (Railway); fix and push again                                          |
| `migrate deploy` fails           | App start is halted; fix the migration (forward-fix), do not reset the shared DB                                           |
| Bad app after a successful deploy | Roll back the app via a redeploy of the previous Railway deployment (DI-D06); ensure the schema stays compatible (expand-and-contract) |

---

# Artifacts Expected in M7

During Repository & Bootstrap:

- `.github/workflows/ci.yml` — CI-D02 gates.
- Branch protection rules on `staging` and `main`.
- Railway: branch → environment mapping; the Release/Start command includes `prisma migrate deploy`.
- Root `package.json` scripts: `typecheck`, `lint`, `test` (concrete contents in `dx-tooling.md`).

---

# Decision Log

| ID     | Decision                                                                    | Reason                                                                                                                                                                                                                                                                                       | Alternatives                                                                                                                                                         |
| ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI-D01 | GitHub Actions as CI                                                        | Native to GitHub, enough for a Bun monorepo, no extra CI platform                                                                                                                                                                                                                            | Railway CI only (weak gates before merge); CircleCI/other (overhead for a solo MVP)                                                                                  |
| CI-D02 | Gates: install, prisma generate/validate, typecheck, lint, test             | Catches type/schema/style errors before they enter a deploy branch                                                                                                                                                                                                                           | Typecheck only (too loose); mandatory E2E on every PR (heavy for the MVP)                                                                                            |
| CI-D03 | Promotion feature → staging → main                                          | Staging as the test mirror (DI-D02) before production                                                                                                                                                                                                                                        | Straight feature → main (gives up a safe place to test)                                                                                                              |
| CI-D04 | CD stays on Railway auto-deploy                                             | Already locked by DI-D05; avoid two deploy systems                                                                                                                                                                                                                                           | Deploy from GitHub Actions to the Railway API (duplicated control)                                                                                                   |
| CI-D05 | `migrate deploy` in the Railway release/pre-start                           | Migrate is bound to the same environment as the deployed code; staging first, then prod                                                                                                                                                                                                      | Migrate in GitHub Actions (needs DB secrets in GitHub); manual migrate                                                                                               |
| CI-D06 | Sensitive secrets not in PR CI                                              | Minimize the blast radius; Railway already has env per environment. _ADR-149/ADR-150 amendment:_ the staging test account secrets are used only by the E2E job on PRs from the `staging` branch to `main`                                                                                    | Mirror all secrets to GitHub Secrets from the MVP                                                                                                                    |
| CI-D07 | Playwright E2E gate against staging after deploy (ADR-149)                  | Local and staging share one DB (ADR-081), Outstand needs a real API key (ADR-119), and there is no per-PR preview (ADR-029); testing staging is the way to run the code that is actually deployed without secrets in PR CI                                                                    | E2E on every PR (secrets in PR CI, shared DB polluted); Postgres service container (Supabase/Outstand features cannot be tested, fake adapter forbidden)             |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `deployment-infrastructure.md` — DI-D05 deploy trigger, Railway services, rollback
- `database-orm.md` — Prisma Migrate, `DIRECT_URL`, staging → production flow
- `environment-management.md` — env vars & secrets catalog (ADR-033)
- `dx-tooling.md` — concrete lint/format/test commands (ADR-034)
- `monorepo-setup.md` — root workspace scripts
- `../../project-os/DECISIONS.md` — ADR-029, ADR-032
