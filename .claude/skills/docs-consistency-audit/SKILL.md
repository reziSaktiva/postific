---
name: docs-consistency-audit
description: >-
  Full audit to find conflicts, drift, or inconsistencies across the
  project documentation (product-discovery, project-os, context/, ADR).
  Triggered ONLY when King Rezi explicitly asks for a documentation
  audit/cross-check/consistency-check — not routine automatic behavior (that
  is already covered by the "Bug / Document Inconsistency" mode in
  project-os-navigator). The audit scope is set through the argument: an
  area name (product-discovery, context, project-os, all) or a topic/feature
  name (e.g. "calendar", "workspace switcher") that is resolved to every
  cross-layer document touching that topic.
---

# Docs Consistency Audit

This skill is for a **deliberate, thorough** audit — not a reactive process
attached to the end of every task. Its purpose is to catch drift that slips
past the "update docs after the work" habit (`project-os-navigator/SKILL.md`
§ "3. New Work / Document Creation"): an ADR that amends an older ADR
while the baseline it refers to has not been updated, counts/statuses that
silently desync between files, `context/` still describing a pattern that has
been replaced.

**Working mode: report-only, then ask.** This skill never fixes anything
silently — including findings that look obviously right (a count typo, a
stale status). This is an explicit override of step 3 in the "Bug / Document Inconsistency" mode (`project-os-navigator/SKILL.md`), which allows
direct fixes — for an audit run through this skill, every finding is
reported first and only executed after confirmation.

---

## Step 0 — Resolve Scope from the Argument

This skill is invoked with a free-form argument (`args`). Interpret it as one
of:

| Argument                          | Meaning                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| `project-os`                      | `project-os/PROJECT_STATE.md`, `project-os/AVAILABLE_TICKETS.md` + every `project-os/tickets/vXX-*.md` + `project-os/tickets/known-issues.md` + `project-os/specs/`, `project-os/DECISIONS.md` + every `project-os/decisions/ADR-*.md` |
| `context`                         | Every `context/ctx-*.md` + `context/README.md`                          |
| `product-discovery`               | Every `product-discovery/**/*.md`                                       |
| Combination (`product-discovery+context`, etc.) | Union of the named areas, separated by `+`                |
| `all`                             | Union of all the areas above                                            |
| Free topic/feature name (e.g. `calendar`, `workspace switcher`, `invite`) | **Topic-based scope** — see Step 0b |
| Empty / no argument               | **Do not guess** — first ask King Rezi which area is meant (options: one of the areas above, or a specific topic) |

### Step 0b — Topic-Based Scope

If the argument is a topic/feature name (not one of the standard area names
above):

1. Grep the topic keyword (and clear synonyms/related terms — e.g.
   "calendar" also search "T-033", "kalender") across:
   - `project-os/AVAILABLE_TICKETS.md` + `project-os/tickets/`
   - `project-os/DECISIONS.md` + `project-os/decisions/`
   - `project-os/PROJECT_STATE.md`
   - `context/`
   - `product-discovery/`
2. Collect the matching files as the scope. If the grep result is very large
   (topic too generic, e.g. "workspace") or very small (possibly a
   misspelling/wrong term), **confirm first** with King Rezi the list of
   files to be audited before continuing — do not quietly narrow or widen the
   scope yourself.

---

## Step 1 — Read Every Document in Scope

Unlike the token-saving cascade in `project-os-navigator` (which stops as
early as possible), this audit **must read in full** every file in the
resolved scope — the whole point is a thorough sweep, not a quick lookup.

For a large scope (`all`, or the full `product-discovery`), consider
delegating to an Agent (Explore or general-purpose) per sub-area so the main
context does not fill up — but the final synthesis (classifying findings,
deciding which are ambiguous) is still done by the main AI, not handed to a
subagent.

---

## Step 2 — Check Categories

Check across the documents in scope for the following categories:

1. **Status/progress drift** — the status of an open task in
   `AVAILABLE_TICKETS.md` differs from the ticket in `tickets/vXX-*.md` or
   `tickets/known-issues.md`, or a ✅ task is still left in the queue.
