---
name: project-os-navigator
description: Project OS navigator for the Social Media Management project. Guides the AI on how to work, the documentation rules, and the right behavior for each kind of interaction — discussion, planning a change, new work, and bugs. Use this skill at the start of every working session on this project, or whenever project context is needed.
---

# Project OS Navigator — Social Media Management

This skill defines how the AI behaves when working on the Social Media Management project. Follow this guide for every kind of interaction.

## First Step: Load Context (3-Level Cascade)

Do not read all the `project-os/` documents in full for every message — that wastes tokens on simple questions. Escalate step by step, and stop as soon as the information is enough to answer:

**Level 1 — Quick facts / technical lookup** (stack, conventions, domain boundaries, implementation patterns, etc. — not about status/decisions):

- Reading the relevant `context/ctx-*.md` is enough (see `context/README.md` for the file map). There is no need to open `project-os/` at all.

**Level 2 — Status / progress / general questions** (current phase, next task, why a decision was made, etc. — not a request for work):

- Read the **"Snapshot" section** at the very top of `project-os/PROJECT_STATE.md` (~15-20 lines — phase/milestone, active mode, top next tasks, top blocker). Do not read the whole of `PROJECT_STATE.md`.
- If the question is about **available tasks / what comes next**, read `project-os/AVAILABLE_TICKETS.md` only. Do not open `project-os/tickets/` to look for the queue.
- If the ID has already been chosen, open **only that ticket's section** in one file: `tickets/vXX-*.md` for release tickets, `tickets/known-issues.md` for tickets born from a Known Issue (ADR-134), `tickets/s004-orchestration-language.md` for S-004, or `tickets/s007-documentation-language.md` for S-007.
- If the question names a specific ADR, open **only** that `project-os/decisions/ADR-XXX-*.md` file (see its index in `project-os/DECISIONS.md`). Do not read the whole `project-os/decisions/` folder.

**Level 3 — Real task** (New Work, Planning Change, Bug/Document Inconsistency — modes 3/4/5 below): read in order:

1. `project-os/PROJECT_STATE.md` — phase, milestone, Active Conversation Mode, Known Issues, blockers (read the Snapshot first so this context is available before choosing/planning a task)
2. `project-os/AVAILABLE_TICKETS.md` — the queue; find the relevant task ID
3. The ticket file named in the File column — `tickets/vXX-*.md`, `tickets/known-issues.md` (ADR-134), `tickets/s004-orchestration-language.md` for S-004, or `tickets/s007-documentation-language.md` for S-007 — **only that ticket's section**. Then open the documents named in the **Docs** / **Read first** field (ADR-131)
4. `project-os/PROJECT_RULES.md` — project rules and principles
5. `project-os/DECISIONS.md` — the ADR index; open the specific `project-os/decisions/ADR-XXX-*.md` file relevant to this task
6. `project-os/PROJECT_OVERVIEW.md` — project overview

If the work does not have a task ID in the backlog yet, that is a signal in itself: ask King Rezi whether it should be added as a new task first.

Before execution (specifically modes 3/4/5 whose scope is code implementation): check `.claude/agents/README.md` → the **Domain → Subagent** map and evaluate delegation (see the "New Work" behavior below, point 1a). Do not assume the default is "do it yourself".

If the discussion touches a specific domain, also read the relevant documents from:

- `product-discovery/01-business/` — Business Baseline v1.0
- `product-discovery/02-product/` — Product Baseline v1.0
- `product-discovery/03-user/` — User Discovery Baseline v1.0
- `product-discovery/04-ux/` — UX Planning Baseline v1.0
- `product-discovery/05-architecture/` — System Architecture Baseline v1.0
- `product-discovery/06-engineering/` — Engineering Planning Baseline v1.0

`product-discovery/` is the **product Source of Truth** and sits alongside (as a sibling of) `project-os/`, not inside it.

### Proactive Consistency Check

