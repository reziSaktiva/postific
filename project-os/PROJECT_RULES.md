# PROJECT RULES

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 0.3.2      |
| Status       | Active     |
| Last Updated | 2026-10-23 |

---

# Purpose

This document contains the rules, principles, and standards that must be followed during project planning and development.

All project members (Developers, AI Assistants, Designers, and other contributors) must refer to this document before making changes to the project, in documentation as well as in code implementation.

---

# Scope

This document governs:

- Core principles of project development.
- Document classification and governance.
- Development and architecture rules.
- Rules for collaborating with the AI Assistant.
- Rules for recording decisions.
- The overall project workflow.

This document does **not** govern:

- Status, progress, or the active phase of the project — see `PROJECT_STATE.md`.
- Details of technical or business decisions — see `DECISIONS.md`.
- Scope details of each discovery phase — see `README.md` in each `../product-discovery/` folder.

---

# Core Principles

This project is developed on the following principles:

- Documentation First
- Business First
- User-Centered Design
- Domain-Driven Design (DDD)
- Modular Monolith Architecture
- AI Friendly Development
- Simplicity over Premature Optimization
- Maintainability over Complexity
- Scalability by Design

---

# Documentation Governance

## Documentation Rules

- All important decisions must be documented.
- Documentation is always the primary reference before implementation.
- Documentation must be updated when requirements, architecture, or workflow change.
- Avoid duplicate or conflicting documentation.

## Document Type Classification

Every document in the project has a type that determines when and how it may be changed.

**Static Reference**

A document that describes structure, purpose, scope, and rules. It must not contain information that changes over time (status, progress, active phase).

It may be changed only when a **structural** change occurs — a new scope, a new document, or a new rule — and that change must be recorded as an ADR or in the related ticket (ADR-131).

Includes:

- All `README.md` files
- `PROJECT_OVERVIEW.md`
- `ARCHITECTURE_OVERVIEW.md`
- `PROJECT_RULES.md`
- Skill/navigator files (`SKILL.md`)
- Baseline documents already fixed in each `product-discovery/` phase
- Subagent definitions (`.claude/agents/*.md`, except `.claude/agents/README.md`
  which remains an ordinary README) — changes only at the user's explicit
  request, not on the AI's initiative (see `.claude/agents/README.md`)

**Living Document**

A document that is actively updated every session — the only document type that may record status and progress.

Includes:

- `PROJECT_STATE.md` — source of truth for **phase, milestone (M0–M9), overall progress, Active Conversation Mode, Known Issues, and Blockers**.
- `AVAILABLE_TICKETS.md` — the queue of tasks that are not finished yet (ADR-131).
- `tickets/vXX-*.md` — release tickets, including finished ones (ADR-062, ADR-131).
- `tickets/known-issues.md` — tickets born from a Known Issue (ADR-134).
- `specs/` — specs for work that spans more than one session (ADR-131).

The division is firm: the status of the _project phase_ belongs to `PROJECT_STATE.md`; the status of a _task_ belongs to `AVAILABLE_TICKETS.md` (open ones) and `tickets/` (all tickets). `PROJECT_STATE.md` only names the ID + a short title and points to `AVAILABLE_TICKETS.md`.

**Append-Only**

A document that only grows. Old entries must not be edited or deleted.

**One explicit exception (found as a gap on 2026-08-12; this practice had been running since ADR-056/057 before it was written down here):** the `Status` column on an old ADR row in `DECISIONS.md` AND the `### Status` header in the corresponding `decisions/ADR-XXX.md` file **may** be edited — but **only** to add/complete the tag `Accepted — Amended by ADR-YYY (date)` when a new ADR amends it. This is purely two-way cross-reference metadata, not a change to the decision/content of the old ADR. The Decision/Reason/Alternatives Considered content of an old ADR still **must not be changed**. If a new ADR states "amends ADR-XXX" in its body, the ADR-XXX row in `DECISIONS.md` and the Status header in the file `decisions/ADR-XXX-*.md` **must** be updated at the same time (do not postpone) — this gap is what left 14 old ADRs (ADR-005 onward) untagged until they were audited and backfilled.

**Second explicit exception (ADR-163, 2026-11-12):** in tickets, ADRs, and other history documents, **only document keywords** (e.g. "Berikutnya", "Belum terbukti", "Baca dulu", the status legend, and column names; the list of equivalents is in the S-007 script ticket) may be replaced with English. The decision content, numbers, IDs, links, and prose still must not be changed. The replacement is done once, in a ticket of its own, and checked with `bun run docs:check` and `docs-consistency-audit`.

Includes:

