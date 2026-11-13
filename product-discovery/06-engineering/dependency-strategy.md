# Dependency Strategy

This document defines the **package & dependency strategy** for the Postific product: external versioning, the lockfile, dependency placement in the monorepo, shared package rules, and how dependencies are updated.

This document complements `monorepo-setup.md` (workspace layout, `@postific/shared`, import rules) and is aligned with the CI install in `cicd-pipeline.md` (`bun install --frozen-lockfile`) and the dependency tooling in `dx-tooling.md`.

---

# Goals

- Set how external dependency versions are written before Repository & Bootstrap (M7).
- Lock the role of the lockfile at the monorepo root (reproducible installs locally, in CI, and on Railway).
- Define where dependencies may be installed (root vs `apps/web` vs `packages/*`).
- Reinforce the `@postific/shared` rules and when a new package in `packages/` may be added.
- Set a simple dependency update flow for a solo developer.

---

# Locked Decisions (from Baseline)

| Topic                     | Decision                                                          | Source                                           |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Runtime / package manager | Bun                                                               | ADR-002                                          |
| Monorepo                  | Hybrid — `apps/*`, `packages/*`                                   | ADR-001, ADR-026                                 |
| Internal package link     | `"@postific/shared": "workspace:*"`                               | `monorepo-setup.md`                              |
| Lockfile location         | One lockfile at the root (`bun.lock`)                             | `monorepo-setup.md`, DI deploy notes             |
| CI install                | `bun install --frozen-lockfile`                                   | CI-D02, ADR-032                                  |
| Tooling at the root       | ESLint, Prettier, Lefthook, Vitest, TypeScript (monorepo-level)   | DX-D01–D03, `monorepo-setup.md`                  |
| Contents of `@postific/shared` | Branded IDs, enums, value objects used by 2+ domains         | MS-D04                                           |

---

# Dependency Strategy Decisions (Set in This Document)

| ID     | Topic                               | Decision                                                                                                                                                                       |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DS-D01 | Version ranges (external)           | **Caret (`^x.y.z`)** in `package.json`; the exact resolution is locked by the lockfile                                                                                         |
| DS-D02 | Dependency updates                  | **Manual** — bump / `bun update` when needed; no Renovate/Dependabot in the MVP                                                                                                |
| DS-D03 | Lockfile                            | **One `bun.lock` at the root**, must be committed; CI & deploy use a frozen install                                                                                            |
| DS-D04 | Dependency placement                | Root = monorepo tooling; `apps/web` = app runtime; `packages/shared` = no runtime deps (pure types)                                                                            |
| DS-D05 | Shared packages                     | Stay with a single `@postific/shared` in the MVP; a new package in `packages/` only with a strong reason (see the rules)                                                       |
| DS-D06 | Cross-workspace version sync        | **No Bun Catalog** in the MVP; caret + one lockfile is enough                                                                                                                  |
| DS-D07 | Astryx Beta exception               | **Superseded by ADR-097** — the migration to shadcn/ui is complete (v0.7, T-102). The exact pin rule below is historical; no Astryx code remains in the repo                   |

---

# External Versioning (DS-D01)

## Version writing rules

| Type                    | How to write it                                                  | Example                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public npm dependency   | Caret range                                                      | `"next": "^15.0.0"`, `"prisma": "^6.0.0"`                                                                                                            |
| Internal workspace      | Workspace protocol                                               | `"@postific/shared": "workspace:*"`                                                                                                                  |
| Exact pin               | Only if there is a strong reason (critical bug, vendor asks for a pin) | `"some-lib": "1.2.3"` — recorded in the PR/ADR if long-term                                                                                    |
| Astryx Beta (historical) | No longer used                                                  | Formerly an exact pin of `@astryxdesign/core` / `theme-stone` (ADR-087). Removed when the shadcn migration completed (ADR-097)                       |

**Principles:**

- `package.json` states the **accepted range**; `bun.lock` states the **installed version**.
- Do not rely on "latest" or open ranges (`*`, `latest`) for production dependencies.
- A major bump (breaking) is always deliberate: read the changelog, run typecheck/lint/test, then commit the lockfile together with the code changes.

### Astryx Beta Exception (DS-D07) — superseded by ADR-097

**No longer in force as an active rule.** shadcn/ui (the permanent foundation
since ADR-097) is source code that is _copied_ into the repo, not a package
dependency — there is no Beta versioning/exact pin issue like Astryx. The migration
is complete (v0.7, T-102); no `@astryxdesign/*` dependency remains.
The section below is kept as history only.

