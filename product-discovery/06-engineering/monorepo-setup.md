# Monorepo Setup

This document defines the **Hybrid Monorepo structure**, the Bun Workspaces configuration, the application folder layout, and the import rules that apply to the Postific project.

This document is the concrete implementation of ADR-001 (Hybrid Monorepo), ADR-002 (Bun), ADR-003 (Next.js), and ADR-004 (Modular Monolith + DDD). The domain module structure is aligned with domain-model.md; the App Router routing structure is aligned with information-architecture.md.

---

# Goals

- Set the monorepo folder structure definitively before Repository & Bootstrap (M7) begins.
- Define the apps/ and packages/ workspace layout along with the responsibilities of each.
- Define the Bun Workspaces configuration (root `package.json`).
- Set the App Router routing structure that mirrors the Information Architecture.
- Define the internal structure of each domain module.
- Set the cross-domain import rules that must be obeyed across the whole codebase.

---

# Monorepo Root Structure

```
social-media-management/          ← monorepo root
├── apps/
│   └── web/                      ← main Next.js application
├── packages/
│   └── shared/                   ← @postific/shared — cross-domain shared types
├── product-discovery/            ← product documentation (not code)
├── project-os/              ← project OS (not code)
├── package.json                  ← Bun Workspaces root config
├── tsconfig.json                 ← TypeScript base config
├── .gitignore
└── README.md
```

**Root principles:**

- `apps/` → one or more deployable applications.
- `packages/` → shared libraries consumed by one or more apps.
- Documentation folders (`product-discovery/`, `project-os/`) are not part of the workspace — not processed by Bun.

---

# Bun Workspaces Configuration

The root `package.json` file registers all the workspaces managed by Bun:

```json
{
  "name": "social-media-management",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "bun run --cwd apps/web dev",
    "build": "bun run --cwd apps/web build",
    "typecheck": "bun run --cwd apps/web typecheck",
    "lint": "eslint .",
    "test": "vitest run",
    "format": "prettier --write ."
  }
}
```

> The complete scripts (`lint:fix`, `format:check`, `test:watch`, `db:*`) and related tooling are in `dx-tooling.md` (ADR-034). The snippet above is the minimal root contract.

**Workspace rules:**

- Every workspace has its own `package.json` with a unique `name`.
- Packages within the workspace reference each other via the workspace protocol: `"@postific/shared": "workspace:*"`.
- The lockfile (`bun.lock`) is at the root — one lockfile for the whole monorepo.
- Do not install dependencies directly at the root except for monorepo-level tooling (e.g. TypeScript, ESLint config).

---

# apps/web — Next.js Application

The only application in the MVP phase.

## Package Config

```json
{
  "name": "@postific/web",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@postific/shared": "workspace:*"
  }
}
```

## Folder Structure

