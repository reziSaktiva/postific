# Context — Project

An operating index for **how the project works** (Project OS). Not a copy of `project-os/`.

---

## Read first

| Document                                                                   | When                                                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`../project-os/PROJECT_STATE.md`](../project-os/PROJECT_STATE.md)         | Every session — phase, mode, Known Issues, blockers                                                                                                           |
| [`../project-os/AVAILABLE_TICKETS.md`](../project-os/AVAILABLE_TICKETS.md) | Before working a task — the queue of unfinished work. Tickets, including finished ones, are in `tickets/vXX-*.md` (open only the section whose ID was chosen) |
| [`../project-os/PROJECT_RULES.md`](../project-os/PROJECT_RULES.md)         | Governance, document classification, AI collaboration                                                                                                         |
| [`../project-os/DECISIONS.md`](../project-os/DECISIONS.md)                 | Before changing a material decision                                                                                                                           |
| [`../project-os/PROJECT_OVERVIEW.md`](../project-os/PROJECT_OVERVIEW.md)   | Short product orientation + working preferences                                                                                                               |
| [`../AGENTS.md`](../AGENTS.md)                                             | Agent entry point + hard rules                                                                                                                                |

Required skill: [`.claude/skills/project-os-navigator/SKILL.md`](../.claude/skills/project-os-navigator/SKILL.md).

Before executing a code implementation task, you **must** evaluate subagent
delegation through the Domain → Subagent mapping in
[`.claude/agents/README.md`](../.claude/agents/README.md) (ADR-063).

---

## Operating rules

1. Status, progress (%), active milestone → **only** in `PROJECT_STATE.md`. **Exception (ADR-062, ADR-131):** open task status is in `AVAILABLE_TICKETS.md`; all tickets in `tickets/vXX-*.md`.
2. Material decisions (scope, architecture, stack, BC) → ADR in `DECISIONS.md` before changing the baseline.
3. Code implementation task → **evaluate subagent delegation first** (`../AGENTS.md` item 3, ADR-063) — see the Domain → Subagent mapping in `.claude/agents/README.md`.
4. Important discussion insights → `CONVERSATIONS.md`; speculative ideas → `BRAINSTORM.md`.
5. After work is finished → change the ticket status in `tickets/vXX-*.md` and remove its row from `AVAILABLE_TICKETS.md` if already ✅. Update `PROJECT_STATE.md` only if phase/milestone/Known Issues change. Do not copy task detail into `PROJECT_STATE.md`. The session trail is the git commit (ADR-131). A code change must have a ticket. An open KI has a ticket. Order of writing product truth: `product-discovery/` → `context/` (pointer only) → `project-os/` (ADR-132).
6. The language of documentation and communication follows `AGENTS.md` rule 8.
7. Do not commit/push unless the user explicitly asks. Do not commit secrets (`.env.local`, credentials).
8. For M8 Outstand implementation, ADR-040 amends the old contract. Read
   `DECISIONS.md` + `ctx-architecture.md`; do not conclude that the runtime handler/job
   already exists just because documentation and schema alignment is done.

---

## Living vs static

| Type             | File                                                                              | May contain status/progress?                           |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Living           | `PROJECT_STATE.md`, `AVAILABLE_TICKETS.md`, `tickets/vXX-*.md` (ADR-062, ADR-131) | Yes (STATE: phase/milestone/%; task: ticket status)    |
| Append-Only      | `DECISIONS.md` + `decisions/`, `CONVERSATIONS.md`, `BRAINSTORM.md`                | Only new entries are added, old entries are not edited |
| Static reference | README, overview, `product-discovery/` baseline, `SKILL.md`                       | No — do not put ✅/⏳/%/active phase                   |

---

## Brief architecture orientation

High-level blueprint (not BC detail): [`../project-os/ARCHITECTURE_OVERVIEW.md`](../project-os/ARCHITECTURE_OVERVIEW.md).

System detail → `ctx-architecture.md`. Stack/infra → `ctx-technical-context.md`.

---

## Related context

- Product / persona / MVP → `ctx-business.md`
- DDD domain → `ctx-domain.md`
