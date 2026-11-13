---
name: review-work
description: >-
  Walks King Rezi through the work that was just done so he can accept it:
  detects the scope from this session, the git diff against staging, and the
  ticket, then reviews it one item at a time (UI in the browser, the design
  artifact, docs/spec/ADR/ticket decisions, backend and data evidence) and asks
  Approve, Change, or Skip for each. Changes are collected and fixed in one
  pass at the end. Call when King Rezi asks to review, accept, or walk through
  what has been done. It is King Rezi's acceptance step, not automated QA.
---

# Review Work

King Rezi's human acceptance step. It complements, and does not replace, Najwa (automated QA), Ridwan
(architecture review), and `/code-review` (bug hunt). Those find defects; this skill asks King Rezi
whether the result is what he wanted. Basis: ADR-149, ADR-153 (the status ladder is not changed here).

## Boundaries

- **Read-only during the review.** No file edits, commits, migrations, or status changes while items are being reviewed. Fixes start only after King Rezi confirms the collected changes (step 6).
- Never invent evidence. Every item is shown from the real thing: a screen, a quoted line with its link, a real response or query result.
- King Rezi's approval is acceptance evidence for the report. It does not by itself mark a ticket Done or Verified; that follows ADR-153 and the normal flow (Gibran).
- Do not use secrets in anything shown. Backend checks against shared environments are read-only unless King Rezi says otherwise.

## Steps

1. **Detect the scope** from three sources together:
   - **Session:** what was done in this conversation.
   - **Git:** `git status` and `git diff staging...HEAD` (use the integration branch for a wave).
   - **Ticket:** find the ticket ID from the branch, commits, or the conversation; read its item checkboxes (`- [ ]` / `- [x]`) with `offset`/`limit`, not the whole ticket file.
   If the sources disagree or no scope can be found, ask once with `AskUserQuestion` (recommended scope first), then continue.
2. **Classify each change** into one of four types; a change can have more than one:
   - **UI** (a screen, component, layout, or flow the user sees)
   - **Design** (the Postific design artifact, ADR-140)
   - **Docs** (docs, spec, ADR, ticket)
   - **Backend and data** (API, Server Action, webhook, job, migration, query)
   Anything else (config, CI, infra) is reviewed from its real output, and the item says so.
3. **Build the review list.** Group related changes into one item per theme. Order by risk: data and security first, then user-visible, then docs. Cap at about **7 items**; if more remain, review the riskiest 7 and offer the rest as an optional second batch. Say the scope and the item count in one line before starting.
4. **Show each item by type**, then ask (step 5):
   - **UI:** open the running page in the browser that this platform provides: the built-in browser in the Claude desktop app (start the dev server from `.claude/launch.json` with `preview_start`, or open the staging URL from `project-os/PROJECT_STATE.md`); in Cursor, its own browser, or Claude in Chrome when asked. Navigate to the exact screen and state, check the console for errors, and take a screenshot. If no browser is available, say so and give the URL. Do not leave the browser on a different page than the one being asked about.
   - **Design:** read the Postific artifact with the `Artifact` tool (pointer in `context/ctx-design.md`), open the relevant card or the "Postific Design Review" gallery, and name which card is being judged. Do not change the artifact; scope rules are in `.claude/skills/claude-design-scope-discipline/SKILL.md`.
   - **Docs:** show only **decisions and changed claims**: one item per real decision or changed rule, quoted in 1 to 3 lines with a `path:line` link. No unchanged text, no formatting-only edits, no whole files.
   - **Backend and data:** show the real evidence: the request and response, the query and its rows, or the test output. Never apply a migration or write to a shared DB to produce evidence.
5. **Ask one item at a time** with `AskUserQuestion`, never several at once and never as a prose list. Each question stands on its own, names the item, and offers **Approve**, **Change**, **Skip**. When "Change" is chosen, take King Rezi's comment (the automatic "Other" field or one follow-up) and record it word for word. Record the answer, then move on. Do not argue with a rejection.
6. **Close the review.** Show one table: item, type, result (Approved, Change, Skipped), King Rezi's comment. Then ask one question: fix the collected changes now? If yes, do them in one pass, classified as usual (UI changes go through rule 10 of `AGENTS.md`, and a code change in `apps/` or `packages/` needs a ticket, ADR-132). After the fixes, re-show only the changed items. Commit and push only when King Rezi asks (`AGENTS.md` rule 9).
7. **Report** with `.claude/skills/work-report-simple/SKILL.md`: what was reviewed, what was approved, what changed, what was skipped and therefore unverified.

## Quality bar

- One decision per question; the evidence is on screen before the question is asked.
- "Skipped" is reported as unverified, never as approved.
- Prefer fewer, sharper items over a long exhaustive list.
