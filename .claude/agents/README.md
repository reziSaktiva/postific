# Subagents — Social Media Management

Guide to using the 7 working subagents for this project.

The role files (all `*.md` in this folder **except this document itself**)
are classified **Static Reference** (`project-os/PROJECT_RULES.md`) —
read-only (chmod 444) and **may only be changed on the user's explicit
request**, not on the AI's initiative, because their scope and limits were agreed
directly with the user. Structural changes are recorded as an ADR or in the
related ticket (ADR-131).

---

## Subagent list

| File                              | Name                         | Role                                                                                    | Tools restricted?                                  |
| --------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `prabowo-feature-engineer.md`     | Prabowo Feature Engineer     | Feature implementation (entry → service → domain → repo)                                | No (all tools)                                     |
| `mark-ui-engineer.md`             | Mark UI Engineer             | `apps/web` UI/components — shadcn/ui components (ADR-097)                               | No                                                 |
| `neymar-product-designer.md`      | Neymar Product Designer      | Postific design artifacts via the `Artifact` tool (ADR-140)                             | No                                                 |
| `elon-backend-engineer.md`        | Elon Backend Engineer        | Outstand ACL, webhooks, background jobs, Prisma schema                                  | No                                                 |
| `ridwan-architecture-reviewer.md` | Ridwan Architecture Reviewer | DDD boundary compliance review, read-only                                               | Yes — `Read, Bash, Grep, Glob, ReportFindings`     |
| `najwa-qa-engineer.md`            | Najwa QA Engineer            | Vitest + end-to-end browser verification                                                | Yes — `Read, Bash, Grep, Glob, mcp__Claude_Browser, Artifact` |
| `gibran-project-manager.md`       | Gibran Project Manager       | Update `PROJECT_STATE.md` / `AVAILABLE_TICKETS.md` / `tickets/` / `DECISIONS.md`       | Yes — `Read, Edit, Write, Bash, Grep, Glob`        |

