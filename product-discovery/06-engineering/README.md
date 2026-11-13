# 06 — Engineering Planning

The documentation in this folder focuses on **Engineering Planning** for the **Postific** product, covering every technical decision that must be settled before code implementation begins.

All documentation in this folder must refer to the agreed **Business Baseline v1.0**, **Product Baseline v1.0**, **User Discovery Baseline v1.0**, **UX Planning Baseline v1.0**, and **System Architecture Baseline v1.0**. This folder itself is established as the **Engineering Planning Baseline v1.0** (ADR-036) and is the mandatory reference for Repository & Bootstrap (M7).

---

# Goals

- Document every technical decision that affects architecture and implementation.
- Fix the technology stack definitively before the first line of code is written.
- Define the infrastructure, deployment, and environment setup.
- Draft the CI/CD strategy and developer workflow.
- Serve as the mandatory reference before Repository & Bootstrap begins.

---

# Scope

This folder covers **Engineering Planning** only.

Topics in scope:

- **Monorepo & Workspace Setup** — folder structure, workspace tooling, Bun workspaces.
- **Deployment & Infrastructure** — hosting platform, region, staging vs production.
- **Authentication Strategy** — library, session management, provider, token strategy.
- **Database & ORM** — chosen ORM, migration strategy, connection pooling.
- **CI/CD Pipeline** — tooling, trigger, environment, test gates, deployment workflow.
- **Environment Management** — environment variables, secret management, local vs staging vs production.
- **Package & Dependency Strategy** — versioning, lockfile, shared packages.
- **Developer Experience (DX) Tooling** — linting, formatting, pre-commit hooks, local dev setup.
- **UI Component System** — shadcn/ui as the permanent foundation (ADR-097,
  reversing ADR-041), Tailwind as direct styling, and selective wrappers;
  the migration from Astryx is complete (release v0.7, T-102).
- **Design Tokens** — Source of Truth for fonts, semantic colors, neutrals,
  status, and spacing for UI implementation (ADR-038, ADR-041); final values
  evolve iteratively, co-equal with the Postific design artifact (ADR-140),
  without waiting for an external designer (ADR-056, ADR-057, ADR-140).

The following topics are **not covered** in this folder:

- Detailed wireframes, visual exploration, and designer handoff briefs — the
  `design/` folder has been removed (ADR-045); the pointer to the Postific design
  artifact (ADR-140) is in `../../context/ctx-design.md`
- Product Scope and Feature Priority (already in 02-product)
- High-level System Architecture (in 05-architecture)
- Code implementation (in the Development phase)
- Detailed database schema (in the Development phase)

---

# Document List

- `monorepo-setup.md` — Hybrid Monorepo structure, workspace layout, Bun workspaces.
- `deployment-infrastructure.md` — deployment platform (Railway), region, environment strategy.
- `auth-strategy.md` — authentication library (Better Auth), session, provider, token.
- `database-orm.md` — Prisma as the formal ORM (ADR-031), the Supabase client boundary (Realtime/Storage), Prisma Migrate, connection pooling.
- `cicd-pipeline.md` — GitHub Actions quality gates, staging→main promotion, Railway CD, migrate on release (ADR-032).
- `environment-management.md` — env var catalog, native secrets (Railway + `.env.local`), Supabase Cloud staging / prod, local sharing the same staging project (ADR-033, amendment to ADR-081).
- `dx-tooling.md` — ESLint + Prettier, Lefthook + lint-staged, Vitest, workspace scripts (ADR-034).
- `dependency-strategy.md` — caret ranges, root `bun.lock`, dependency placement,
  `@postific/shared` rules, manual updates (ADR-035); the Astryx Beta exact-pin
  exception superseded by the shadcn/ui migration (ADR-097).
- `design-tokens.md` — SoT for visual tokens (font,
  brand/neutral/status/feedback colors, spacing); Stone theme tokens (ADR-087)
  mapped to shadcn/ui (ADR-097), final values locked iteratively, co-equal
  with the Postific design artifact (ADR-140), without waiting for an external designer
  (ADR-038, ADR-056, ADR-057, ADR-140).