```
apps/web/
├── src/
│   ├── app/                      ← Next.js App Router (routing & UI)
│   ├── domains/                  ← Domain Logic (9 BC MVP; Billing post-MVP)
│   ├── components/               ← shadcn/ui + feature components (migrated from Astryx, ADR-097)
│   ├── lib/                      ← Infrastructure Clients & Utilities
│   └── proxy.ts                  ← Auth guard + workspace context injection (Next.js 16 "Proxy", formerly middleware.ts)
├── public/                       ← Static assets
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## src/app/ — App Router Structure

The routing structure mirrors the Information Architecture from `product-discovery/04-ux/information-architecture.md`.

```
src/app/
├── layout.tsx                    ← Root layout (HTML, global providers)
├── page.tsx                      ← Redirect to (app) or onboarding
│
├── (auth)/                       ← Route group: auth pages (without the application layout)
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── forgot-password/
│       └── page.tsx
│
├── select-workspace/             ← MCP OAuth consent screen step 1: choose workspace (outside (app); T-151, ADR-139)
│   └── page.tsx
├── consent/                      ← MCP OAuth consent screen step 2: scope and consent (outside (app); T-151, ADR-139)
│   └── page.tsx
│
├── (app)/                        ← Route group: main post-login application (workspace context from cookie)
│   ├── layout.tsx                ← App layout (sidebar nav, resolve workspace context from cookie)
│   ├── page.tsx                  ← Home — Today's Schedule, Recent Activity, Snapshots (application root; ADR-046)
│   │
│   ├── publish/
│   │   ├── layout.tsx            ← Publish sub-nav (Calendar / Queue / Drafts / History); where the Draft Editor modal state is mounted (ADR-052)
│   │   ├── page.tsx              ← Permanent redirect to /publish/calendar (ADR-046 Final Amendment — permanent exception)
│   │   ├── calendar/
│   │   │   └── page.tsx          ← Content Calendar (default tab; IA-D04)
│   │   ├── queue/
│   │   │   └── page.tsx          ← Queue Management
│   │   ├── drafts/
│   │   │   └── page.tsx          ← Drafts list
│   │   └── history/
│   │       ├── page.tsx          ← Published History
│   │       └── [postId]/
│   │           └── page.tsx      ← Post Detail (a separate screen, KSP-D10 — NOT part of ADR-052)
│   │
│   ├── engage/
│   │   └── page.tsx              ← Engagement Inbox (the only Engage screen; ADR-046)
│   │
│   ├── analyze/
│   │   └── page.tsx              ← Analytics Dashboard
│   │
│   ├── start-page/
│   │   └── page.tsx              ← Start Page Editor + Preview
│   │
│   └── settings/                 ← Organization Settings + Account Settings — one section, two sidebar groups
│       ├── layout.tsx            ← Settings sub-nav (Organization group + Account group)
│       ├── page.tsx              ← Organization → General — workspace name, timezone, brand (default tab; ADR-046)
│       ├── connected-accounts/
│       │   └── page.tsx          ← Organization → Social account management
│       ├── members/
│       │   └── page.tsx          ← Organization → Team members
│       ├── roles/
│       │   └── page.tsx          ← Organization → Roles & permissions
│       ├── billing/
│       │   └── page.tsx          ← Organization → Billing (Post-MVP, placeholder page)
│       └── account/               ← Account group
│           ├── page.tsx          ← Account → Profile — name, photo, email (default tab, same pattern as Organization General)
│           ├── notifications/
│           │   └── page.tsx      ← Account → Notification preferences
│           ├── ai-clients/
│           │   └── page.tsx      ← Account → Klien AI: list and revoke AI client connections (T-156)
│           └── preferences/
│               └── page.tsx      ← Account → Personal display preferences
│
└── api/                          ← Route Handlers (external / platform only)
    ├── auth/
    │   └── [...all]/
    │       └── route.ts          ← Better Auth catch-all (session, OAuth callback, etc.)
    ├── health/
    │   └── route.ts              ← Health check endpoint
    ├── jobs/
    │   └── run/
    │       └── route.ts          ← Job runner (Railway Cron → X-Job-Secret)
    ├── mcp/
    │   └── route.ts              ← MCP Server endpoint, Streamable HTTP (ADR-139); bypasses proxy.ts
    └── webhooks/
        └── outstand/
            └── route.ts          ← raw body HMAC → durable receipt → ACK 2xx