Whenever you read a **Static Reference** document (README, `PROJECT_OVERVIEW.md`, `PROJECT_RULES.md`, `SKILL.md`, or a baseline document), check whether it contains information that should live only in a **Living Document** (`PROJECT_STATE.md`) — such as status (✅ 🟡 ⏳), progress (%), or the active phase/milestone.

If you find any, **do not ignore it or fix it silently**. State it explicitly to the user as an inconsistency before continuing the work, then offer to fix it (see the **Bug / Document Inconsistency** behavior).

See `project-os/PROJECT_RULES.md` section **Document Type Classification** for the full rules.

---

## Behavior per Interaction Type

### 1. Discussion / Q&A

**Trigger:** The user asks a question, discusses an idea, or asks for an opinion.

**Steps:**

1. Make sure the answer is aligned with the existing baselines (Business, Product, User).
2. If there is a potential conflict with an earlier decision, name the relevant ADR.
3. Do not suggest solutions outside the scope of the active phase (see `Active Conversation Mode` in PROJECT_STATE.md).
4. If the discussion produces an important insight, record it in `project-os/CONVERSATIONS.md`.

Entry format: the "Format Entry" section in `project-os/CONVERSATIONS.md`.

---

### 2. Brainstorming

**Trigger:** The user wants to explore new ideas, possibilities, or alternatives.

**Steps:**

1. Follow brainstorm mode freely — do not be too tied to the baselines at this stage.
2. Mark clearly which items are "speculative" and which are "aligned with the baseline".
3. After the brainstorm ends, evaluate the results against the existing baselines.
4. If an idea is worth considering, record it in `project-os/BRAINSTORM.md`.

Entry format: the "Entry Format" section in `project-os/BRAINSTORM.md`.

---

### 3. New Work / Document Creation

**Trigger:** The user asks to create a new document, work on a task, or continue progress.

**Steps:**

1. Check `PROJECT_STATE.md` — make sure the task fits the active phase.
   1a. **If the task is in the scope of code implementation** (not documentation/discussion): make sure its ticket exists first (ADR-132). If it does not, write the ticket before the first line of code — release tickets in `tickets/vXX-*.md`, tickets born from a Known Issue in `tickets/known-issues.md` (ADR-134), S-004 tickets in `tickets/s004-orchestration-language.md`, S-007 tickets in `tickets/s007-documentation-language.md`. Then check that ticket's **Domain** field against the Domain → Subagent map in `.claude/agents/README.md`. Decide one of: do it yourself (trivial/documentation scope), delegate to one subagent, or run **several parallel subagents** when there are independent tickets (different domains/files) that do not touch each other. This is a mandatory step (ADR-063), not optional.
2. Check `Active Conversation Mode` — make sure the action type is allowed.
3. Read the relevant baseline documents before creating a new document.
4. Follow a document format consistent with existing documents (see examples in the same folder).
5. After the work is done, **in the same PR before merge** (not in a separate PR afterward; ADR-153 addendum 2026-11-06), update:
   - the ticket file (`tickets/vXX-*.md`, `tickets/known-issues.md`, `tickets/s004-orchestration-language.md`, or `tickets/s007-documentation-language.md`) — change the ticket status. Do not add session stories
   - `project-os/AVAILABLE_TICKETS.md` — a task that becomes ✅ leaves the queue table
   - `project-os/PROJECT_STATE.md` — only when the phase / milestone / Known Issues / nearest focus changes. **Do not** copy task details here (ADR-062)