ADR-041 amends the ADR-035 caret rule specifically for Astryx while it was
still Beta:

- `@astryxdesign/core`, the active theme package (`@astryxdesign/theme-stone`,
  ADR-087), and `@astryxdesign/cli` use the same exact stable version;
- do not use the `latest` tag, wildcards, or canary;
- core and theme are always upgraded as a single unit;
- `@stylexjs/stylex` is **removed entirely** from the project dependencies (ADR-082,
  amendment to ADR-041) — Astryx is used Tailwind-layout-only; `swizzle` is
  also permanently closed as a consequence (swizzle needs the same StyleX
  compiler); and
- every upgrade must pass staging as well as smoke tests of Button, Dialog, form
  controls, Table, dark mode, the Tailwind cascade layer, typecheck, lint, test, and the
  Next.js production build.

## Not used in the MVP

- **Exact pin for all dependencies** — too much update noise for a solo MVP; the lockfile already guarantees reproducibility.
- **Bun Catalog** — useful when many workspaces share the same tooling version; with only `apps/web` + `@postific/shared`, the overhead is not yet proportionate (DS-D06). May be re-evaluated if the number of packages grows.

---

# Lockfile (DS-D03)

## Contract

| Aspect                    | Decision                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| File                      | `bun.lock` at the monorepo **root**                                                            |
| Git                       | **Must be committed** — a shared artifact for local, CI, Railway                               |
| Local install             | `bun install` (may update the lockfile if `package.json` changes)                              |
| CI / reproducible install | `bun install --frozen-lockfile` — fails if the lockfile does not match `package.json`          |
| Deploy (Railway)          | Install from the root with the same lockfile (see `deployment-infrastructure.md`)              |

**Rules:**

- Do not delete or regenerate the lockfile without a reason (corrupt / an agreed format migration).
- Every PR that changes dependencies **must** include the related `bun.lock` change.
- Do not commit `node_modules/`.

> The lockfile used by this repo is the text `bun.lock` at the root. Old notes that mention `bun.lockb` no longer apply.

---

# Dependency Placement (DS-D04)

```
social-media-management/
├── package.json              ← monorepo tooling only
├── bun.lock                 ← one lockfile for all workspaces
├── apps/web/package.json     ← runtime: Next, Prisma, Better Auth, Supabase client, UI, etc.
└── packages/shared/package.json  ← no runtime dependencies (pure types)
```

| Location          | May contain                                                                                        | Must not contain                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Root              | TypeScript, ESLint, Prettier, Lefthook, lint-staged, Vitest, and related config plugins            | App framework (`next`), the app's runtime ORM, Better Auth, the app's Supabase client                    |
| `apps/web`        | All dependencies the Next.js app needs at build/runtime                                            | Lint/format/test tooling already lifted to the root (avoid duplication without a reason)                 |
| `packages/shared` | Ideally **no** `dependencies`; TypeScript `devDependencies` only if the package itself needs them  | React, Next, Prisma, Better Auth, Supabase, domain logic                                                 |

**Install rules:**

- Run `bun add <pkg>` from the right workspace (`--cwd apps/web` or from inside the package folder), unless the dependency is truly monorepo-level → root.
- Do not lift app libraries to the root "to make importing easier" — that blurs the boundary (aligned with the Architecture Rules: a shared package only for cross-domain/app needs).

---

# Shared Package Rules (DS-D05)

Complements MS-D04 and IR-05 in `monorepo-setup.md`.

## `@postific/shared` — what is and is not allowed

| Allowed                                                              | Not allowed                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Branded ID types (`WorkspaceId`, `PostId`, …)                        | Business logic / Application Service                         |
| Cross-domain enums (`ContentStatus`, `MemberRole`, `Platform`, …)    | Imports from `@postific/web` or `src/domains/*`              |
| Pure value objects without I/O (`Email`, `URL`, …)                   | Infrastructure clients (Prisma, Supabase, Better Auth)       |
| Types used by **≥ 2 domains** (or the app + another package in the future) | Duplicating types that only one domain uses            |

## Adding a new package in `packages/`

The MVP has **only** `packages/shared`. A new package (e.g. `@postific/ui`, `@postific/config`) is **not** added unless it meets **one of**:

1. There is a **second deployable application** in `apps/` that needs shared code that is not a domain module; or
2. There is a clearly separate library, without domain logic, and extracting it reduces real complexity (not the speculation "it'll be useful later").