.well-known/                      ← MCP OAuth metadata (/.well-known/*; ADR-139); bypasses proxy.ts
```

**Routing rules:**

- The route group `(app)` wraps the whole post-login application. The workspace context is resolved from the **cookie** (read & its membership validated by `src/proxy.ts`), not from the URL. The user is still effectively in 1 workspace; there is no workspace switcher in the URL (see `auth-architecture.md`, "Workspace Context Resolution").
- The route group `(auth)` does not inherit the `(app)` layout — it renders an empty page without a sidebar.
- `api/` is only for platform/external Route Handlers: Better Auth (`/api/auth/*`), health check, the job runner (`/api/jobs/run`), and webhooks. UI mutations use Server Actions, not internal API routes.
- `/api/auth/*` and `/api/jobs/*` are bypassed from the session Middleware/Proxy — auth itself is protected by Better Auth; the job runner is protected by the `X-Job-Secret` header (see `auth-architecture.md`, `deployment-infrastructure.md`).
- `/api/mcp` and `/.well-known/*` (MCP Server, ADR-139) are excluded from `src/proxy.ts`; token and member validation is done in the Route Handler, without business logic (it calls `McpAccessService`). The OAuth consent screens `/select-workspace` then `/consent` sit outside the `(app)` route group (T-151).
- `/api/webhooks/outstand` must read the raw body before parsing. The route calls the WebhookIngestion Application Service to write an idempotent `outstand_webhook_events` and enqueue `outstand.webhook.process`; business processing does not run inline.
- `billing/` exists in the MVP routing but the page shows a placeholder — implementation is Post-MVP.
- **Settings consists of two groups in one section**: the **Organization** group (General, Connected Accounts, Members, Roles, Billing) and the **Account** group (Profile, Notifications, Preferences) — both accessed via the same Settings sidebar, with a single entry point from the avatar/user menu.
- A section with a default/single view (Home, Engage → Inbox, Settings →
  Organization General, Settings → Account Profile) renders directly in
  `page.tsx` at its section/group root path — not a separate named child
  segment (`/home`, `/inbox`, `/general`, `/account/profile` do not exist
  as paths). This rule applies both at the section level (`settings/`)
  and at the group level within it (`settings/account/`) — both must
  have their own `page.tsx` for their respective default tab. Non-default sub-screens
  still have an explicit segment (`queue`, `drafts`, `history`,
  `connected-accounts`, `members`, `roles`, `billing`, `account/notifications`,
  `account/preferences`). A segment that only functions as a container
  (`layout.tsx` without its own `page.tsx`, or without either) must not
  be left in place — every section/group must have a `page.tsx` at its root path
  (ADR-046).
- **Permanent exception — Publish:** `/publish` redirects to
  `/publish/calendar` (not rendered directly), because `calendar/` stays
  as a static folder to prevent `publish/[postId]` from wrongly catching the
  old path. This is a final decision, not an interim one — see
  ADR-046 Final Amendment (2026-07-29) in `DECISIONS.md`.

**Local `components/` folder naming & placement (KI-010, ADR-069):**

1. **File naming** — only files that actually export a React
   component use PascalCase, the same as their export name (e.g.
   `Modal.tsx`, not `modal.tsx`). Non-component files (Server Actions
   like `actions.ts`, helpers/pure functions like `status-badge.ts`,
   or files that only hold a data map like `platform-icons.tsx`) stay
   kebab-case — they do **not** follow PascalCase.
2. **Folder naming** — all folders stay kebab-case, there are **no**
   PascalCase folders. Composite folders that previously used an underscore
   prefix (`_draft-editor`, `_sidebar-channels`) only lose their
   underscore (`draft-editor`, `sidebar-channels`) — they do not
   become PascalCase.
3. **Placement** — the `components/` folder goes at the lowest common
   ancestor (_LCA_) of all users of that
   component in the App Router route tree:
   - Used in only 1 route → a local `components/` right in that route.
   - Used across several routes within one subtree → `components/` at the
     level of the lowest ancestor route that covers all users.
   - Used across unrelated subtrees (including being used from the root
     `app/layout.tsx`) → **not** moved up to a new folder in `app/`,
     but moved to `src/components/` — the existing shared location
     (see the section `## src/components/ — UI Components` below).
     There are only 2 placement buckets: local (`app/**/components/`) or
     shared (`src/components/`), no third "`app/` root" bucket.
   - Files required by Next.js (`page.tsx`, `layout.tsx`, `route.ts`) are
     unaffected — they stay lowercase per the framework contract and do not go into the
     `components/` folder.

Example — `draft-editor` is used across several routes inside `(app)/`,
so its LCA is `app/(app)/`:

```text
app/(app)/components/draft-editor/
├── Context.tsx           ← component, PascalCase
├── Modal.tsx              ← component, PascalCase
├── Mount.tsx               ← component, PascalCase
├── actions.ts              ← Server Action, kebab-case
├── status-badge.ts         ← pure helper, kebab-case
└── terminal-destination.ts ← pure helper, kebab-case
```

The reference to this convention also applies to `src/components/[feature]/` —
see the rules below under `## src/components/ — UI Components`.

---

## src/domains/ — Domain Modules

Each **MVP** Bounded Context has its own folder in `src/domains/`. Aligned with the folder reference in `domain-model.md`.

The MVP contains **9 domain modules**. BC-10 Billing is post-MVP — there is no `billing/` folder in `src/domains/` until Billing is implemented; the Settings → Billing route still exists as a placeholder page (see the App Router above).

```
src/domains/
├── identity/           ← BC-01
├── workspace/          ← BC-02
├── publishing/         ← BC-03
├── mcp-access/         ← BC-04 (ADR-138)
├── engagement/         ← BC-05
├── analytics/          ← BC-06
├── start-page/         ← BC-07
├── media/              ← BC-08
└── notification/       ← BC-09
# BC-10 Billing — post-MVP (no module folder yet)
```

### Internal Structure per Domain

Each domain follows a consistent four-layer structure:

```
src/domains/[domain]/
├── index.ts                      ← Public API (barrel export — the only file that may be imported from outside)
├── types.ts                      ← Domain-specific types & interfaces
├── errors.ts                     ← Domain error classes
├── entities/                     ← Domain entities & aggregates
│   └── [entity].ts
├── value-objects/                ← Value objects
│   └── [vo].ts
├── repositories/                 ← Repository interfaces (not implementations)
│   └── [repo].interface.ts
└── services/                     ← Application Service
    └── [domain]-service.ts
```

**What is in `index.ts` (the barrel):**

- Export the Application Service class/factory.
- Export domain-specific types consumed by Entry Points.
- Export repository interfaces (for dependency injection).

**What is not exported from `index.ts`:**

- Internal entity implementations.
- Repository implementations (they are in `src/lib/`).
- Helper functions used only internally by the domain.

---

## src/components/ — UI Components

```
src/components/
├── ui/                           ← shadcn/ui components (copied by the CLI/MCP) + selective wrappers
└── [feature]/                    ← Feature-specific components (co-located with the domain that uses them)
```

**Rules:**

- **shadcn/ui is the permanent component system foundation** (ADR-097, reversing
  ADR-041). The migration from Astryx is complete (release v0.7, T-102); its history
  is in `tickets/v07-astryx-shadcn-migration.md`.
- `ui/` holds the shadcn components copied by the CLI/MCP; additional wrappers are made
  only for critical components, widely used components, consistent application
  defaults, or product behavior adaptation.
- Simple shadcn components that are only used locally may be imported
  directly from their copied location in `ui/`.
- Tailwind is used directly as the styling of shadcn components (no longer
  layout-only like the Astryx era).
- Use the Stone theme tokens (ADR-087) as the value reference during feature
  development, mapped to the shadcn CSS variables. `@stylexjs/stylex` is removed
  entirely from the project dependencies (ADR-082, now irrelevant because
  Astryx itself is no longer used).
- Feature components must not contain business logic — the logic is in domain services.
- **Naming follows the same rules as the local `components/` in
  `src/app/`** (see "Local `components/` folder naming & placement
  (KI-010, ADR-069)" in the section `## src/app/ — App Router Structure`): files that
  export a React component use PascalCase (`ChannelsSection.tsx`),
  `[feature]/` folders and non-component files (helpers, data maps, etc.) stay
  kebab-case. This rule applies to every `[feature]/` in
  `src/components/`, not only to `components/` inside `app/`.

---

## src/lib/ — Infrastructure Clients & Utilities

```
src/lib/
├── prisma/
│   └── client.ts                 ← PrismaClient singleton (server-only; domain CRUD)
├── supabase/
│   ├── client.ts                 ← Supabase browser client (Realtime)
│   ├── server.ts                 ← Supabase server client (Storage; not domain CRUD)
│   └── middleware.ts             ← Supabase client for the Proxy (if needed; this lib file's name stays "middleware.ts", it does not follow the src/proxy.ts file convention rename)
├── better-auth/
│   └── auth.ts                   ← Better Auth instance & config (Prisma adapter)
├── outstand/
│   └── adapter.ts                ← ACL: webhook mapping, media upload, comments/replies
├── repositories/                 ← Repository implementations (Prisma-based)
│   ├── identity/
│   ├── workspace/
│   ├── publishing/
│   └── ...
└── utils/
    └── errors.ts                 ← App-level error utilities
```

The Prisma schema & migrations are in `apps/web/prisma/` (see `database-orm.md`).

**Rules:**

- Repository implementations are in `src/lib/repositories/` — not inside the domain folder.
- The domain only defines interfaces; the implementations in `lib/` use the **Prisma Client** (ADR-031).
- The Supabase client is **not** used for domain CRUD — only Realtime and Storage (`database-orm.md` DO-D02).
- `apps/web/src/lib/supabase/client.ts`, `server.ts`, and `middleware.ts` are different contexts — do not use the wrong one (client.ts in a Server Component will error).

---

# packages/shared — @postific/shared

A package for shared types consumed across domains or across applications.

```
packages/shared/
├── src/
│   ├── ids.ts                    ← Branded ID types (WorkspaceId, PostId, UserId, etc.)
│   ├── enums.ts                  ← Shared enums (ContentStatus, MemberRole, Platform, etc.)
│   └── value-objects.ts          ← Shared value objects (Email, URL, etc.)
├── index.ts                      ← Barrel export
├── package.json                  ← { "name": "@postific/shared" }
└── tsconfig.json
```

**Package config:**

```json
{
  "name": "@postific/shared",
  "version": "0.1.0",
  "main": "./index.ts",
  "exports": {
    ".": "./index.ts"
  }
}
```

**Rules:**

- `@postific/shared` must not import from `@postific/web` or any domain — only pure types, enums, and value objects.
- Add to shared only if a type is actually used by more than one domain.
- Do not move business logic into shared — shared is not a "common domain", only type contracts.

---

# TypeScript Configuration

## Root tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true
  }
}
```

## apps/web/tsconfig.json

Extends the root config and adds path aliases:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@postific/shared": ["../../packages/shared/index.ts"]
    }
  }
}
```

