# Context — Technical Context

An index of **stack & infrastructure**: runtime, ORM, auth config, env, deploy, CI, dependency.  
Not the place for domain folder patterns or code style rules (those are `ctx-implementation` / `ctx-development`).

---

## Read first

| Document                                                                                           | Topic                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`../product-discovery/06-engineering/README.md`](../product-discovery/06-engineering/README.md)   | Engineering Baseline v1.0 index (ADR-036)                                                                                                          |
| [`monorepo-setup.md`](../product-discovery/06-engineering/monorepo-setup.md)                       | Hybrid Monorepo layout, Bun workspaces                                                                                                             |
| [`database-orm.md`](../product-discovery/06-engineering/database-orm.md)                           | Prisma 7, migrate, pooling, Supabase client limits (ADR-031)                                                                                       |
| [`auth-strategy.md`](../product-discovery/06-engineering/auth-strategy.md)                         | Better Auth, Google OAuth, Realtime JWT (ADR-030)                                                                                                  |
| [`environment-management.md`](../product-discovery/06-engineering/environment-management.md)       | Env vars, secrets, local piggybacking on the staging project (ADR-033, amendment ADR-081)                                                          |
| [`deployment-infrastructure.md`](../product-discovery/06-engineering/deployment-infrastructure.md) | Railway + Supabase SEA (ADR-028, ADR-029)                                                                                                          |
| [`cicd-pipeline.md`](../product-discovery/06-engineering/cicd-pipeline.md)                         | GitHub Actions gates, Railway CD (ADR-032)                                                                                                         |
| [`dependency-strategy.md`](../product-discovery/06-engineering/dependency-strategy.md)             | Caret default, lockfile, `@postific/shared` (ADR-035); the Astryx Beta exact-pin exception is superseded by the shadcn/ui migration (ADR-097)      |
| [`design-tokens.md`](../product-discovery/06-engineering/design-tokens.md)                         | SoT for visual tokens — co-equal with the design artifact, locked iteratively without waiting for an external designer (ADR-038, ADR-140, ADR-057) |

Implementation in the repo:

| Path                            | Role                              |
| ------------------------------- | --------------------------------- |
| `apps/web/`                     | Next.js App Router                |
| `apps/web/prisma/schema.prisma` | Prisma schema                     |
| `apps/web/prisma.config.ts`     | Migrate URL (`DIRECT_URL`)        |
| `apps/web/src/lib/prisma/`      | Prisma client singleton + adapter |
| `apps/web/src/lib/better-auth/` | Auth server                       |
| `apps/web/src/lib/env.ts`       | Env fail-fast                     |
| `apps/web/.env.example`         | Env catalog (EM-D04)              |
| `packages/shared/`              | Shared types                      |
| `.github/workflows/ci.yml`      | CI gates                          |

---

## Stack (quick recall)

| Area                    | Choice                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime / PM            | Bun                                                                                                                                                                                                                                                                                                                                                    |
| App                     | Next.js (`apps/web`)                                                                                                                                                                                                                                                                                                                                   |
| Auth                    | Better Auth (email/password + Google)                                                                                                                                                                                                                                                                                                                  |
| ORM                     | Prisma **7.x** — migrate via `DIRECT_URL`, runtime via `@prisma/adapter-pg` + `DATABASE_URL`                                                                                                                                                                                                                                                           |
| DB / Storage / Realtime | Supabase                                                                                                                                                                                                                                                                                                                                               |
| Social API              | Outstand (via ACL — see `ctx-architecture`)                                                                                                                                                                                                                                                                                                            |
| Deploy                  | Railway (web + cron)                                                                                                                                                                                                                                                                                                                                   |
| CI                      | GitHub Actions                                                                                                                                                                                                                                                                                                                                         |
| UI Components           | shadcn/ui — permanent foundation (ADR-097, reversing ADR-041); Stone theme token (ADR-087) as the reference; Light/Dark Mode Toggle is an official feature (ADR-055, amended by ADR-097); migration from Astryx to shadcn/ui is complete (ADR-097) — for status detail see `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md` |
| Styling                 | Tailwind CSS — direct styling of shadcn components (no longer layout-only, ADR-097)                                                                                                                                                                                                                                                                    |

