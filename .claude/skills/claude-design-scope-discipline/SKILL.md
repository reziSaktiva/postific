---
name: claude-design-scope-discipline
description: Prevents the AI from changing user-approved defaults/state as a side effect when implementing a change in the Postific design artifact (toggle, switch, comparison variant, etc.). Use this skill BEFORE making any change to the design artifact through the Artifact tool (ADR-140) — especially when asked to add a control that compares two views/variants, or when the user's request could be read in more than one way.
---

# Design Artifact — Scope Discipline

This skill locks in one principle: **implementing a new feature must not quietly change state/appearance the user has already approved.** Written after a real incident in ADR-052 (see `project-os/DECISIONS.md`).

---

## When This Skill Is Mandatory

- Before making any change to the Postific design artifact or the Postific Design Review gallery (via the `Artifact` tool, ADR-140).
- Especially when the user asks for a **comparison control** between two views/variants — toggle, switch, A/B, etc.
- When the user's request can be read in more than one way (ambiguous between "add a helper tool" and "replace the active view").
- Also applies to code implementation in `apps/web` that touches UI state/defaults that were already approved — not only the design artifact.

---

## The Incident Behind This Skill (ADR-052)

Short timeline (full detail: `DECISIONS.md` ADR-052, addenda "Variant Dialog dibuka kembali untuk perbandingan" and "Koreksi: default dikembalikan ke Fullscreen"):

1. The user asked for the Draft Editor (Create Post/Update Draft) to change from a full page into a dialog. The result was a `variant="fullscreen"` dialog — deliberately without a dark backdrop (the original Astryx design), so the user did not realize for a while that it had become a dialog.
2. The user asked: add a **toggle** so there are two versions (Fullscreen & Standard) to compare side by side.
3. **The mistake:** the toggle was added and worked correctly — but the default view was quietly changed from Fullscreen to Standard as part of the implementation, even though the user never asked for the default to change. Because Standard and Fullscreen have different structures (floating card vs full viewport), every element inside (including the Media/Account Selector) also appeared to change layout even though its own CSS classes were not touched.
4. Root cause: the AI treated the task as done as soon as "the new feature (toggle) works", without checking for side effects on previously approved state.

---

## Mandatory Rules

1. **Never change a user-approved default/state/appearance as a side effect of a new feature** — including when adding a comparison control. If the request is "add an A/B toggle", that means **only adding a tool to switch between A and B** — it is not permission to change which one is active by default.

2. **Before executing**, if the scope of the change is potentially ambiguous, state briefly to the user:
   - What will **change**.
   - What stays the **same** (including the current default/active state).

   Example sentence: "I will add a Fullscreen/Standard toggle in the dialog header. The default stays Fullscreen as it is now — the toggle is only a helper for viewing the Standard version when clicked, it does not change the default view. Is that right?"

3. **If it is ambiguous, ask first** before executing (see the `proactive-clarification` skill). Do not assume one interpretation is more "reasonable" without confirmation — especially when the effect would change an already approved view.

4. **The definition of done is not just "the new feature works".** Explicitly verify two things:
   - The requested feature works correctly.
   - There is **no unrequested change** to existing appearance/behavior (compare the state before vs after, with a screenshot/visual diff when possible).

5. **If you already changed something outside the scope** (on purpose or by accident), say so explicitly to the user as part of the report — do not stay silent, even when the change looks small or "better". The user decides whether the extra change is accepted or reverted.

6. **Always read the latest version before republishing** — King Rezi and
   other sessions can change the artifact directly, so what is in the
   artifact is often newer than any local copy or plan. Before any `Artifact`
   publish: (1) `read` the target file (and the index
   `project/design-system.json`) from the artifact first, (2) compare it with
   what you are about to publish, (3) if the artifact is ahead, drop the
   "resend the whole file" plan and apply a **minimal** change on top of the
   latest content — build the combined file with a script, not by retyping
   it by hand (files often contain long inline SVG paths whose typos are
   invisible in review), keep the indentation as it is so the diff contains
   only the intended change, then re-read the artifact after publishing to
   verify. The tool refuses a publish when the version you read is already
   behind; follow its refusal, do not use `force`. The case this rule came
   from (T-010.3, 2026-08-04, while it was still Claude Design): a backlog
   task said `components/navigation.html` was "just a push from the
   scratchpad", but the remote already had 5 Channels lines added by King
   Rezi himself — pushing without verification would have erased King Rezi's
   work.

---

## Examples

**Wrong (what happened in the ADR-052 incident):**

> User: "Make a toggle so there are two versions, Fullscreen and Standard, so they can be compared."
>
> AI: _adds the toggle and also changes the default state to Standard without saying so_ → reported as "the toggle has been added" without mentioning that the default changed too.

**Right:**

> User: "Make a toggle so there are two versions, Fullscreen and Standard, so they can be compared."
>
> AI: "I'll add a toggle in the dialog header. The default stays Fullscreen (unchanged from now) — click the toggle to preview Standard, click again to go back. Proceed with this assumption?" → only then execute after confirmation (or execute right away with this assumption stated explicitly in the final report, if the task is clear enough not to need waiting for an answer).

---

## Related

- `project-os/DECISIONS.md` — ADR-052 (origin incident + full timeline).
- `context/ctx-design.md` — Operational rules for the design artifact (pointer to this skill).
- `.claude/skills/proactive-clarification/SKILL.md` — how to ask when there is a decision fork/ambiguity.
- `AGENTS.md` — The project's hard rules.
- `project-os/DECISIONS.md` — ADR-140 (design tool moved from Claude Design to the artifact; this skill's rules still apply).
