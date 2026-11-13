# Code Conventions

This document defines code-writing conventions: the error handling hierarchy,
naming (variables, functions, types), and function structure —
turning the short rules that already exist in `ctx-development.md` and
`AGENTS.md` into a detailed reference with real examples from the code.

This document complements `monorepo-setup.md` (folder/file structure) and
`dx-tooling.md` (the lint/format tools that enforce some of the rules here
automatically — see `eslint.config.mjs`).

---

# Goals

- Document the error handling hierarchy that is already mature and consistently
  used in the code, but has never been written down as an official baseline.
- Consolidate the naming rules that are currently scattered across
  `ctx-development.md` points 9-13 into a single detailed reference with examples.
- Serve as the single reference for reviewers (Ridwan Architecture Reviewer) and
  AI agents when assessing new code for compliance.

---

# Locked Decisions (from Baseline)

| Topic | Decision | Source |
|-------|-----------|--------|
| Domain module layout & public API via `index.ts` | `monorepo-setup.md`, ADR-026 |
| Naming: components PascalCase / helper folders kebab-case / `components/` placement via LCA | ADR-069 |
| Canonical persona & role names (Raka, Maya, Sinta, Dimas, Lara / Account Owner, Admin, Creator) | ADR-074, AGENTS.md rule 8 |
| Local port + composition root for cross-domain communication without concrete imports | ADR-078 |

---

# Code Conventions Decisions (Set in This Document)

| ID | Topic | Decision |
|----|-------|-----------|
| CC-D01 | Error hierarchy | `AppError` → `ApplicationError` → 5 fixed subclasses; a separate `XxxDomainError` per domain |
| CC-D02 | Server Action error boundary | A Server Action that returns `{ error }` must use `try/catch` + `toActionError()`. The contract of `void` / `redirect` / `null` actions is not changed |
| CC-D03 | Naming — variables/functions | camelCase, verb-first for functions, boolean prefix `is`/`has`/`should` |
| CC-D04 | Naming — types/interfaces | PascalCase, no `I` prefix for new domain types/interfaces |
| CC-D05 | Naming — files/folders | Pointer to ADR-069/`monorepo-setup.md` — not duplicated here |
| CC-D06 | Function-writing structure | Validation/authorization first (throw early) → orchestration → return; pure functions separated from service classes |

---

# Error Handling

## Hierarchy (CC-D01)

Location: `apps/web/src/lib/utils/errors.ts`.

```
Error (native)
  └── AppError                  (base, has a `code: string` field)
        └── ApplicationError    (marker class, no constructor of its own)
              ├── AuthorizationError    ("AUTHORIZATION_ERROR")
              ├── NotFoundError         ("NOT_FOUND_ERROR")
              ├── ValidationError       ("VALIDATION_ERROR")
              ├── ConflictError         ("CONFLICT_ERROR")
              └── ExternalServiceError  ("EXTERNAL_SERVICE_ERROR")
```

**Rule:** An Application Service **throws** the appropriate `ApplicationError`
subclass for errors that must reach the UI/API boundary with a safe message.
An Application Service **never** catches its own domain errors — let them
bubble up to the entry point (Server Action/Route Handler) to be translated
as each one needs (structured response, HTTP status, UI error state) —
following the "Error Handling Strategy" already set in `application-layer.md`.

## Domain Errors per BC

Each of the 9 domain modules (`identity`, `workspace`, `publishing`,
`mcp-access`, `engagement`, `analytics`, `start-page`, `media`,
`notification`) has its own `errors.ts` with `XxxDomainError extends
Error` (**not** `extends AppError`) — examples: `PublishingDomainError`,
`WorkspaceDomainError`, `IdentityDomainError`.

**When to use which:**

- **`XxxDomainError`** — for pure invariant validation at the
  entity/domain logic level that knows nothing about HTTP/UI (e.g. used in
  domain logic unit tests without mocking infrastructure).
- **`ApplicationError` subclass** — for errors that need to reach the
  UI/API boundary with a message that is safe to show to the user.

## Server Action Error Boundary (CC-D02)

Contract: `toActionError(error: unknown): { error: string }` —

- If `error instanceof ApplicationError` → return `{ error:
error.message }`.
- Otherwise → **re-throw** (unexpected errors are not hidden; Next.js
  handles them as a crash/error boundary, not a soft message to the user).

