---
name: review-work
description: >-
  Walks King Rezi through the UI/UX work that was just done so he can accept
  it: detects the scope from this session, the git diff against staging, and
  the ticket, then reviews only the screens (in the browser) and the design
  artifact (opened for King Rezi), one item at a time, and asks Approve,
  Change, Skip, or Explain for each. Docs, spec, ADR, ticket, backend and data
  are not reviewed by this skill; King Rezi reviews those himself. Changes are
  collected and fixed in one pass at the end. Call when King Rezi asks to
  review, accept, or walk through the UI that has been done. It is King Rezi's
  acceptance step, not automated QA.
---

# Review Work

King Rezi's human acceptance step for **UI/UX only** (temporary scope, King Rezi's decision 2026-11-13). It
complements, and does not replace, Najwa (automated QA), Ridwan (architecture review), and `/code-review`
(bug hunt). Those find defects; this skill asks King Rezi whether the screen is what he wanted. Basis:
ADR-149, ADR-153 (the status ladder is not changed here).

## Scope

- **In scope:** **UI** (a screen, component, layout, or flow the user sees) and **Design** (the Postific design artifact, ADR-140).
- **Out of scope for now:** docs, spec, ADR, ticket, backend and data (API, Server Action, webhook, job, migration, query), config, CI, infra. King Rezi reviews these himself. Do not build review cards or ask about them; list them in the final report as "reviewed by King Rezi himself", never as approved.
- Reviewing docs and backend through this skill is on hold until King Rezi asks for it again. An earlier attempt (one Artifact page per review, and question-only evidence) was rejected as too heavy or not visible.

## Boundaries

- **Read-only during the review.** Nothing is written. No repo file edits, commits, migrations, or status changes while items are being reviewed. Fixes start only after King Rezi confirms the collected changes (step 5).
- Never invent evidence. Every item is shown from the real thing: a live screen or the opened design artifact.
- King Rezi's approval is acceptance evidence for the report. It does not by itself mark a ticket Done or Verified; that follows ADR-153 and the normal flow (Gibran).
- Do not show secrets.

## Steps

1. **Detect the scope** from three sources together:
   - **Session:** what was done in this conversation.
   - **Git:** `git status` and `git diff staging...HEAD` (use the integration branch for a wave).
   - **Ticket:** find the ticket ID from the branch, commits, or the conversation; read its item checkboxes (`- [ ]` / `- [x]`) with `offset`/`limit`, not the whole ticket file.
   Keep only the UI and Design changes. If there are none, say so in one line and stop. If the sources disagree or no scope can be found, ask once with `AskUserQuestion` (recommended scope first), then continue.
2. **Build the review list.** Group related changes into one item per screen or flow. Order by risk: flows that change data first, then user-visible layout, then polish. Cap at about **7 items**; if more remain, review the riskiest 7 and offer the rest as an optional second batch. Say the scope and the item count in one line before starting. For every item, name **what King Rezi is being asked to judge** in one sentence; if you cannot, the item is not ready to show.
3. **Show each item, then ask (step 4):**
   - **UI:** open the running page in the browser that this platform provides: the built-in browser in the Claude desktop app (start the dev server from `.claude/launch.json` with `preview_start`, or open the staging URL from `project-os/PROJECT_STATE.md`); in Cursor, its own browser, or Claude in Chrome when asked. Navigate to the exact screen and state, check the console for errors, and take a screenshot. If no browser is available, say so and give the URL. Do not leave the browser on a different page than the one being asked about. Say in one line **what to look at on that screen** (for example "the gap under the search field and the checkbox outlines").
   - **Design:** the built-in browser is not signed in to claude.ai, so a screenshot of an artifact there is only a sign-in page. Open the artifact **for King Rezi** with the `Artifact` tool, action `open`, on the exact artifact URL (pointer in `context/ctx-design.md`), before asking. Then tell King Rezi exactly where to look: the artifact name, the gallery entry, the scenario or card, and the one thing to judge, and what the design looked like before when that helps. Use `read` only to quote a changed value, never as a substitute for opening it. If the item concerns more than one card, open and ask for one card at a time. Do not change the artifact; scope rules are in `.claude/skills/claude-design-scope-discipline/SKILL.md`.
4. **Ask one item at a time** with `AskUserQuestion`, never several at once and never as a prose list. Text written before the dialog may not be on King Rezi's screen, so the question is **self-contained**: it states "Item N/M, <title>", the screen or card to look at, and the one thing to judge, without relying on text outside the dialog. It offers **Approve**, **Change**, **Skip**, and **Explain simply**. "Explain simply" answers with a shorter, plainer version (an everyday example, no file names) and then asks the same question again; it never counts as an answer. When "Change" is chosen, take King Rezi's comment (the automatic "Other" field or one follow-up) and record it word for word. Record the answer, then move on. Do not argue with a rejection. If King Rezi says he cannot see something, stop, fix what is on screen, and do not repeat the same ask.
5. **Close the review.** Show one table: item, result (Approved, Change, Skipped), King Rezi's comment. Then ask one question: fix the collected changes now? If yes, do them in one pass, classified as usual (UI changes go through rule 10 of `AGENTS.md`, and a code change in `apps/` or `packages/` needs a ticket, ADR-132). After the fixes, re-show only the changed items. Commit and push only when King Rezi asks (`AGENTS.md` rule 9).
6. **Report** with `.claude/skills/work-report-simple/SKILL.md`: what was reviewed, what was approved, what changed, what was skipped and therefore unverified, and the docs/backend work King Rezi reviews himself.

## Quality bar

- One decision per question; the screen is open before the question is asked, and the question says what to judge.
- Design is always opened for King Rezi with `Artifact` `open`; a sign-in page is never evidence.
- "Skipped" is reported as unverified, never as approved.
- Prefer fewer, sharper items over a long exhaustive list.