**Path aliases used:**

- `@/*` → `src/*` — any import inside apps/web without long relative paths.
- `@postific/shared` → configured via Bun Workspaces, no manual alias needed in production.

---

# Import Rules

These rules originate from BR-01 through BR-06 in `domain-model.md` and must be obeyed across the whole codebase.

## Mandatory Rules

**IR-01 — Import a Domain Only via the Barrel**

```typescript
// ✅ CORRECT
import { PublishingService } from "@/domains/publishing";

// ❌ FORBIDDEN — importing an internal domain file
import { PublishingService } from "@/domains/publishing/services/publishing-service";
```

**IR-02 — A Domain Must Not Import Another Domain Directly**

```typescript
// ✅ CORRECT — domains communicate via an Application Service or service interface
// (Orchestration in the Application Service, not in the domain logic)

// ❌ FORBIDDEN — a domain importing another domain
import { WorkspaceService } from "@/domains/workspace"; // inside publishing/services/
```

**IR-03 — A Domain Must Not Import from src/lib/**

```typescript
// ✅ CORRECT — the repository interface is in the domain, the implementation is injected
// The domain only knows the IPostRepository interface, not PrismaPostRepository

// ❌ FORBIDDEN
import { prisma } from "@/lib/prisma/client"; // inside domain entities/
```

**IR-04 — Entry Points May Only Call an Application Service**

```typescript
// ✅ CORRECT — a Server Action calls an Application Service
import { PublishingService } from "@/domains/publishing";
const service = new PublishingService(/* repo injected */);
await service.schedulePost(input);