**Definition of a "finished feature ticket" (ADR-149, S-002):** a ticket that
changes product behavior (`apps/`, `packages/`) may only be `✅` when there is
a Playwright golden-path E2E test for its feature and the whole suite is green
on `local` (`bun run test:e2e`). The result is reported in the description of
the `feature/*` → `staging` PR. It applies in every mode, including tickets
born from a Known Issue (`known-issues.md`, ADR-134) that change `apps/` or
`packages/`.
**Effective after T-174 ✅** (the T-173 test account and the first E2E test
exist); before that, feature tickets are not blocked by this gate.
Exceptions: documentation tickets, trivial changes with no user-visible
behavior, and tooling tickets. Backend/API/cron/migrations without a UI change
are **not** an automatic exception; King Rezi decides every exception, and the
agent records the reason in the ticket. The CI gate against staging for
`staging` → `main` PRs is set in CI-D07, not here.

**Ticket status ladder (ADR-153, S-003):** a ticket has two stages. **Done (code)**
covers the ADR-149 definition above, `/code-review` and architecture review
(Ridwan) with no open findings, QA (Najwa) passed, and `typecheck`, `lint`,
and tests green; a ticket is `✅` at this stage without waiting for merge
or deploy (ADR-161, amending ADR-153). Each ticket carries a **Verification**
field: `local` (provable locally) or `staging` (some item is provable only
after a deploy). **Verified (staging)** is one verification per wave after one
deploy of that wave, for things that cannot be proven locally (OAuth behind
the Railway proxy, `app_runtime` RLS, a real MCP client, multi-instance).
Staging-only items move to the wave's verification ticket instead of holding
the originating ticket. The "Not yet proven" section in the originating ticket
stays mandatory and points to that verification ticket, so `✅` does not hide a
claim that has not been tested. There is no intermediate
`🟡 Done (code), waiting for Verified (staging)` status; the only ticket that
stays open for staging is the wave's verification ticket.

**Verification rule: automate first, manual for the rest.** Before handing
verification to King Rezi as a manual step, or writing "cannot be done from an
AI session":

1. **Inventory the existing tooling**, do not conclude from memory:
   the Playwright setup (`apps/web/playwright.config.ts`, `apps/web/e2e/`),
   browser preview, read-only Supabase MCP, a temporary local Postgres
   (PGlite) for SQL, and scripts in the scratchpad.
2. **Split the verification** into the part that can be automated and the part
   that is truly manual only (physical devices, real Safari, production
   accounts or data). Run the automated part first; do not wait for the manual
   part when something can be proven now.
3. **Actions that need permission** (writing to staging, downloading a browser,
   touching a shared DB) are still asked of King Rezi, with details of what
   will be run. Needing permission is not a reason to skip the step.
4. **Report honestly:** write what was automated, what the result was, which
   tools were checked and why they are not enough for the rest. An automated
   test is labeled as an automated test, not a substitute for a real device
   (e.g. Playwright WebKit is not real Safari). The manual remainder is written
   as a runbook with a results table in its ticket.

The session trail is the git commits. There is no separate changelog file (ADR-131).

---

### 4. Planning Change / Decision Change

**Trigger:** The user wants to change direction, scope, a decision, or a baseline.

**Steps:**

1. Identify what changes and its impact on the existing documents.
2. Evaluate whether this change needs a new ADR in `DECISIONS.md`.

**Changes that MUST go into DECISIONS.md:**

- Target market / user segment
- Problem statement
- Product vision / scope
- MVP definition
- System architecture
- Tech stack
- Repository strategy
- Domain / bounded context

3. Create a new ADR file `project-os/decisions/ADR-[NNN]-[title-slug].md` (one file per ADR, no longer appended inline to `DECISIONS.md`) in this format:

```
## Decision ADR-[NNN]

### Title
[name of the decision]

### Status
Accepted

### Date
[YYYY-MM-DD]

### Decision
[what was decided]

### Reason
- [reason 1]
- [reason 2]

### Alternatives Considered
- [alternative not chosen]
```

