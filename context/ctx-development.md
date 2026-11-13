# Context — Development

An index of **Developer Experience**, local/CI commands, and **coding rules / conventions**.  
Patterns for "where a feature goes / call flow" → `ctx-implementation.md`.  
Stack & env → `ctx-technical-context.md`.

---

## Read first

| Document                                                                                                                 | Topic                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`../product-discovery/06-engineering/dx-tooling.md`](../product-discovery/06-engineering/dx-tooling.md)                 | ESLint, Prettier, Lefthook, Vitest, scripts (ADR-034)                                 |
| [`../product-discovery/06-engineering/rendering-strategy.md`](../product-discovery/06-engineering/rendering-strategy.md) | Server Component vs Client, Server Actions, streaming, SSR/SSG/ISR (ADR-016, ADR-095) |
| [`../product-discovery/06-engineering/code-conventions.md`](../product-discovery/06-engineering/code-conventions.md)     | Naming, error handling hierarchy (ADR-095)                                            |
| [`cicd-pipeline.md`](../product-discovery/06-engineering/cicd-pipeline.md)                                               | CI gates that are the same as local                                                   |
| [`monorepo-setup.md`](../product-discovery/06-engineering/monorepo-setup.md)                                             | Workspace & TypeScript layout                                                         |
| [`../README.md`](../README.md)                                                                                           | Quick root setup                                                                      |

Config in the repo: `eslint.config.*`, `prettier.config.*`, `lefthook.yml`, `vitest.config.ts` (root), `apps/web/playwright.config.ts` (E2E, ADR-149).

---

## Core commands

| Goal            | Command                                   |
| --------------- | ----------------------------------------- |
| Dev server      | `bun run dev`                             |
| Typecheck       | `bun run typecheck`                       |
| Lint            | `bun run lint` / `bun run lint:fix`       |
| Format          | `bun run format` / `bun run format:check` |
| Test            | `bun run test`                            |
| Prisma generate | `bun run db:generate`                     |
| Migrate (dev)   | `bun run db:migrate`                      |

Before considering work done: typecheck + lint (+ test if it touches covered logic) must be green.

---

## Coding rules (operating)

The rules below complement the hard rules in [`../AGENTS.md`](../AGENTS.md). Architecture detail stays in the baseline. Full detail on rendering & error handling: `rendering-strategy.md`, `code-conventions.md`.

### General

1. Formatting & lint are entrusted to **Prettier + ESLint** — do not mass-reformat outside the task scope.
2. Strict TypeScript: avoid `any`; prefer types from `@postific/shared` for cross-BC IDs/enums.
3. Do not commit secrets; do not add a dependency without a clear reason (follow
   `dependency-strategy.md`). shadcn/ui is source code copied into the
   repo, not a package dependency — there is no exact pin/Beta issue like
   Astryx had before (ADR-097).
4. Small & focused changes — no speculative refactors outside the task.
5. Comments only for non-obvious intent; do not write comments that re-narrate the code.

### UI / styling

6. shadcn/ui is the permanent component foundation (ADR-097, reversing ADR-041).
   The migration from Astryx to shadcn/ui is complete (ADR-097); for status detail see
   `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md`.
7. Tailwind is used directly as styling for shadcn components (no longer
   layout-only like in the Astryx era).
8. Selective wrappers are still used for critical/widely used components.
   `@stylexjs/stylex` has been removed entirely from the project dependencies (ADR-082,
   now irrelevant because Astryx itself is no longer used).

### Naming & files

9. Domain module: `apps/web/src/domains/<domain>/` — name aligned with the BC (kebab/lowercase folder).
10. The domain's public API is exported from that module's `index.ts`.
11. Shared types: `packages/shared` — clear names, no business logic.
12. Personas & roles: use the canonical names (Raka, Maya, … / Account Owner, Admin, Creator — ADR-074).
13. React components in `apps/web/src/app/` and `src/components/`: files that
    export a component use PascalCase, folders & non-component files
    (helpers, Server Actions, data maps) stay kebab-case; the placement of the
    `components/` folder follows the lowest common ancestor (LCA) of the routes
    that use it. Detail & examples in `monorepo-setup.md` section
    `## src/app/ — App Router Structure` (ADR-069, resolution of KI-010).

