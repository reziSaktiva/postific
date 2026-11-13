---
name: review-work
description: >-
  Walks King Rezi through the work that was just done so he can accept it:
  detects the scope from this session, the git diff against staging, and the
  ticket, then reviews it one item at a time (UI in the browser, the design
  artifact opened for King Rezi, docs/spec/ADR/ticket decisions and backend and data
  evidence each shown as a plain-language review card with the exact thing to
  check) and asks Approve, Change, Skip, or Explain for each. Changes are collected and fixed in one
  pass at the end. Call when King Rezi asks to review, accept, or walk through
  what has been done. It is King Rezi's acceptance step, not automated QA.
---

# Review Work

King Rezi's human acceptance step. It complements, and does not replace, Najwa (automated QA), Ridwan
(architecture review), and `/code-review` (bug hunt). Those find defects; this skill asks King Rezi
whether the result is what he wanted. Basis: ADR-149, ADR-153 (the status ladder is not changed here).

## Boundaries

- **Read-only during the review.** The review page in the scratchpad and its private Artifact are the only things written. No repo file edits, commits, migrations, or status changes while items are being reviewed. Fixes start only after King Rezi confirms the collected changes (step 6).
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
3. **Build the review list.** Group related changes into one item per theme. Order by risk: data and security first, then user-visible, then docs. Cap at about **7 items**; if more remain, review the riskiest 7 and offer the rest as an optional second batch. Say the scope and the item count in one line before starting. For every item, name before showing it **what King Rezi is being asked to judge** in one sentence; if you cannot, the item is not ready to show.
4. **Publish one review page first, then ask.** Text written before an `AskUserQuestion` may not be on King Rezi's screen (incident: a review where nothing was visible and every item was unanswerable). So the evidence lives in **one private Artifact page** for the whole review, opened for King Rezi with the `Artifact` tool before the first question. Never ask about an item that is not on the page.
   - Load `artifact-design` first; write one HTML file in the session scratchpad; publish it (private, icon `review`); then `open` it. On a later pass, re-publish the same file path to the same URL.
   - One numbered section per item (same numbers as the questions): title, **what to judge** (one sentence), **Before / After** quoted verbatim, the review card fields for Docs and Backend items (below), evidence, and "if this is wrong". Table of contents at the top with the item count. No unchanged text, no whole files.
   - For **UI** items the page holds the exact URL, the screen and state, and what to look at, plus a screenshot only when one was actually taken; also navigate the built-in browser to that screen. For **Design** items the page holds the artifact URL and the card to open; the artifact itself is still opened with `Artifact` `open`.
   - Update the page's status per item (Approved, Change, Skipped) after each answer, so the page is the running record.
   Item types:
   - **UI:** open the running page in the browser that this platform provides: the built-in browser in the Claude desktop app (start the dev server from `.claude/launch.json` with `preview_start`, or open the staging URL from `project-os/PROJECT_STATE.md`); in Cursor, its own browser, or Claude in Chrome when asked. Navigate to the exact screen and state, check the console for errors, and take a screenshot. If no browser is available, say so and give the URL. Do not leave the browser on a different page than the one being asked about. Then say in one line **what to look at on that screen** (for example "the gap under the search field and the checkbox outlines").
   - **Design:** the built-in browser is not signed in to claude.ai, so a screenshot of an artifact there is only a sign-in page. Open the artifact **for King Rezi** with the `Artifact` tool, action `open`, on the exact artifact URL (pointer in `context/ctx-design.md`), before asking. Then tell King Rezi exactly where to look: the artifact name, the gallery entry, the scenario or card, and the one thing to judge, and what the design looked like before when that helps. Use `read` only to quote a changed value, never as a substitute for opening it. If the item concerns more than one card, open and ask for one card at a time. Do not change the artifact; scope rules are in `.claude/skills/claude-design-scope-discipline/SKILL.md`.
   - **Docs** and **Backend and data:** these are shown as a **review card** (below), not as raw quotes, file lists, or test output.

   **Review card** (Docs and Backend and data; keep it short, plain language first, files second):

   ```
   What this is:    one sentence, no jargon, no file names
   What changed:    before -> after, in words a product owner uses
   Check this:      1 to 3 concrete yes/no statements King Rezi can confirm
                    ("Creator can still schedule a post", "the narrow breakpoint stays 767px")
   Evidence:        the real thing behind it: a quoted line with its path:line link,
                    the request and response, or the test result with its count
   If this is wrong: what breaks or what stays unproven
   ```

   - **Docs:** one card per real decision or changed rule. "Check this" is the decision itself written as a statement ("T-207.7: Published and Failed posts are not opened in the editor; History Detail handles them. Is that what you decided?"). Quote 1 to 3 lines as evidence. No unchanged text, no formatting-only edits, no whole files, no list of ticket edits.
   - **Backend and data:** describe behaviour from the user's side first (who can do what, what happens to which data), then give the evidence. A test count alone is never the card: say what the tests prove and what they do not. Never apply a migration or write to a shared DB to produce evidence.
   - If King Rezi cannot answer a "Check this" line from the card, the card is badly written: rewrite it simpler instead of asking King Rezi to dig.
5. **Ask one item at a time** with `AskUserQuestion`, never several at once and never as a prose list. The question is **self-contained**: it states "Item N/M, <title>", then the one thing to judge and the key before/after in one or two short lines, and says "full detail on the review page, item N". It never relies on text outside the dialog. It offers **Approve**, **Change**, **Skip**, and **Explain simply**. "Explain simply" answers with a shorter, plainer version of the card (an everyday example, no file names) and then asks the same question again; it never counts as an answer. When "Change" is chosen, take King Rezi's comment (the automatic "Other" field or one follow-up) and record it word for word. Record the answer, then move on. Do not argue with a rejection.
6. **Close the review.** Show one table: item, type, result (Approved, Change, Skipped), King Rezi's comment. Then ask one question: fix the collected changes now? If yes, do them in one pass, classified as usual (UI changes go through rule 10 of `AGENTS.md`, and a code change in `apps/` or `packages/` needs a ticket, ADR-132). After the fixes, re-show only the changed items. Commit and push only when King Rezi asks (`AGENTS.md` rule 9).
7. **Report** with `.claude/skills/work-report-simple/SKILL.md`: what was reviewed, what was approved, what changed, what was skipped and therefore unverified.

## Quality bar

- One decision per question; the evidence is on the review page before the question is asked, and the question itself states what to judge. If King Rezi says he cannot see anything, stop, fix the page or question, and do not repeat the same ask.
- Design is always opened for King Rezi with `Artifact` `open`; a sign-in page is never evidence.
- Docs and backend items are review cards in plain language; King Rezi should never have to ask "what should be checked?".
- "Skipped" is reported as unverified, never as approved.
- Prefer fewer, sharper items over a long exhaustive list.