This function replaces the `instanceof`/switch logic that was **previously
duplicated identically** across several `actions.ts` files (`settings`,
`settings/members`, `sidebar-channels`, `publish/queue`) before it was
consolidated. **Do not rewrite the manual error mapping logic per new
file** — always import `toActionError` from `apps/web/src/lib/utils/errors.ts`.

This contract is **mandatory** for Server Actions that return `{ error }`
to the caller. Do not re-wrap actions whose contract is not that:
`markNotificationReadAction` returns `void` and lets errors bubble up
(empty session → `redirect("/login")`); `getCalendarPostAction` maps an empty
session to `null`. Switching both to `toActionError()` changes the
caller's contract.

Because `toActionError` passes `error.message` through to the client as is:
**error messages thrown from an Application Service must be safe to
show to the user** — do not leak internal details (query, stack,
secret) inside `message`.

## Route Handler Error Handling

Route Handlers (Outstand webhook) have their own error contract, already
documented in `integration-layer.md` — not duplicated here.

---

# Naming Conventions

## Variables & Functions (CC-D03)

- camelCase.
- Functions are verb-first: `getX`, `createX`, `listX`, `parseX` — real examples:
  `getMonthRange`, `getWeekRange`, `parseCalendarViewState`,
  `getDashboardSummaryAction`, `getCachedSession`.
- Booleans: prefix `is`/`has`/`should` (e.g. `isReadyToPublishNow`) — this rule
  applies going forward to new code.
- Server Actions: suffix `Action` (`getDashboardSummaryAction`,
  `switchWorkspaceAction`) — consistent with the existing pattern.

## Types & Interfaces (CC-D04)

- PascalCase, **no** `I` prefix for new domain types/interfaces (e.g.
  `PostMetricsPort`, `ScheduledCountsPort` — not `IPostMetricsPort`).
- `IOutstandAdapter` (the large external ACL contract) is a **historical
  exception** — not a pattern to copy elsewhere, only a name that
  was already in wide use from the start.

## Domain Module & File Naming (CC-D05)

An explicit pointer — **do not duplicate here**, follow the same Option A
rule that applies between baseline docs, not just the context/ index
files:

- React component files/folders: `monorepo-setup.md` section `## src/app/ —
  App Router Structure` + ADR-069.
- Domain modules & public API: ADR-026, `ctx-implementation.md`.

---

# Function-Writing Conventions (CC-D06)

**Application Service method structure:** validation/authorization first (throw
early) → orchestration → return. Do not mix validation into the middle of the
orchestration logic — it makes the flow hard to read and fail-fast becomes
unclear.

**Composition root pattern:** instantiating a service with its dependencies
(repository, port) happens in `page.tsx`/`actions.ts`/`layout.tsx` — not
inside the domain module itself. Precedent: ADR-078 (local port + composition
root for `ScheduledCountsPort`).

**Pure functions for logic without I/O:** logic that needs no database/network
access is written as a pure function separate from the service class —
importable and testable without any mocks. Real examples:
`getMonthRange`/`getWeekRange` (`calendar-range.ts`),
`parseCalendarViewState`.

---

# Decision Log

| ID | Decision | Reason | Alternatives |
|----|-----------|--------|-----------|
| CC-D01 | 2-layer error hierarchy (`AppError`/`ApplicationError` + `XxxDomainError` per domain) | Already proven to be used consistently across 9 domains, no need to redesign | A single error hierarchy across domains (rejected — domain invariant errors have different needs from boundary errors) |
| CC-D02 | `toActionError()` mandatory on Server Actions that return `{ error }` | Prevents duplicated error mapping logic. `void` / `redirect` / `null` actions are not forced to follow this helper | Manual error mapping per file; wrapping every action without looking at the return contract |
| CC-D04 | No `I` prefix for new interfaces | Consistent with most of the existing code (`PostMetricsPort`, etc.) | Consistent `I` prefix following `IOutstandAdapter` (rejected — that exception is itself historical, not a deliberate pattern) |

---

# Related Documents

- `../05-architecture/application-layer.md` — error handling contract per layer (the original reference of the `errors.ts` comments)
- `rendering-strategy.md` — Server Action error boundary (RS-D01)
- `monorepo-setup.md`, ADR-069 — complete file/folder naming
- `../../project-os/decisions/ADR-078-amandemen-adr-018-port-lokal-composition-root-scheduled-counts.md`
- `../../project-os/decisions/ADR-095-*.md` (this document is set as the baseline)