### Repository & use-case structure

14. The **Repository** pattern (domain interface ↔ Prisma implementation split) and
    the **separate use-case class** pattern for flows with critical dependencies
    (e.g. `IOutstandAdapter`) — detailed in `ctx-implementation.md`
    (not here, per the file boundaries in `context/README.md`).

### Testing

15. Unit/domain tests: **Vitest** (`bun run test`). E2E tests: **Playwright** Chrome (`bun run test:e2e`), detail in `dx-tooling.md` DX-D08 (ADR-149).
16. Tests that are added must be relevant to the behavior that changed; do not over-stub without value.
17. Services/use-cases are tested with a **fake repository** — not a Prisma mock
    and not a real DB. Pattern: a factory function `createFakeRepository()`
    that returns an object literal `implements IXxxRepository` with a
    no-op default per method, then `overrides: Partial<IXxxRepository>`
    is spread for a specific test case. Precedent:
    `domains/publishing/services/publishing.service.test.ts`. The same pattern
    is used for a local `IOutstandAdapter` double in use-case tests (not the
    production singleton — the production Fake has been removed, ADR-119). These tests
    do not prove the RLS context in the Prisma implementation — see rule 19.

### From practices already proven in the code

18. An error that must appear as an `{ error }` message to the user (not a
    crash): throw a subclass of `ApplicationError` in
    `apps/web/src/lib/utils/errors.ts` — `AuthorizationError`,
    `NotFoundError`, `ValidationError`, `ConflictError`,
    `ExternalServiceError`, or their subclasses
    (e.g. `AlreadyConnectedError`). `XxxDomainError` in each domain
    extends `Error`, not `ApplicationError` — do not use it for messages
    that must reach the UI. A Server Action that **returns** `{ error }`
    catches through `try/catch` + `toActionError()`; that function only
    maps `instanceof ApplicationError`, anything else is re-thrown.
    `throw new Error(...)` on this path becomes a Next.js error overlay, not a
    toast. Precedent: `getOutstandAdapter()` when `OUTSTAND_API_KEY` is empty
    (T-090.5) — now `ExternalServiceError`. The `message` content must be safe
    to display. Do not re-wrap an action whose contract is not
    `{ error }`: `markNotificationReadAction` returns `void` and
    lets the error rise (empty session → `redirect("/login")`);
    `getCalendarPostAction` maps an empty session to `null`. Switching
    either to `toActionError()` changes the caller's contract. Detail:
    `code-conventions.md` (CC-D01, CC-D02).
19. Prisma queries, read and write, on a table that has RLS: wrap
    with `withCurrentUser(userId, (tx) => ...)` in
    `apps/web/src/lib/prisma/with-current-user.ts`. Inside the callback use the
    `tx` client, not the `prisma` singleton — `SET LOCAL` lives only in
    that transaction. If you are already inside an outer transaction, call
    `setCurrentUserId(tx, userId)` as the first statement; do not
    nest `withCurrentUser` (that opens a second transaction and breaks
    atomicity, precedent `createWithOwner`). Without `app.current_user_id`,
    the `USING` policy does not match and does not throw an error: `findMany`
    returns `[]`, `updateMany`/`deleteMany` report 0 rows.
    Write precedent: `updateImportWatermark` (T-090). Read precedent:
    `getMember`, `listMembers`, `getChannelOrder`.
20. New ports and interfaces: PascalCase without the `I` prefix (example
    `PostMediaLookupPort`, `EnqueueAnalyticsSyncAccountsPort`). The `I` prefix
    on `IXxxRepository` and on long-standing adapters (`IOutstandAdapter`,
    `IMediaStorageAdapter`, `IJobScheduler`) is a name that is already
    in use — do not imitate it for new ports. Detail: `code-conventions.md`
    (CC-D04).