2. **Queue drift** — `AVAILABLE_TICKETS.md` contains a ✅ task, or a
   ⏳/🟡/🚫 task that is in a ticket file does not appear in the queue.
3. **Amended ADR not reflected** — a new ADR changes/amends an older ADR, but
   other documents that refer to the old decision (a `product-discovery/`
   baseline, `context/ctx-*.md`, or another task) have not been updated to
   follow the latest version.
4. **Terminology/enum drift** — different names for the same thing: persona
   names (must be Raka/Maya/Sinta/Dimas/Lara), role/permission names, domain
   terms, names of components/patterns that have been renamed.
5. **Dead/stale references** — a link or mention of a file/section/component
   that has been deleted, moved, or replaced (e.g. a deleted folder, an
   Astryx component replaced by another pattern).
6. **Source of Truth violation** — a Static Reference document (README,
   `PROJECT_RULES.md`, baseline, `SKILL.md`) contains information that should
   live only in the Living Document (`PROJECT_STATE.md`) — status, progress
   %, active phase. This is the same pattern as the "Proactive Consistency
   Check" in `project-os-navigator`, but here it is sought deliberately across
   the whole scope, not just in documents that happen to be read.
7. **Two documents contradict each other with no clear source of truth** —
   see Step 3; this category is treated differently from the 6 categories
   above.

---

## Step 3 — Classify Findings

Every finding falls into one of two classes:

### A. Mechanical / Objective

There is one clearly correct answer based on an already-established Source of
Truth (the Source of Truth table in `AGENTS.md`, or an Accepted ADR).
Examples: a subtask count with the wrong total (the correct value only needs
recounting from the file), a task status in `PROJECT_STATE.md` that has not
been copied from a ticket file that was already updated.

→ Report with a **concrete proposed fix**, but still wait for confirmation
before editing (see Step 5).

### B. Substantive / Ambiguous

Two documents state contradictory things **without** one of them clearly
being the Source of Truth — for example an old baseline vs. a verbal
decision/implementation that was never turned into an ADR, or two ADRs that
overlap without explicitly amending each other.

→ **Do not assume which is right.** Present both sides as they are and ask
King Rezi (same pattern as `proactive-clarification`). Findings of this class
can lead to a new ADR — do not resolve them without an explicit decision.

---

## Step 4 — Report Format

Present the result as a list of findings, grouped by category (Step 2), each
containing at least:

- **Files involved** (relative path, with a markdown link)
- **What conflicts** (quote the relevant line/section, briefly)
- **Class** (A. Mechanical / B. Ambiguous)
- **Proposal** (for class A: a concrete fix; for class B: the question King
  Rezi needs to answer)

If there are no findings at all in the requested scope, say so explicitly —
do not invent findings to make the report look substantial.

---

## Step 5 — Follow-up (After the Report Is Presented)

1. For class A findings: ask per finding or in a batch ("shall I fix all
   these mechanical findings now?") — execute only after confirmation.
2. For class B findings: ask first, wait for a decision. If the decision
   changes the baseline/architecture, follow the new-ADR flow ("Planning
   Change" mode in `project-os-navigator`).
3. Every fix that is actually executed only needs to be recorded in the
   ticket or ADR. Do not write a separate changelog (ADR-131).
4. If a fix touches a ticket status, update the ticket file
   (`tickets/vXX-*.md` or `tickets/known-issues.md`) and
   `AVAILABLE_TICKETS.md` together.

---

## Critical Rules

- Do not trigger this skill automatically in a normal work session — only
  when explicitly asked.
- Do not fix anything before reporting and being confirmed — applies to class
  A and class B findings alike.
- For class B findings, do not guess which is right even if one looks
  "newer" — a later date does not automatically mean more correct without
  confirmation.
- If the requested scope (topic-based) produces a file list that feels
  incomplete or excessive, confirm first before the full audit runs — do not
  quietly narrow/widen the scope.