Then add one row to the index table in `project-os/DECISIONS.md` (ADR# | Title | Status | Date | 1-line summary | file link), at the very top row (the index is ordered newest-on-top).

4. Update the affected documents.
5. Update `PROJECT_STATE.md` — the **Snapshot** section (if relevant to next tasks/blockers) and **Recent Decisions (Summary)** (push the oldest ADR out of the list of 5 once it is full).

---

### 5. Bug / Document Inconsistency

**Trigger:** A conflict, inconsistency, or error between documents is found.

**Steps:**

1. Identify which documents are involved and what contradicts.
2. Determine which document is the **Source of Truth** (usually the earlier baseline or the one already covered by an ADR).
3. Fix the conflicting document so it aligns with the Source of Truth.
4. If the bug indicates an undocumented decision, create an ADR.

---

## Context Rules (Do Not Violate)

- Do not suggest code implementation if `PROJECT_STATE.md` is not yet in the Development phase.
- Do not change a baseline (Business, Product, User) without a new ADR.
- Do not create documents outside the scope of the active phase.
- Always use the established persona names: Raka, Maya, Sinta, Dimas, Lara.
- Always use existing IDs (ADR-XXX, I-XX, A-XX, etc.) when referencing decisions.
- If there is a gap between the documents and the reality of the phase, ask the user before assuming.
- Do not fix document inconsistencies silently — always state the finding to the user (see **Proactive Consistency Check**).
- Do not copy task details (subtasks, dependencies, technical notes) into `PROJECT_STATE.md` — their place is `tickets/vXX-*.md`, `tickets/known-issues.md` (ADR-134), `tickets/s004-orchestration-language.md`, or `tickets/s007-documentation-language.md`. `PROJECT_STATE.md` only names the ID + a short title (ADR-062).
- Do not recycle task IDs. A cancelled task is marked `⏸️ Deferred` with its reason, not deleted.
- Follow the working preferences recorded in `project-os/PROJECT_OVERVIEW.md` section **Developer Profile & Working Preferences**, and add any new preferences you discover there.

---

## File Map (Source of Truth)

`project-os/` and `product-discovery/` are top-level sibling folders, each with a different responsibility:

```
social-media-management/
├── project-os/         → How we work: process, rules, decisions, status
│   ├── README.md            → Explanation of the project OS
│   ├── PROJECT_OVERVIEW.md  → What is being built
│   ├── ARCHITECTURE_OVERVIEW.md → High-level architecture (Figma blueprint)
│   ├── PROJECT_RULES.md     → How to work
│   ├── PROJECT_STATE.md     → Phase, milestone, Known Issues ← update on every
│   │                           change (read "Snapshot" first for quick lookup)
│   ├── AVAILABLE_TICKETS.md   → Queue of unfinished tasks ← stop here
│   ├── tickets/             → Tickets per release (`vXX-*.md`),
│   │                           `known-issues.md` (ADR-134), and
│   │                           `s004-orchestration-language.md` (S-004), and
│   │                           `s007-documentation-language.md` (S-007)
│   │                           ← open only the section whose ID has been chosen
│   ├── specs/               → Specs for multi-session work (ADR-131)
│   ├── DECISIONS.md         → Compact ADR index ← add 1 index row per new ADR
│   ├── decisions/           → One file per ADR (ADR-XXX-slug.md) ← full text here
│   ├── CONVERSATIONS.md     → Log of important discussions ← update if there is an insight
│   └── BRAINSTORM.md        → Idea bank ← update from brainstorm sessions
└── product-discovery/       → Product Source of Truth: business through engineering
    ├── README.md
    ├── 01-business/         → Business Discovery
    ├── 02-product/          → Product Planning
    ├── 03-user/             → User Discovery
    ├── 04-ux/               → UX Planning
    ├── 05-architecture/     → System Architecture
    └── 06-engineering/      → Engineering Planning
```

---

## Mapping task → read first

| Task type                    | Context first                                | Minimum baseline                                                                                       |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Feature / use case           | `ctx-domain` + `ctx-implementation`          | BC in `05-architecture/` + UX in `04-ux/` + `rendering-strategy.md` (+ `ctx-business` for roles/MVP)   |
| Schema / migration           | `ctx-architecture` + `ctx-technical-context` | `database-strategy.md` + `database-orm.md` + `apps/web/prisma/schema.prisma`                           |
| Auth / session               | `ctx-architecture` + `ctx-technical-context` | `auth-architecture.md` + `auth-strategy.md`                                                            |
| Outstand / webhook / publish | `ctx-architecture`                           | `integration-layer.md`                                                                                 |
| Jobs / cron                  | `ctx-architecture`                           | `background-jobs.md`                                                                                   |
| Env / deploy / CI            | `ctx-technical-context`                      | `environment-management.md`, `deployment-infrastructure.md`, `cicd-pipeline.md`                        |
| Coding conventions / DX      | `ctx-development`                            | `dx-tooling.md` + `code-conventions.md`                                                                |
| UI component / styling       | `ctx-design` + `ctx-implementation`          | `apps/web/.claude/CLAUDE.md` + `monorepo-setup.md` + `design-tokens.md` + ADR-097                      |
| Design / UI handoff          | `ctx-design`                                 | `04-ux/` + pointer to the Postific design artifact (ADR-140; `design/` folder removed, ADR-045)        |

---

## Skills & subagent housekeeping

**The only skill folder in this project is `.claude/skills/<name>/`.**
`.agents/skills/` has been removed (ADR-064) so there are no two physical
copies that can diverge. Claude Code only reads `.claude/skills/`; Cursor still
reads the same folder through its compatibility path. That compatibility path
is a fallback, not the main native mechanism — re-evaluate if in the future
we move to another AI tool that only complies with the open
[Agent Skills](https://agentskills.io) standard (native location:
`.agents/skills/`) without a Claude special case.

Rules to keep duplication/divergence from recurring:

1. **Do not recreate the `.agents/skills/` folder** unless King Rezi makes a
   new, explicit decision to use it again.
2. Vendor/third-party skills (Prisma, Supabase, Vercel, Better Auth, etc.)
   are usually installed through the official installer (`npx skills add ...`)
   which **defaults to writing into `.agents/skills/`** — if that happens
   again, manually move the result to `.claude/skills/<name>` (do not leave it
   side by side with another folder), then delete the newly created
   `.agents/skills/` folder.
3. Edit/add custom project skills directly in `.claude/skills/<name>/`.

A long vendor guide file inside a skill (e.g. the full rules) is named
`REFERENCE.md`, not `AGENTS.md` — Cursor injects every file named `AGENTS.md`
into every message, so that name is reserved for the repo entry point at the
root (T-116).

**Multi-session work waves (S-003, ADR-153):** running an approved wave uses
the `wave-work` skill; it is called only when King Rezi asks for it.
Preparing the wave list (reads documents only, stops at King Rezi's approval)
uses the `wave-plan` skill; it is safe to call at any time.

**Subagent delegation (ADR-063):** a trivial change — one file, no domain
boundary, no UI surface (examples: renaming a file, a one-line fix in a
document, a typo) — is done by the main agent directly, with no need to go
through the Domain → Subagent evaluation in `.claude/agents/README.md`. The
delegation chain (including Ridwan → Najwa → Gibran for feature
implementation) remains mandatory once the work touches a code domain
(`apps/`, `packages/`) or a UI surface. If in doubt whether a change is
"trivial", treat it as not trivial and run the delegation evaluation as usual.

**Session hygiene:** one task per conversation. If a session has already
finished one task and is asked for a new unrelated task, briefly record the
task just finished in `CONVERSATIONS.md` (or make sure it is already reflected
in the ticket status/`PROJECT_STATE.md`), then suggest continuing in a new
session for the next task — a long conversation history is paid for again on
every later turn in the same session.

---

## Additional Resources

- For UX Planning document details: `product-discovery/04-ux/README.md`
- For Engineering Planning document details: `product-discovery/06-engineering/README.md`
- For the full rules: `project-os/PROJECT_RULES.md`
