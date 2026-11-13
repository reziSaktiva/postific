# DX Tooling

This document defines the **Developer Experience tooling** for the Postific product: linting, formatting, pre-commit hooks, the test runner, workspace scripts, and the local development flow.

This document makes the commands named in `cicd-pipeline.md` (`bun run lint`, `bun run test`, `bun run typecheck`) concrete and complements the root scripts in `monorepo-setup.md`. The local env follows `environment-management.md`.

---

# Goals

- Set the lint/format stack definitively before Repository & Bootstrap (M7).
- Ensure the CI quality gates and local feedback use the same commands.
- Set a fast pre-commit hook that does not hinder the solo developer's flow.
- Set the test runner for the `bun run test` gate.
- Define a local setup checklist aligned with the Bun + Next.js + Prisma monorepo.

---

# Locked Decisions (from Baseline)

| Topic                     | Decision                                                      | Source                  |
| ------------------------- | ------------------------------------------------------------- | ----------------------- |
| Runtime / package manager | Bun                                                           | ADR-002                 |
| Monorepo                  | Hybrid — root scripts, app in `apps/web`                      | ADR-026                 |
| CI gates                  | install → prisma → typecheck → lint → test                    | CI-D02, ADR-032         |
| Local DB                  | Supabase Cloud, sharing the staging project + `.env.local`    | EM-D02, EM-D03, ADR-081 |
| TypeScript                | Base `tsconfig` at the root                                   | `monorepo-setup.md`     |

---

# DX Tooling Decisions (Set in This Document)

| ID     | Topic                | Decision                                                                                                                                                                   |
| ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DX-D01 | Lint + format        | **ESLint** (lint) + **Prettier** (format) — monorepo config at the root                                                                                                    |
| DX-D02 | Pre-commit           | **Lefthook** + **lint-staged** — run lint/format only on staged files                                                                                                      |
| DX-D03 | Test runner          | **Vitest** — unit/domain tests; invoked via `bun run test`                                                                                                                 |
| DX-D04 | Root scripts         | Uniform: `dev`, `build`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `test:e2e`, `db:generate`, `db:migrate`, `db:deploy`             |
| DX-D05 | Editor               | Prettier format on save + ESLint fix recommended; not required in CI beyond the explicit commands                                                                          |
| DX-D06 | Vitest config        | `vitest.config.ts` at the **root**                                                                                                                                         |
| DX-D07 | Lefthook install     | Root script `prepare` → `lefthook install`                                                                                                                                 |
| DX-D08 | E2E tests _(ADR-149)_ | **Playwright** (installed Chrome) — `bun run test:e2e`; config `apps/web/playwright.config.ts`, tests `apps/web/e2e/*.e2e.ts`; Vitest does not load `e2e/`               |

---

# Lint & Format (DX-D01)

## Stack

| Tool                     | Role                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| ESLint                   | TypeScript/React/Next static analysis — code quality errors & warnings        |
| Prettier                 | Formatting (indent, quotes, line width, import sorting if configured)         |
| `eslint-config-prettier` | Turns off ESLint rules that conflict with Prettier                            |

## Scope

- Lint/format covers `apps/web` and `packages/shared`.
- Ignore build artifacts: `.next/`, `dist/`, `coverage/`, `node_modules/`.
- MVP rule set: the relevant TypeScript + React Hooks + Next.js presets; avoid an overly strict rule set that hinders bootstrap — it may be tightened gradually.

## Commands

| Script         | Command (reference)              | Used in                                                                                         |
| -------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `lint`         | ESLint over the whole workspace source | CI (required), local, pre-commit (staged)                                                 |
| `lint:fix`     | ESLint `--fix`                   | Local only                                                                                      |
| `format`       | Prettier `--write`               | Local, pre-commit (staged)                                                                      |
| `format:check` | Prettier `--check`               | Optional in CI later; MVP CI relies on lint + consistency via pre-commit                        |

MVP CI **must** run `bun run lint` (CI-D02). `format:check` may be added later if formatting drift appears without a pre-commit.

## Configuration (M7 location)

