# Rendering Strategy

This document defines the Next.js App Router rendering strategy for
`apps/web`: when to use a Server Component vs a Client Component, the Server
Actions contract, streaming/Suspense, and the SSR/SSG/ISR policy.

This document makes the entry point split already set by
ADR-016 (`application-layer.md`) concrete as operational rules that can be
followed without ambiguity, and complements `monorepo-setup.md` (the location of
`actions.ts` files, the App Router structure).

---

# Goals

- Make ADR-016 (Server Actions for mutations, Server Components
  for data fetching, Route Handlers for external) concrete as rules that
  can be followed without ambiguity.
- Document the per-feature `actions.ts` pattern that is already 100% consistent
  in the code as an official contract, not merely a habit.
- Close the ambiguity gap "Server Action used for reads" with an explicit
  going-forward rule.
- Set today's no-streaming/no-static default consciously (not
  forgotten configuration), and mark when it may change.

---

# Locked Decisions (from Baseline)

| Topic | Decision | Source |
|-------|-----------|--------|
| Entry point split | Server Actions for mutations, Route Handlers for external (webhook/OAuth), Middleware for the auth guard | ADR-016 |
| Application Service per BC, thin entry points without business logic | `application-layer.md`, AGENTS.md rule 3 |
| Domain logic must not import Prisma/Supabase/HTTP clients | AGENTS.md rule 4, `ctx-implementation.md` |
| Workspace context via the `active-workspace-id` cookie, re-validated on every request | ADR-076, `auth-architecture.md` |
| Realtime is limited to specific tables (`notifications`, `publishing_posts`) — not a page rendering strategy | ADR-023, ADR-094, `realtime-strategy.md` |

---

# Rendering Decisions (Set/Made Concrete in This Document)