---

## Operating rules

1. Local env: `apps/web/.env.local` (from `.env.example`) — **do not commit**.
2. Supabase JS: **only** Realtime + Storage. CRUD through Prisma.
3. Prisma 7: do not assume v6 patterns (URL in the schema only); follow `database-orm.md` + `prisma.config.ts`.
4. Dependency: follow `dependency-strategy.md` — shared package without business
   logic; shadcn/ui is source code copied into the repo (ADR-097), there is no
   exact pin/Beta issue like Astryx had before.
5. Required CI: install → prisma generate/validate → typecheck → lint → test.
6. Transactional email uses Resend (ADR-126, AS-D04). Do not add another provider. The env catalog is in `environment-management.md` (T-005.2). Better Auth wiring is still T-005.3–.5.
7. Do not change the Engineering Baseline without an ADR.
8. Design tokens: SoT in `design-tokens.md`, co-equal with the design artifact
   (the `design/` folder has been deleted and is not recreated, ADR-045, ADR-057
   — there is no external designer, permanently). Use the Stone theme (ADR-087)
   as the token value reference, mapped to shadcn/ui CSS variables
   (ADR-097), and do not hardcode a custom brand hex. Final values are locked
   iteratively whenever they are stable (ADR-056), not waiting for a "designer
   joins" event. The Light/Dark Mode Toggle (ADR-055, amended by ADR-097) still
   runs on top of the Stone theme tokens (ADR-087) — not a new theme/token,
   its mechanism is through Tailwind `dark:` + the shadcn theme provider.
9. Outstand/X (**ADR-040**): the Project Owner sets up X BYOK manually in the
   Outstand dashboard. Do not add an env var, form, table, or application secret store
   for the X Client ID/Client Secret.
10. Publishing media: Supabase Storage holds the original; the Outstand Media API
    holds the working copy after the upload URL → `PUT` → confirm flow. Do not
    treat a Supabase signed URL as an Outstand publish URL.
11. Claude Code ↔ Cursor tool compatibility (ADR-064) — see the table below.

---

## Tool compatibility: Claude Code ↔ Cursor (ADR-064)

This project is worked in **two tools**: Claude Code (primary) and Cursor.
Some agent assets are readable in both, some are not:

| Asset                                                           | Claude Code                                     | Cursor                                          |
| --------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `AGENTS.md` (entry point + hard rules)                          | ✅ via `CLAUDE.md`                              | ✅ native                                       |
| `.claude/skills/`                                               | ✅ the only location                            | ✅ compatibility path                           |
| `.claude/agents/` (7 working subagents)                         | ✅                                              | ✅ compatibility path                           |
| MCP config (`xds`, `supabase`, `railway`, `shadcn`, `outstand`) | ✅ `.mcp.json`                                  | ⚠️ `.cursor/mcp.json` — **separate file**       |
| Secret-read protection                                          | ✅ `.claude/settings.json` (`permissions.deny`) | ⚠️ `.cursorignore` — **separate file**          |
| `.claude/launch.json` (preview server)                          | ✅                                              | ❌ no counterpart — run the dev server manually |

**Two twin file pairs that MUST be kept in sync.** The MCP config and secret
protection have no cross-tool compatibility path — each tool
reads only its own format, and they cannot be unified through a symlink without
repeating the fragile pattern that was dropped in ADR-064. The consequences:

1. Adding/changing an MCP server → change **`.mcp.json` and `.cursor/mcp.json`**
   in the same change. The format is identical (`mcpServers` key).
2. Adding/changing a secret-file pattern → change **`permissions.deny` in
   `.claude/settings.json` and `.cursorignore`** in the same change.
   If only one is changed, one of the tools loses its protection
   without any warning.

Other rules (skills, subagents, hard rules, documentation flow) apply identically in
both tools — there are no per-tool instructions other than the table above.

---

## Related context

- System architecture → `ctx-architecture.md`
- Scripts, lint, coding conventions → `ctx-development.md`
- Feature patterns in code → `ctx-implementation.md`