// ❌ FORBIDDEN — a Server Action calling a repository directly
import { postRepository } from "@/lib/repositories/publishing/post-repository";
await postRepository.save(post);
```

**IR-05 — @postific/shared Must Not Import Anything from the Monorepo**

```typescript
// ✅ CORRECT — shared only contains pure types, enums, value objects
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };

// ❌ FORBIDDEN — shared importing from a domain or lib
import { something } from "@/domains/workspace"; // inside packages/shared/
```

---

# Decision Log

| ID     | Decision                                                                                                                                                                                                                                                                                                | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Alternatives                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MS-D01 | `apps/web` as the only application in the MVP                                                                                                                                                                                                                                                           | Per ADR-004 Modular Monolith — a single deployment unit until there is a strong reason to separate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Multi-app from the start (premature separation)                                                                                                                                                                                                        |
| MS-D02 | Domain modules in `src/domains/` inside apps/web, not as separate workspace packages                                                                                                                                                                                                                    | Domain logic is tightly coupled with the Next.js entry points in the MVP phase — separating into packages adds indirection without real benefit for a single app                                                                                                                                                                                                                                                                                                                                                                                                                                              | packages/identity, packages/publishing, etc.                                                                                                                                                                                                           |
| MS-D03 | App Router routing uses the route group `(app)` to wrap Home, Publish, Engage, Analyze, Start Page, Settings — the workspace context is resolved from the **cookie**, not a dynamic URL segment                                                                                                         | The user is still effectively in 1 workspace (Multi Workspace Management stays Out of Scope); a dynamic segment in the URL adds routing complexity without real benefit as long as there is no switching between workspaces via the URL. `(app)` is chosen as the idiomatic pair for `(auth)` (pre-login vs the main post-login application), a common Next.js convention that is neutral about implementation details — aligned with `auth-architecture.md` (Workspace Context Resolution)           | A dynamic workspace segment in the URL (e.g. `[slug]`); a `?workspace=slug` query param (less clean, not SEO-friendly); other route group names like `(dashboard)`, `(workspace)` (less explicit in pairing with `(auth)`)                             |
| MS-D04 | `packages/shared` only for branded IDs, enums, and value objects used by 2+ domains                                                                                                                                                                                                                     | Prevents shared from becoming a "junk drawer" — only types that are genuinely cross-domain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No shared package, each domain redefines (duplication)                                                                                                                                                                                                 |
| MS-D05 | Repository implementations are in `src/lib/repositories/`, not inside the domain folder                                                                                                                                                                                                                 | The domain only knows interfaces — implementations are injected, easing testing and replacing infrastructure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Repository implementation inside the domain folder (mixes domain logic and infrastructure)                                                                                                                                                             |
| MS-D06 | The Outstand webhook route is ingestion only; the processor runs as JOB-01                                                                                                                                                                                                                              | Durable-before-ACK and internal retry are not mixed with vendor HTTP delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| MS-D07 | `src/lib/outstand/` becomes the ACL implementation location                                                                                                                                                                                                                                             | All vendor contracts, including media upload and comments/replies, are isolated from the domain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| MS-D08 | ADR-040                                                                                                                                                                                                                                                                                                 | MS-D06–D07 amend the route/infrastructure details of the Engineering Baseline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| MS-D09 | A section's default/single view renders directly at the root path (`page.tsx`), not a named child segment (`/home`, `/engage/inbox`, `/settings/general` removed). Publish is a **permanent** exception — `/publish` redirects to `/publish/calendar` (`calendar/` stays as a static folder)         | Closes the systemic 404 gap at the section root + aligns with professional navigation patterns (GitHub, Vercel, Notion); Publish is permanently excepted because it is the only section with a dynamic sibling route (`[postId]`) at the root — root-rendering there would wrongly catch `/publish/calendar`                                                                                                                                                                                                                                                                                                   | Redirect to the default child; a shared component at two URLs; root-render + rename `[postId]`; root-render + an intercepting route — see ADR-046 (+ Final Amendment 2026-07-29)                                                                       |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `deployment-infrastructure.md` — deploy & build from the monorepo root
- `dependency-strategy.md` — versioning, lockfile, dep placement, shared rules (ADR-035)
- `dx-tooling.md` — root scripts and monorepo tooling
- `../../product-discovery/05-architecture/domain-model.md` — domain modules and boundary rules
- `../../product-discovery/05-architecture/application-layer.md` — layer stack and entry point patterns
- `../../product-discovery/05-architecture/auth-architecture.md` — Middleware workspace context
- `../../product-discovery/04-ux/information-architecture.md` — screen hierarchy (the basis of the routing structure)
- `../../project-os/DECISIONS.md` — ADR-001, ADR-002, ADR-003, ADR-004, ADR-026, ADR-035