| ID | Topic | Decision |
|----|-------|-----------|
| RS-D01 | Server Actions | Exclusively for **mutations**; one `actions.ts` file per feature folder, no inline `"use server"` in components |
| RS-D02 | Reads in Server Components | Data fetching during page render **must** call the Application Service directly (pattern of `apps/web/src/app/(app)/publish/calendar/page.tsx`), not a Server Action |
| RS-D03 | Client Components | Only for state/interactivity/hooks/browser APIs; boundary as deep as possible (leaf component), not wrapping the page |
| RS-D04 | Streaming/Suspense | Not used today (a conscious MVP decision); criteria for when it must start to be considered |
| RS-D05 | SSR/SSG/ISR | 100% dynamic/SSR, including the public route `/u/[slug]` (RS-D08); SSG/ISR out of scope |
| RS-D06 | Revalidation | `revalidatePath()` is used after a successful Server Action mutation; `revalidateTag`/`unstable_cache` not yet needed (not forbidden forever) |
| RS-D07 | Request-level de-dup | `React.cache()` for non-fetch lookups called repeatedly within a single render (precedent `getCachedSession()`) |
| RS-D08 | Public route rendering strategy | `/u/[slug]` is rendered **dynamically** per request (visit counter, ADR-143); SSG/ISR is not used. Static security headers in `next.config.ts` (`X-Frame-Options`, `Referrer-Policy`); a per-request nonce CSP for `/u/*` is set in `proxy.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'nonce-…'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `img-src https:`; without `upgrade-insecure-requests`, TLS is guaranteed by Railway; ADR-144). As a consequence the `Toaster` exists only in the `(app)` layout. Limitation: the default Next 404 injects a `<style>` without a nonce (T-166) |

---

# Server Components vs Client Components (RS-D03)

**Default: Server Component.** Add `"use client"` only when the file
truly needs one of:

- `useState`/`useEffect`/other React hooks
- Interactive event handlers (`onClick`, `onChange`, etc.)
- Browser-only APIs (`window`, `localStorage`, etc.)
- Third-party components that require the client runtime

**Current facts:** 34 `"use client"` files in the codebase, mostly leaf UI
components. **1 exception found** (Ridwan's architecture review, 2026-08-28):
`app/(app)/settings/account/preferences/page.tsx` has `"use client"` on its
first line, making the whole page a Client Component — deviating from
RS-D03. Recorded as a known exception (see the related Known Issue in
`PROJECT_STATE.md`), not fixed in this session.

**Boundary rule:** push `"use client"` as deep as possible in the component tree
(leaf, not a big wrapper), so most of the tree stays a Server
Component — data fetching close to its source, minimal JS sent to the browser.

**Prohibition:** do not add `"use client"` to a file that only passes
props from a parent to children without its own state/interactivity — if the
tree needs interactivity at one point, put `"use client"` at that point
only, not on its ancestor.

---

# Server Actions (RS-D01)

**Contract:** one `actions.ts` per feature folder, co-located with
`page.tsx`/`components/`. Real path examples that are already consistent:

- `app/(app)/publish/queue/actions.ts`
- `app/(app)/publish/components/draft-editor/actions.ts`
- `app/(app)/settings/members/actions.ts`
- `app/(app)/dashboard-actions.ts`
- `app/onboarding/components/actions.ts`

**Scope: mutations only.** A Server Action is **not** used to fetch data
shown in the initial render of a page — see RS-D02.

**Error handling:** a Server Action that returns `{ error }` must use
`try/catch` and return through `toActionError()` (contract details in
`code-conventions.md` CC-D02) — do not rewrite the manual error mapping logic
per file. Actions whose contract is `void`, `redirect`, or `null`
are not changed so their callers stay the same.

**Revalidation:** call `revalidatePath("<path>")` after a successful mutation
if that path shows the changed data (existing examples:
`/settings/members`, `/publish/queue`).

---

# Data Fetching in Server Components (RS-D02)

**The correct pattern** (see `app/(app)/publish/calendar/page.tsx`):
instantiate the Application Service directly in `page.tsx` (composition root),
call its method, and pass the result as props to the Client Component
below. This is the pattern to follow for **all new pages**.

**The deviating pattern (known exception, do not copy):**
`app/(app)/page.tsx` (dashboard) calls a Server Action
(`getDashboardSummaryAction`) for a pure read — recorded as technical
debt (see the related Known Issue in `PROJECT_STATE.md`, and the cleanup ticket in
`tickets/`). **Not the right pattern to emulate in new features.**

**Reason for this rule:** a Server Action carries unnecessary POST + serialization
overhead for a read; a Server Component already has direct access to the
Application Service without that extra layer — aligned with AGENTS.md rule 3.

---

# Streaming & Suspense (RS-D04)

**Current status:** not used at all — 0 `loading.tsx`, 0
`<Suspense>` across `apps/web/src/app/`.

This is the **MVP default decision** (simplicity over progressive rendering
for now), not a technical limitation or something overlooked.

**When it must start to be considered:**

- A page with a slow data fetch or several independent data sources
  that can be rendered in parallel (e.g. a multi-widget dashboard).
- There are real complaints about waterfalls/loading that feels slow.

**If it is used later:** `loading.tsx` per route segment for an instant
loading state; granular `<Suspense>` boundaries for streaming partial UI.
Recorded here as an available and permitted pattern, not one that has been
enabled — do not add it without a concrete need.

---

# SSR / SSG / ISR (RS-D05)

**Current status:** 100% dynamic rendering (on-demand SSR). There is no
`generateStaticParams`, `export const dynamic`, `fetch cache` configuration,
or `unstable_cache` anywhere. `next.config.ts` does not enable any
experimental flag (no PPR/`dynamicIO`/`cacheComponents`).

**Reason:** all routes are behind auth + workspace context (data
personalized per request) — SSG/ISR is not applicable to the app shell
today. This is an explicit status quo, not forgotten configuration.

**Exception:** the Start Page / public route (v0.6). The public URL is locked in
ADR-128 (`/u/[slug]`). This route is rendered dynamically per request, because
every visit increments a counter (ADR-143, ADR-144).
SSG/ISR is still not used.

---

# Middleware & Workspace Context

In brief — the full details are in `auth-architecture.md`/`ctx-architecture.md`,
not duplicated here:

- Middleware does the auth guard + resolves the workspace context from the
  `active-workspace-id` cookie, re-validated against `workspace_members` on every
  request (ADR-076).
- `getCachedSession()` (`apps/web/src/lib/better-auth/session.ts`)
  wraps the session lookup with `React.cache()` for per-request de-dup
  (RS-D07) — the same precedent is used if there is any other lookup that needs
  to be de-duped within a single render.

---

# Decision Log

| ID | Decision | Reason | Alternatives |
|----|-----------|--------|-----------|
| RS-D01 | Server Actions exclusively for mutations | Prevents drift like the dashboard case from recurring in new features | Allowing Server Actions for reads too (rejected — unnecessary POST overhead) |
| RS-D02 | page.tsx data fetching via the Application Service directly | Aligned with AGENTS.md rule 3, already proven in `apps/web/src/app/(app)/publish/calendar/page.tsx` | Still go through a Server Action like the dashboard (rejected — a deviating pattern, not replicated) |
| RS-D04 | Streaming/Suspense not yet enabled | MVP simplicity, no real need yet | Enable proactively on all pages (rejected — complexity without measurable benefit today) |
| RS-D05 | 100% dynamic, SSG/ISR out of scope | All routes personalized per request behind auth; the public route `/u/[slug]` is also dynamic (RS-D08) | SSG/ISR for the public route (rejected — the visit counter needs a per-request render) |

---

# Related Documents

- `../05-architecture/application-layer.md` — service & entry point contract (ADR-016)
- `code-conventions.md` — Server Action error handling contract (CC-D02)
- `monorepo-setup.md` — `app/` structure, file naming
- `../../context/ctx-implementation.md` — feature implementation flow
- `../../project-os/decisions/ADR-016-application-layer-next-js-entry-point-strategy.md`
- `../../project-os/decisions/ADR-095-*.md` (this document is set as the baseline)