21. E2E tests that act on a Next.js screen wait for hydration first before
    clicking or filling: text that is already in the server HTML is not a ready signal,
    a click before hydration is lost without an error. Use `waitUntilHydrated` in
    `apps/web/e2e/support/mcp.ts`, perform the action once, then verify
    with an assertion (do not re-click or use a blind `waitForTimeout`). Precedent:
    T-193.2, `authorizeInBrowser`.
    21a. The S18 E2E (network block accordion, `draft-editor.e2e.ts`) reads a real workspace with two or more accounts
    (`MULTI_ACCOUNT_WORKSPACE_NAME` in `e2e/support/workspace.ts`, default "Cook It Real Good",
    overridden through `E2E_MULTI_ACCOUNT_WORKSPACE`) because "E2E Sandbox" has only one account. That test
    only reads: no caption, save, or publish; change the workspace name if the test account is no longer
    a member of it. New tests that touch a real workspace follow the same limit.
    21b. Interactive manual check together with King Rezi in the Claude browser (precedent:
    T-249.1 and T-249.3, 2026-11-12). Sequence: (1) show the browser pane
    (`show_pane` preview) and check the existing tabs and login; (2) decide the
    location first: local (`next dev`, not staging evidence) or staging, and the
    active workspace (a real workspace or "E2E Sandbox"); (3) safety limits: do not
    press Schedule or Publish Now to a real account (T-195), test data is given a prefix
    such as `uji-249-1` and deleted by yourself afterwards, permanent deletion only
    for data created by that session; (4) one check per question: the agent
    navigates and takes a screenshot (wait 1 to 2 seconds so animations
    and the account list finish loading), then asks through `AskUserQuestion` with
    the options "Looks good" and "Something looks off"; King Rezi's free-form answer is recorded
    as is as a finding; (5) display order: dark, light, 375px; the app theme
    is switched through the icon in the sidebar (emulating the browser color scheme does not change the
    app theme), 375px width through `resize_window` preset mobile and restored
    to desktop afterwards; (6) UI findings go into a new ticket (ADR-132) and are not
    fixed directly, because the design must be checked in the artifact first
    (AGENTS.md rule 10); (7) results are recorded in the verification ticket (e.g. T-249) with
    a test-location label, and the item stays `[~]` if it is only proven locally.
22. E2E tests that write to staging (create a real draft, media, or post)
    must be opt-in through env and skipped by default, with a cleanup
    that fails clearly if it does not find its data.
    Only change data created by the test itself (prefix `[e2e]`, a
    unique client name per run). Precedent: `E2E_MCP_SCHEDULE`, `E2E_MCP_DRAFTS`,
    `E2E_MCP_UPLOAD` in `mcp.e2e.ts`. `mcp.e2e.ts` runs only against staging
    (`mcpSkipReason`, ADR-081, ADR-149), so "green" means a staging
    `workflow_dispatch` run (King Rezi's decision 2026-11-02).
23. Tests that consume a per-workspace quota (rate limit) are placed last
    and must not be followed by another E2E that calls the same API;
    the quota is shared by all clients and parallel runs. Precedent: (n) in
    `mcp.e2e.ts`.

### Git / PR (when the user asks)

24. Commit only if the user asks — Conventional Commits, imperative, focus on "why".
25. Do not `--no-verify` / force push to main unless explicitly asked.

---

## Checklist before finishing a code task

- [ ] Does not violate the `AGENTS.md` hard rules (entry point, domain imports, Prisma/Supabase boundaries)
- [ ] An `{ error }` message to the user is an `ApplicationError` subclass, and only a Server Action that returns `{ error }` uses `toActionError` (`void` / `redirect` / `null` actions keep their contract)
- [ ] Read and write queries on RLS tables use `withCurrentUser` or `setCurrentUserId`, and the queries inside use the `tx` client
- [ ] `bun run typecheck` green
- [ ] `bun run lint` green
- [ ] Relevant tests green (if any)
- [ ] If adding/changing a shadcn component: UI smoke test + dark mode +
      Tailwind cascade layer + Next.js production build green
- [ ] Ticket status updated in `tickets/vXX-*.md`, and its row in
      `AVAILABLE_TICKETS.md` removed if already ✅ (ADR-131).
      `PROJECT_STATE.md` updated if phase/milestone/Known Issues change

---

## Related context

- Feature implementation patterns → `ctx-implementation.md`
- Stack / Prisma / env → `ctx-technical-context.md`
- Project OS → `ctx-project.md`
