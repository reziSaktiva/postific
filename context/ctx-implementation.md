# Context — Implementation

An index of **how to write a feature in this repo**: folder structure, the entry → service → domain → repository flow, and import prohibitions.  
Style / DX conventions → `ctx-development.md`.  
Architecture decisions → `ctx-architecture.md`.

---

## Read first

| Document                                                                                                                 | Topic                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [`../product-discovery/05-architecture/application-layer.md`](../product-discovery/05-architecture/application-layer.md) | Service, repository, entry point contracts, error handling                                |
| [`../product-discovery/06-engineering/rendering-strategy.md`](../product-discovery/06-engineering/rendering-strategy.md) | Server Component/Server Action boundary when writing a new entry point (ADR-016, ADR-095) |
| [`domain-model.md`](../product-discovery/05-architecture/domain-model.md)                                                | BC & boundary                                                                             |
| [`integration-layer.md`](../product-discovery/05-architecture/integration-layer.md)                                      | Outstand ACL — when touching publish/webhook/OAuth                                        |
| [`../product-discovery/06-engineering/monorepo-setup.md`](../product-discovery/06-engineering/monorepo-setup.md)         | `apps/web`, `packages/shared` layout                                                      |

---

## Code layout (quick recall)

```text
apps/web/
├── prisma/                  ← schema + migrations
├── src/
│   ├── app/                 ← Next.js App Router (entry points only)
│   ├── domains/
│   │   ├── identity/
│   │   ├── workspace/
│   │   ├── publishing/
│   │   ├── mcp-access/
│   │   ├── engagement/
│   │   ├── analytics/
│   │   ├── start-page/
│   │   ├── media/
│   │   └── notification/
│   └── lib/                 ← prisma, better-auth, env, supabase stubs
packages/shared/             ← ID, enum, VO — no business logic
```

Note: the `mcp-access/` domain was created in T-149 and the `ai-assistant/` stub has been removed (ADR-138).

Every domain module has a public surface via `index.ts` (and types/errors per the M7 scaffold).

---

## Feature implementation flow

```text
UI / Route / Server Action / Route Handler
    → Application Service (domain module)
        → Domain rules / entities
        → Repository interface → Prisma implementation (infrastructure)
```

Data fetching in a Server Component (`page.tsx`) calls the Application Service
directly, **not** a Server Action — detail in `rendering-strategy.md` (RS-D02).

Webhook / cron / external → Route Handler or job runner → Application Service
(no logic in the handler). For Outstand webhooks specifically, the receipt must be durable before
ACK; domain processing runs after ACK through an internal job.

---

## UI Components (ADR-097, reversing ADR-041)

- **shadcn/ui is the permanent component system foundation** (ADR-097, reversing
  ADR-041). The migration from Astryx to shadcn/ui is complete (ADR-097); for status detail
  see `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md`
  § T-102; features do not wait for final design tokens. The Light/Dark Mode Toggle
  (ADR-055, amended by ADR-097) remains an
  official feature — its mechanism is through Tailwind `dark:` + the shadcn theme provider,
  `ThemeModeContext`/`useThemeMode` (`apps/web/src/components/Providers.tsx`)
  do not change.
- `src/components/ui/` holds **selective** wrappers/re-exports for components
  that are critical, widely used, need consistent defaults, or adapt product behavior.
- shadcn/ui is source code that is _copied_ into the repo (not a closed package
  dependency like Astryx used to be) — there is no Beta/canary versioning
  issue; simple components used only locally may be imported
  directly from the location of their copy.
- Tailwind is used directly as the main styling for shadcn components (no longer
  layout-only like in the Astryx era, ADR-097 point 4).
- The final values of `design-tokens.md` (co-equal with the design artifact, not
  waiting for an external designer — ADR-140, ADR-057) are mapped to shadcn
  CSS variables + the Tailwind token bridge without replacing the component foundation.
- Naming & placement of component files/folders (PascalCase for files that
  export a component, kebab-case for folders & helpers, placement of
  `components/` based on the lowest common ancestor of its consumers) follows the
  conventions in `monorepo-setup.md` section `## src/app/ — App Router
Structure` (ADR-069, resolution of KI-010).

---

## Operating rules

1. Hard rules for entry point / domain logic / cross-domain / shared types —
   see **`../AGENTS.md` rules 5-8**, not repeated here. (Server Actions
   for mutation only — see `rendering-strategy.md`.)
2. **One Application Service per BC** — orchestration, authorization (RBAC), repo coordination.
3. **Repository**: two layers — the interface (`IXxxRepository`) in
   `apps/web/src/domains/<domain>/repositories/`, the real Prisma implementation
   in `apps/web/src/lib/repositories/<domain>/`. The domain layer only
   depends on the interface (hard rule 6 of `AGENTS.md` — the domain must not
   import Prisma directly); the Server Action/Application Service
   _injects_ the Prisma implementation from `lib/repositories`. Precedent:
   `domains/publishing/repositories/publishing.repository.ts` ↔
   `lib/repositories/publishing/`.
4. **Separate use-case class**: if a flow needs an additional dependency
   that must be in the constructor (e.g. `IOutstandAdapter`) and the order of its
   operations is critical (persist first → call the adapter → persist the outcome),
   put it as a separate use-case class (`xxx.use-case.ts`) — not a new method
   on that domain's general service. The goal is that forgetting to pass the
   dependency is caught by TypeScript at the call site (compile error), instead of
   blowing up only at runtime. Precedent: `SchedulePostsUseCase`,
   `PublishNowUseCase`, `CancelScheduleUseCase`
   (`domains/publishing/services/*.use-case.ts`),
   `AnalyticsIngestionUseCase` (`domains/analytics/services/`).
5. **Outstand**: only through the adapter/ACL — see `integration-layer.md`.
6. **Billing (BC-10)**: do not implement as an MVP feature unless the decision changes + an ADR.
7. DB schema: align with `database-strategy.md` + `schema.prisma`; migrate through Prisma Migrate.
8. **Outstand contract ADR-040:** do not build comment/DM webhook handlers,
   do not send Supabase signed URLs as publish media, and do not
   ask the application user for the X secret. Use the three official webhook events,
   the Outstand Media API working copy, the 30-minute comment sync/manual refresh, and
   manual X BYOK in the Outstand dashboard.
9. The existence of a documentation or schema contract is **not** proof that the runtime is already
   implemented. When starting M8, verify the services, adapters, handlers, jobs,
   and tests that actually exist before relying on them.

---

## New feature checklist (brief)

1. Identify the BC + read the service contract in `application-layer.md`.
2. Check roles/status in `roles-permissions.md` if touching access or content workflow.
3. Check the UX flow in `04-ux/` (pointer in `ctx-design.md`) if there is UI.
4. If touching Outstand, read ADR-040 and the contract checklist in
   `ctx-architecture.md`.
5. Implement in `domains/<bc>/` + a thin entry point in `app/`.
6. If there is UI, follow the shadcn/Tailwind boundary above and the UX Baseline through
   `ctx-design.md`.
7. Run the checklist in `ctx-development.md`.

---

## Related context

- Coding/DX → `ctx-development.md`
- Architecture "why" → `ctx-architecture.md`
- Technical stack → `ctx-technical-context.md`
- Domain map → `ctx-domain.md`