- `DECISIONS.md` — a **compact index** of ADRs (table of ADR#/Title/Status/Date/Summary/file link), one new row per new ADR. No longer the place for the full text of an ADR (see `decisions/`).
- `decisions/ADR-*.md` — one file per ADR, full content (Title/Status/Date/Decision/Reason/Alternatives Considered). Old entries must not be edited/deleted (except the `Amended by` tag in the Status header, see the exception above), the same as their parent.
- `CONVERSATIONS.md` — every important discussion session is recorded as a new entry.
- `BRAINSTORM.md` — every new idea is recorded as a new entry.

## Formatting Rules

- A README **must not** contain status (✅ ⏳ 🟡), progress (%), or the active phase.
- Folder status, milestone, and phase may be shown only in `PROJECT_STATE.md`.
- **Exception (ADR-062, ADR-131, ADR-134):** per-task status is shown in `AVAILABLE_TICKETS.md` (unfinished ones), `tickets/vXX-*.md` (release tickets), and `tickets/known-issues.md` (tickets from a Known Issue). This exception does **not** extend to phase, milestone, or overall progress — those three remain exclusive to `PROJECT_STATE.md`, and remain forbidden in a README and in any other Static Reference document.
- **Known Issues (ADR-066, ADR-067, ADR-131, ADR-132):** every KI uses an ID `KI-XXX` that is never recycled. An open KI has a ticket. Its row in `PROJECT_STATE.md` points to that ticket. A KI leaves the list when its closing ticket is finished.
- Every structural change to a Static Reference document must be recorded as an ADR or in the related ticket.

## Document Size Guardrail (Living/Append-Only)

So that `PROJECT_STATE.md` does not swell again, this is checked as part of the **Definition of Done** each time a milestone is finished:

- The `PROJECT_STATE.md` section "Completed (Ringkasan)" is kept at **≤ 5 items** (a rolling window of the newest items — a binding rule, see `.claude/skills/project-os-navigator/SKILL.md` § "3. New Work / Document Creation"); "Recent Decisions (Ringkasan)" is kept at ≤ ~10 items. Items pushed out stay in the `tickets/` tickets and in `DECISIONS.md`.
- `AVAILABLE_TICKETS.md` contains only tasks that are not finished. Looking up the queue stops at that file (ADR-131).
- Release tickets, including finished ones (✅), stay in `tickets/vXX-*.md`. Tickets born from a Known Issue are in `tickets/known-issues.md` (ADR-134). The AI opens that file only after the ID is chosen, and only that ticket's section.
- A new ticket follows the shape in `specs/README.md`: what to build, acceptance, blocked by, a spec link or "none — fits in one session". Do not write session stories into a ticket. Session history is in git.

---

# Development Rules

- Implementation must follow the agreed documentation.
- A code change in `apps/` and `packages/` must have a ticket (ADR-132). The ticket may be created in the same session, before the first line of code.
- An open Known Issue has a ticket. `PROJECT_STATE.md` only keeps a pointer row.
- When product truth changes, write `product-discovery/` first, `context/` only when its pointer changes, then `project-os/`.
- Do not change a requirement without updating the related documentation.
- Every feature is developed based on the currently active milestone.
- Avoid implementing features outside the scope of the milestone.

---

# Architecture Rules

- Use a Hybrid Monorepo.
- Use a single main application (`apps/web`) in the early phase.
- Use a Modular Monolith architecture.
- Use Domain-Driven Design as the basis for dividing domains.
- Every domain must have clear responsibility boundaries.
- A shared package is used only for cross-domain or cross-application needs.

---

# AI Collaboration Rules

The full text of the rules for collaborating with the AI is in **`../AGENTS.md`**: read
the documentation first → section "Required at the start of a session"; do not change
architecture/business rules without an ADR → rule 2; keep the structure consistent →
the whole "Hard rules (do not break)" section. It is not copied here so that it does not
drift when one of them is updated. The rule "comply with the document classification"
needs no outward pointer — that is the **Document Type Classification** section below,
in this very document.

---

# Decision Rules

The following changes must be recorded in `DECISIONS.md`:

- Architecture changes
- Workflow changes
- Repository strategy changes
- Business requirement changes
- Addition of a new domain or phase
- Changes to the main technology
- Other important decisions that affect the direction of the project

---

# Project Workflow

```text
Idea
    ↓
Discovery
    ↓
Business
    ↓
Product
    ↓
User
    ↓
UX
    ↓
Architecture
    ↓
Engineering
    ↓
Repository & Bootstrap
    ↓
Implementation
    ↓
Testing
    ↓
Release
```

The status and progress of each stage of this workflow refer to the milestones recorded in `PROJECT_STATE.md`.

---

# Definition of Done

A milestone is considered finished when:

- The milestone's goal has been achieved.
- Documentation has been updated.
- Important decisions have been recorded in `DECISIONS.md`.
- There are no unresolved blockers.
- `PROJECT_STATE.md` has been updated.
- The ticket status in `tickets/vXX-*.md` or `tickets/known-issues.md` has been updated, and the finished task row has left `AVAILABLE_TICKETS.md` (ADR-131, ADR-134). A milestone must not be declared finished while the queue is still stale.
- The document size guardrail (see **Documentation Governance**) has been checked — rotate the `PROJECT_STATE.md` summaries if needed.

---

# Related Documents

- `README.md`
- `PROJECT_OVERVIEW.md`
- `ARCHITECTURE_OVERVIEW.md`
- `PROJECT_STATE.md`
- `DECISIONS.md`
- `AVAILABLE_TICKETS.md`
- `../product-discovery/README.md`