---

# Engineering Planning Workflow

The whole Engineering Planning process follows this flow:

```text
System Architecture Output
        ↓
Monorepo & Workspace Setup
        ↓
Deployment & Infrastructure
        ↓
Authentication Strategy
        ↓
Database & ORM
        ↓
CI/CD Pipeline
        ↓
Environment Management
        ↓
DX Tooling & Dependency Strategy
        ↓
Engineering Planning Baseline v1.0 (ADR-036)
        ↓
Repository & Bootstrap (M7)
```

Every significant technical decision must be recorded as an ADR in `../../project-os/DECISIONS.md`.

---

# How to Use

1. Start with `monorepo-setup.md` to set the workspace structure.
2. Decide the deployment platform and environments in `deployment-infrastructure.md`.
3. Set the auth library and session strategy in `auth-strategy.md`.
4. Decide the ORM and migration strategy in `database-orm.md`.
5. Draft the CI/CD pipeline in `cicd-pipeline.md`.
6. Document the env and secret strategy in `environment-management.md`.
7. Set the DX tooling in `dx-tooling.md`.
8. Document the dependency rules in `dependency-strategy.md`.
9. Use all the outputs as the reference for Repository & Bootstrap (M7).
10. Use the Stone theme tokens (ADR-087) and Tailwind as direct styling for
    shadcn/ui components (ADR-097) without waiting for the final tokens.
11. After the feature is done and the UI design is approved: fill in `design-tokens.md`,
    then mirror to the shadcn/ui CSS variables + Tailwind token bridge — see
    the PM guide in that document (ADR-038, ADR-097).

---

# Input from Previous Phases

## From Existing ADRs

- **ADR-001** — Hybrid Monorepo as the repository strategy.
- **ADR-002** — Bun as the JavaScript runtime and package manager.
- **ADR-003** — Next.js as the main framework.
- **ADR-004** — Modular Monolith + DDD as the architecture.
- **ADR-005** — Outstand API as the social media integration provider.

## From Product Baseline v1.0

- MVP priority domains: Publishing, Workspace, Engagement, Analytics, MCP Server (ADR-138).
- Initial scale: small team (Marketing Team), not enterprise.

## From UX Planning

- Screen and navigation patterns that affect the routing and data fetching strategy.
- Main screen patterns that affect API needs and state management.

## From System Architecture Baseline v1.0 (ADR-025)

The following decisions are already set in `product-discovery/05-architecture/` and are direct constraints on Engineering Planning:

| Topic                | Decision                                                                                | Source Document                          |
| -------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| Database Platform    | Supabase PostgreSQL Cloud                                                               | `database-strategy.md`                   |
| Multi-tenancy        | Row-Level Security with `workspace_id`                                                  | `database-strategy.md`                   |
| Schema               | Single `public` schema with domain prefix                                               | `database-strategy.md` (ADR-014)         |
| Auth Library         | Better Auth                                                                             | `auth-architecture.md` (ADR-024)         |
| Session              | HTTP-only cookie, 7 days, SameSite=lax                                                  | `auth-architecture.md`                   |
| Auth Provider MVP    | Email + Password + Google OAuth                                                         | `auth-architecture.md`                   |
| Application Layer    | Server Actions (UI mutations) + Route Handlers (webhook/external)                       | `application-layer.md` (ADR-016)         |
| Repository Pattern   | Interface in the domain, implementation via Prisma (ADR-031)                            | `application-layer.md` (ADR-017 amended) |
| Background Jobs      | PostgreSQL job queue + Railway Cron as the trigger                                      | `background-jobs.md` (ADR-022)           |
| Real-time            | Supabase Realtime only for in-app notifications                                         | `realtime-strategy.md` (ADR-023)         |
| Storage              | Supabase Storage                                                                        | `database-strategy.md`                   |
| Deployment           | Railway                                                                                 | pre-architecture decision                |
| External Integration | Outstand API via Anti-Corruption Layer (OutstandAdapter)                                | `integration-layer.md` (ADR-019)         |
| Webhook Handling     | Verify HMAC raw body → durable receipt → ACK 2xx → internal JOB-01                      | `integration-layer.md` (ADR-020, ADR-040) |
| Engagement MVP       | Comments/replies; JOB-03 pull every 30 minutes + manual refresh                         | `background-jobs.md` (ADR-040)           |
| Publishing Media     | Original in Supabase Storage; working copy via Outstand upload URL → PUT → confirm      | `integration-layer.md` (ADR-040)         |
| Twitter/X            | MVP, BYOK required in the Outstand dashboard; the app does not store the X client secret | ADR-040                                  |