```
/
├── eslint.config.*          ← monorepo flat config (or .eslintrc.* if needed)
├── .prettierrc / prettier.config.*
├── .prettierignore
├── lefthook.yml
└── package.json             ← scripts + lint-staged config
```

Monorepo-level tooling dependencies are installed at the **root** (aligned with `monorepo-setup.md`).

---

# Pre-commit Hooks (DX-D02)

## Stack

| Tool        | Role                                                     |
| ----------- | -------------------------------------------------------- |
| Lefthook    | Runs git hooks; fast, YAML config, suits Bun             |
| lint-staged | Restricts ESLint/Prettier to staged files                |

## MVP Behavior

On `pre-commit`:

1. `lint-staged` runs Prettier + ESLint (safe fix where possible) on the relevant staged files (`*.{ts,tsx,js,jsx,json,md}` — adjust in M7).
2. Hook fails → the commit is rejected until fixed.
3. Does **not** run the full test suite or `prisma migrate` in pre-commit (too slow); tests stay in CI + local on demand.

## Install hook

After clone: `bun install` runs the `prepare` script at the root (`lefthook install`). Manual alternative: `bunx lefthook install`.

A solo developer still benefits: it prevents committing format/lint issues that would fail in CI.

---

# Test Runner (DX-D03)

## Stack

| Aspect      | Decision                                                                          |
| ----------- | --------------------------------------------------------------------------------- |
| Runner      | **Vitest**                                                                        |
| MVP focus   | Unit/domain tests (entities, pure services, helpers)                              |
| Environment | Node/Bun-compatible via Vitest; mock I/O (Prisma, Outstand, Better Auth)          |
| Coverage    | Optional in the MVP; not an initial CI gate                                       |
| E2E         | Outside the scope of MVP CI (`cicd-pipeline.md`)                                  |

## Commands

| Script       | Role                                           |
| ------------ | ---------------------------------------------- |
| `test`       | `vitest run` — CI & the pre-push mental model  |
| `test:watch` | `vitest` watch — local                         |

## Test rules

- Tests do not need production secrets; mock infrastructure dependencies.
- Domain tests do not import concrete repository implementations if they can be mocked through an interface (aligned with DDD).
- The suite may be minimal early in M8 — what matters is that the `bun run test` command exists and is green in CI.

Configuration: `vitest.config.ts` at the monorepo **root** (M7) — the `@postific/shared` and `@/` aliases are resolved from one place; the suite covers `apps/web` and `packages/shared`.

---

## E2E Tests (DX-D08, ADR-149, S-002)

- Command: `bun run test:e2e` from the root. The target is chosen via `E2E_BASE_URL`: empty = local (`http://localhost:3000`, `next dev` is started if not already running); set a staging URL to test staging.
- Uses the installed Google Chrome (`channel: "chrome"`), does not download a browser. Run results (`test-results/`, `playwright-report/`) and the login session (`e2e/.auth/`) are gitignored.
- Local and staging share one DB (ADR-081): tests only touch data owned by the test account. The test account and data conventions are in T-173.
- Test files are named `*.e2e.ts` (not `*.spec.ts`) so Vitest does not pick them up.

---

# Workspace Scripts (DX-D04)

Root `package.json` reference (complements `monorepo-setup.md`):

```json
{
  "scripts": {
    "dev": "bun run --cwd apps/web dev",
    "build": "bun run --cwd apps/web build",
    "typecheck": "bun run --cwd apps/web typecheck",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "bun run --cwd apps/web test:e2e",
    "db:generate": "bun run --cwd apps/web db:generate",
    "db:migrate": "bun run --cwd apps/web db:migrate",
    "db:deploy": "bun run --cwd apps/web db:deploy"
  }
}
```

Prisma mapping in `apps/web` (reference):