**Model/effort override per subagent:** the frontmatter of each role file may
add `effort: <low|medium|high|xhigh|max>` (used by `ridwan-architecture-reviewer.md`
and `najwa-qa-engineer.md` as quality gates — they need extra rigor,
not just the golden path) and/or `model: <sonnet|opus|haiku|fable>` (not yet
used by any subagent at present) to override the main session's defaults.
This change counts as a "structural change" (this README § "Changing these
subagents") — the chmod dance is still required, then record it in an ADR or ticket.
Weigh the risk before lowering `model` on a subagent whose task
needs arithmetic/cross-file rigor (e.g. Gibran recounting the number of
subtasks) — a weaker model that miscounts means an extra session to
fix it, sometimes costing more than the savings.

---

## How the AI instructs subagents

The AI (Claude Code) delegates through the `Agent` tool with `subagent_type` =
the file name without `.md` (e.g. `subagent_type: "elon-backend-engineer"`). The user
does not need to call a subagent directly — just give a task, and the AI
picks the suitable subagent based on the `description` in each file's
frontmatter. The user can also force a specific subagent explicitly
("use Ridwan Architecture Reviewer to check this").

**Choosing the subagent is the AI's job, not a question for the user.** Do not
use `AskUserQuestion` to ask "who should do this task" —
the Domain → Subagent map below is enough to decide on its own.
Reserve `AskUserQuestion` for scope/product decisions (what to build),
not delegation decisions (who builds it).

## Technical limitation: design tools in subagent sessions

**`DesignSync` is no longer used (ADR-140).** Before that, `DesignSync` was recorded
failing to load in subagent sessions nine times (Neymar Product Designer
eight times, Najwa QA Engineer once; 2026-07-31 to 2026-09-28), even though it
worked in the main session. That record no longer applies because the tool was replaced.

The design tool is now the `Artifact` tool (ADR-140). **Proven to load in
subagent sessions (2026-10-26).** Neymar Product Designer and Najwa QA Engineer
both have `Artifact` directly in their tool list (without `ToolSearch`) and
successfully called `read` on the Postific Design Review artifact; Neymar also
succeeded with `list`. Neymar also succeeded with `publish` (a new version on a
single-use test artifact, then `read` again and the version went up), so the write
flow is proven, not just reading. Delegate to `neymar-product-designer` as usual, without a
fallback.

If at some point `Artifact` fails to load in a subagent session (check through
`ToolSearch`), do not assume that is normal: record the incident here,
ask King Rezi for explicit permission to do the work directly in the main session,
verify `Artifact` loads there, then continue.

---

## Orchestration rules (parallel vs sequential)

- **May run in parallel** (different files/domains, not touching each other): Prabowo, Mark,
  Neymar, Elon — can run together in one `Agent` tool turn
  as long as their tasks are independent (e.g. Elon works on `OutstandAdapter` while
  Mark works on the Publish Now button).
- **Must run sequentially, after implementation finishes:**
  1. **Ridwan** (architecture review) — runs after the implementation agents
     finish, before QA.
  2. **Najwa** (QA/testing) — runs after Ridwan (or right after
     implementation if no review was requested).
  3. **Gibran** (governance/docs) — **always last, alone**.
     Do not run together with other agents that may touch
     `PROJECT_STATE.md` / `AVAILABLE_TICKETS.md` / `tickets/` / `DECISIONS.md`,
     to prevent status conflicts/duplication.
- If several implementation agents change files that may overlap,
  use the `isolation: "worktree"` option per agent so they do not overwrite
  each other.
- Multi-session waves involving many lanes (integration branch, integration PR,
  staging verification): the `wave-work` skill (S-003). Preparing the wave
  list: the `wave-plan` skill.

---

## When evaluation is REQUIRED (not optional)

This is not just passive reference — `AGENTS.md` ("Required at the start of a session") and
`.claude/skills/project-os-navigator/SKILL.md` (the "New Work" behavior)
require the AI to stop at this point **before** starting code implementation:

1. Does the task have a **Domain** field (in its ticket file) whose scope is
   code implementation (not pure discussion/documentation)? → check the
   mapping table below.
2. Are there **more than one independent task/subtask** (different domains or files,
   not touching each other) that can be done at the same time? → run the
   relevant subagents in parallel (see "Orchestration rules" above)
   instead of doing them yourself one by one sequentially.
3. If the task matches one of the subagents and there is no strong reason to
   do it yourself (e.g. very small scope, 1-2 lines, or pure
   documentation) → delegate through the `Agent`/`Task` tool.

## Domain → Subagent map

The **Domain** field of each task in its ticket file (`tickets/vXX-*.md`, `tickets/known-issues.md`, `tickets/s004-orchestration-language.md` for S-004 (ADR-159), or `tickets/s007-documentation-language.md` for S-007 (ADR-164)) can be mapped directly to the
following implementation subagents as a starting point (not a rigid rule — also check
the `description` in each role file's frontmatter for the final decision):

| Domain (task field)                    | Primary subagent            | Notes                                                                           |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `identity`                             | Prabowo Feature Engineer    | Auth flows, session, Better Auth configuration                                  |
| `workspace`                            | Prabowo Feature Engineer    | Workspace, members, roles                                                       |
| `publishing`                           | Prabowo Feature Engineer    | Draft, Schedule, Queue, Publish Now                                             |
| `analytics`                            | Prabowo Feature Engineer    | Dashboard/metrics — logic; for its UI see the `UI` row                          |
| `mcp-access`                           | Prabowo Feature Engineer    | OAuth provider, grant, audit, MCP tools — domain logic like identity/publishing |
| `engagement`                           | Prabowo Feature Engineer    | Inbox, reply, engagement — domain logic; for Outstand sync see the `integration` row |
| `start-page`                           | Prabowo Feature Engineer    | Start Page — domain logic; for its UI see the `UI` row                          |
| `integration`, `media`, `notification` | Elon Backend Engineer       | Outstand ACL, webhooks, background jobs                                         |
| `UI`                                   | Mark UI Engineer            | shadcn/ui components, styling, layout (ADR-097)                                 |
| `platform`, `DX`                       | — (usually no subagent)     | Internal tooling/config (CI, monorepo) — often faster to do directly            |

A combined domain (e.g. `workspace · UI`) means **two subagents can run in parallel**
in one turn — one for domain logic (Prabowo/Elon), one for UI
(Mark) — as long as the files they touch do not overlap (see "Orchestration
rules" above for when `isolation: "worktree"` is needed).

---

## Ambiguous shadcn pattern gate (T-103.2, AGENTS.md rule 10)

Before an implementation subagent (especially **Mark UI Engineer**) writes code
for a list/composition that has **more than one technically valid shadcn
pattern** (e.g. `Item`/`ItemGroup` vs `Table`, dialog variants, fully
clickable row or not): first check whether the Postific design artifact has locked a
concrete pattern ("SYNCED"/"LOCKED PATTERN" comments on the
`project/components/Screen<Name>/preview.html` card or the related component,
and the shadcn component in the artifact shows that pattern, not just "shadcn X"). If it is
**not locked** — the subagent must **STOP and ask King Rezi** through
`AskUserQuestion` (not guess one of the options), including the concrete options
under consideration. This prevents a repeat of the KI-054/KI-055 drift
(the AI guessing a "reasonable" pattern that turned out not to be what King Rezi wanted) — full
details in `AGENTS.md` rule 10 and `tickets/v07-astryx-shadcn-migration.md`
§ T-103.

## Post-implementation structure verification gate (T-103.3)

Complementing the gate above (which applies **before** implementation): after a
UI task is written, **Mark UI Engineer** and **Najwa QA Engineer**
must `Artifact` action `read` the relevant screen card or component in the Postific
design artifact and explicitly compare its structure with the newly
written code (wrapper, header/caption, fully clickable or not, position of the
button/action, etc.) — not just the functional golden path. If an
unintended structural difference is found, fix/report it before the task is
marked done. Najwa QA Engineer is given `Artifact` tool access specifically
for this gate (`read` only) (see the "Tools restricted?" column in the table above). Details:
`.claude/agents/mark-ui-engineer.md` § Verification,
`.claude/agents/najwa-qa-engineer.md` § Work steps point 5, and
`tickets/v07-astryx-shadcn-migration.md` § T-103.

---

## Changing these subagents

The role files (`*.md` other than this document) are chmod read-only (444) as a
technical safeguard. To change them (add a new role, fix a wrongly
scoped one, etc.):

1. Get explicit confirmation from the user first — do not act on your own initiative.
2. `chmod 644 <file>.md`, edit, then `chmod 444 <file>.md` again.
3. Record the change as an ADR or in the related ticket (ADR-131).

---

## Related

- Agent entry point: `../../AGENTS.md`
- Document governance: `../../project-os/PROJECT_RULES.md` (Static Reference
  classification)