The decisions in this table **do not need to be decided again** in Engineering Planning. Engineering Planning documents their technical implementation details — configuration, tooling, and operational strategy.

## Engineering Baseline Amendment — ADR-040

ADR-040 amends ADR-036 additively. Engineering must provide a raw-body-safe ingestion route, `outstand_webhook_events` persistence, an internal JOB-01 handler, a 30-minute JOB-03 scheduler + manual refresh, the Outstand media working copy flow, and a per-environment X BYOK runbook. Additive schema and migrations must follow that contract; implementation status refers only to `PROJECT_STATE.md`.

## Engineering Baseline Amendment — ADR-041

ADR-041 amends ADR-035, ADR-038, and ADR-036 additively:

- Astryx replaces shadcn/ui as the permanent component system foundation;
- the Astryx theme is used during feature development (initially neutral, replaced
  by Stone per ADR-087);
- Tailwind is limited to layout and responsive page composition;
- Astryx wrappers are built selectively, not for every component;
- feature implementation does not wait for the final design tokens;
- Astryx Beta packages use an exact stable version and are upgraded as a single
  unit; and
- broad adoption or an upgrade of Astryx must pass a UI smoke test and a Next.js
  production build.

**Follow-up amendment:** ADR-057 removes the "waiting for the designer to join"
framing from the points above (there is no external designer, permanently). ADR-082
removes the `@stylexjs/stylex` dependency entirely and permanently closes the
`swizzle` option — see `dependency-strategy.md` § Astryx Beta Exception.

**ADR-097 fully reverses ADR-041:** shadcn/ui replaces Astryx
as the permanent component system foundation. The points above stand as the
decision history of ADR-041 at that time; the currently active rule is in
`## UI Component System` above and in `dependency-strategy.md`.

---

# Expected Output

After all documents in this folder are complete, the project must have:

- Documented technical decisions that can serve as an implementation reference.
- A definitive technology stack (auth, ORM, deployment, CI/CD).
- A clear environment strategy for local, staging, and production.
- DX tooling ready for use from day one of development.
- A new ADR for every significant technical decision.
- Enough input to start Repository & Bootstrap (M7).

---

# Exit Criteria

Engineering Planning is considered complete when:

- All major technical decisions are documented.
- The deployment platform and environment strategy are set.
- The auth strategy and ORM strategy are chosen and documented.
- The CI/CD pipeline is designed.
- The DX tooling and dependency strategy are set.
- Every significant decision has an ADR in `DECISIONS.md`.
- No technical decision conflicts with System Architecture.
- `PROJECT_STATE.md` has been updated.

---

# Decision Rules

The following technical decisions **must** go into `../../project-os/DECISIONS.md`:

- A change or confirmation of the deployment platform
- A change or confirmation of the authentication library
- A change or confirmation of the ORM
- A change or confirmation of the CI/CD tooling
- A change to the monorepo structure
- A change to the environment strategy
- A change to the dependency strategy (versioning, lockfile, shared packages)
- A lock or material change of design tokens (font, brand colors, light/dark theme) — see `design-tokens.md` (ADR-038)

Changes to Engineering Planning progress must be updated in:

- `../../project-os/PROJECT_STATE.md`

---

# Related Documents

- `../../project-os/PROJECT_OVERVIEW.md`
- `../../project-os/PROJECT_RULES.md`
- `../../project-os/PROJECT_STATE.md`
- `../../project-os/DECISIONS.md`
- `../README.md`
- `../01-business/README.md`
- `../02-product/README.md`
- `../03-user/README.md`
- `../04-ux/README.md`
- `../05-architecture/README.md`