| Script        | Command                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db:generate` | `prisma generate`                                                                                                                                        |
| `db:migrate`  | `prisma migrate dev` — **only** against the staging project that local shares (ADR-081), per the credentials in `.env.local`                             |
| `db:deploy`   | `prisma migrate deploy` — used in the Railway release; rarely called manually locally                                                                    |

The exact commands (binary path `bunx prisma` vs a script) are finalized in M7; the script names above are the contract for CI and documentation.

---

# Local Development Setup

Checklist after the repo is bootstrapped (M7):

1. **Prerequisites:** Bun (version aligned with ADR-002), Git, Supabase Cloud access, a Google Cloud account (OAuth).
2. **Clone & install:** `bun install` at the root (frozen lockfile in CI; normal locally).
3. **Env:** copy `.env.example` → `.env.local`, fill in the credentials of the staging project that local shares (ADR-081, `environment-management.md`).
4. **Hooks:** make sure Lefthook is installed (`bunx lefthook install`).
5. **DB:** `bun run db:generate` → `bun run db:migrate`.
6. **Dev server:** `bun run dev` → `http://localhost:3000`.
7. **Verify DX:** `bun run typecheck && bun run lint && bun run test`.

## Daily workflow

```
1. bun run dev                          ← coding
2. bun run test:watch                   ← when changing domain logic
3. git add … → pre-commit (lint-staged)
4. PR → staging → CI gates (typecheck, lint, test, prisma validate)
```

Do not point `.env.local` at the staging/prod project (EM-D02, EM-D06).

---

# Typecheck

- `bun run typecheck` stays a CI gate separate from ESLint.
- `tsc --noEmit` (or the Next script) in `apps/web`; packages are type-checked via project references or the same path — `tsconfig` details in `monorepo-setup.md`.

---

# Artifacts Expected in M7

- ESLint + Prettier config at the root (+ ignore files).
- `lefthook.yml` + lint-staged configuration.
- `vitest.config.ts` + a minimal smoke/unit test so CI is green.
- Root scripts per the DX-D04 table.
- `.env.example` aligned with the `environment-management.md` catalog.
- Brief setup documentation in the repo root README (not in the discovery folder) at bootstrap.

---

# Decision Log

| ID     | Decision                                                  | Reason                                                                                                                                  | Alternatives                                                                                                  |
| ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| DX-D01 | ESLint + Prettier                                         | Largest ecosystem, mature Next/React plugins, already named as the reference in the earlier M6 documents                                | Biome (all-in-one, simpler); Oxlint + Prettier                                                                |
| DX-D02 | Lefthook + lint-staged                                    | Fast hooks, light config, suits Bun; feedback before CI                                                                                 | Husky + lint-staged (more boilerplate); no pre-commit (CI only)                                               |
| DX-D03 | Vitest                                                    | Familiar API, mature mock/coverage, monorepo-friendly                                                                                   | Bun test (more native, thinner assertion/mock ecosystem)                                                      |
| DX-D04 | Uniform root scripts for CI & local                       | One command contract (`lint`/`test`/`typecheck`)                                                                                        | Scripts only in `apps/web` without root aliases                                                               |
| DX-D05 | Editor format-on-save recommended, not strictly gated early | Local DX without blocking bootstrap                                                                                                   | Require `format:check` on every PR from day one                                                               |
| DX-D06 | `vitest.config.ts` at the root                            | Monorepo aliases (`@postific/shared`, `@/`) have a single source; CI calls `bun run test` from the root                                 | Config only in `apps/web`                                                                                     |
| DX-D07 | Lefthook via `prepare` at the root                        | Hooks are installed automatically after `bun install`                                                                                   | Only document a manual `bunx lefthook install`                                                                |
| DX-D08 | Playwright (installed Chrome) for E2E (ADR-149)           | Tests are repeatable, record traces, use the already-installed Chrome without a browser download; `*.e2e.ts` files separate from Vitest | Cypress (separate ecosystem); stay manual via the browser pane (not repeatable, not a gate)                   |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `monorepo-setup.md` — workspace structure, `tsconfig`, root dependency rules
- `cicd-pipeline.md` — gates that call these scripts (CI-D02)
- `environment-management.md` — `.env.local`, local sharing the staging project (ADR-081)
- `database-orm.md` — Prisma generate/migrate on local
- `dependency-strategy.md` — external versions, lockfile, dep placement (ADR-035)
- `../../project-os/DECISIONS.md` — ADR-032, ADR-034, ADR-035