Domain modules **stay** in `apps/web/src/domains/` (ADR-026) — do not promote them to workspace packages in the MVP.

---

# Dependency Updates (DS-D02)

## MVP flow (manual)

```
1. Identify the need (security, feature, bug, framework major)
2. Change the version in the relevant package.json (or bun update / bun add)
3. bun install at the root → update bun.lock
4. bun run typecheck && bun run lint && bun run test
5. Commit package.json + bun.lock (+ adaptation code changes) in one PR
```

For shadcn components (code copied into the repo, ADR-097), updating means
re-pulling the component from the CLI/MCP and adjusting local customizations —
run a UI smoke test and a production build on a separate branch, then test on
staging before promotion. (The Astryx-specific steps below are historical;
the migration is complete, ADR-097.)

For Astryx (legacy), add special steps: bump core + theme + CLI
as a single unit, verify the StyleX peer, run a UI smoke test and a
production build on a separate branch, then test on staging before promotion.

| Situation                       | Action                                                                      |
| ------------------------------- | --------------------------------------------------------------------------- |
| Patch/minor within caret        | May `bun update <pkg>` periodically; commit the lockfile                    |
| Major (breaking)                | Read the migration guide; adapt the code; test fully; mention it in the PR  |
| Critical security advisory      | Prioritize an immediate bump even outside the feature cycle                 |
| Root tooling (ESLint, Vitest, …) | Update at the root; make sure the CI scripts are still green               |

## Deferred

- **Dependabot / Renovate** — may be evaluated once update frequency becomes a burden or when collaborators are added. Not part of the M7 bootstrap.
- Auto-merging dependency PRs — not used in the MVP.

---

# Command Summary (M7 Reference)

| Goal                      | Command                                                |
| ------------------------- | ------------------------------------------------------ |
| Install the whole monorepo | `bun install` (root)                                  |
| CI install                | `bun install --frozen-lockfile`                        |
| Add an app dep            | `bun add <pkg> --cwd apps/web`                         |
| Add a root tooling dep    | `bun add -d <pkg>` (root)                              |
| Update one package        | `bun update <pkg>` (in the right workspace)            |
| Verify after a bump       | `bun run typecheck && bun run lint && bun run test`    |

---

# Artifacts Expected in M7

- Root `package.json` + `apps/web/package.json` + `packages/shared/package.json` following the DS-D04 placement.
- `bun.lock` committed from the first bootstrap that installs dependencies.
- No runtime dependencies in `@postific/shared`.
- CI uses `--frozen-lockfile` (already in `cicd-pipeline.md`).
- No Renovate/Dependabot config in the MVP unless decided later.

---

# Decision Log

| ID     | Decision                                                 | Reason                                                                                           | Alternatives                                  |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| DS-D01 | Caret (`^`) for external dependencies                    | The lockfile locks the resolution; caret reduces daily bump noise for a solo MVP                 | Exact pin for all packages; Bun Catalog       |
| DS-D02 | Manual updates                                           | Simplest for a solo developer; full control over when a breaking change enters                   | Dependabot; Renovate                          |
| DS-D03 | One root `bun.lock`, committed + frozen in CI            | Reproducible builds locally/CI/Railway; aligned with the Bun monorepo                            | A lockfile per package; not committing the lockfile |
| DS-D04 | Root = tooling; web = runtime; shared = no runtime deps  | Clear boundaries; prevents a "god root package.json"                                             | All dependencies at the root                  |
| DS-D05 | Only `@postific/shared` in the MVP; a new package needs a strong reason | Avoid premature package explosion; aligned with ADR-026                           | Many packages from the start                  |
| DS-D06 | No Bun Catalog in the MVP                                | Only two relevant workspaces; the catalog gives no value yet                                     | Catalog from day one                          |
| DS-D07 | Astryx Beta exact pin — historical, superseded by ADR-097 | Formerly reduced the risk of breaking changes while Astryx was still the foundation             | Caret; canary; automatic updates              |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `monorepo-setup.md` — workspace layout, `@postific/shared`, import rules (MS-D04, IR-05)
- `cicd-pipeline.md` — `bun install --frozen-lockfile` (CI-D02)
- `dx-tooling.md` — monorepo dependency tooling at the root
- `deployment-infrastructure.md` — install from the root during the Railway build
- `../../project-os/DECISIONS.md` — ADR-002, ADR-026, ADR-032, ADR-035, ADR-041
