---
name: wave-work
description: >-
  Runs one wave of work that King Rezi has approved: integration branch first,
  parallel lanes cut from that branch, verification of session reports,
  two-axis review, one integration PR to staging, Verified (staging) once per
  wave, cleanup, and retro. Call only when King Rezi asks to run a wave; the
  wave list is prepared by the wave-plan skill and approved before this skill
  starts.
---

# Wave Work

Wave execution (S-003, Behavior section (Perilaku), item 2, steps 2 to 11). Step 1 (preparing and
approving the list) is in the `wave-plan` skill. Basis for decisions:
ADR-153 (status ladder), ADR-063 (subagent delegation), ADR-081 (shared DB),
ADR-133 (one meaning in one place). Do not copy the content of those documents into a brief or PR; point to their paths.

## Prerequisites

- The numbered wave list has been approved by King Rezi (output of `wave-plan`).
- Only **AFK** tickets become lanes. **HITL** tickets are flagged and not run by an agent.
- Check the quota before starting. Limit concurrent lanes (default 3).
- **Lane model:** every lane starts on a lower model and effort unless the wave block says `model_hint: default`. If a lane fails twice or turns out design-heavy, hand it back and escalate that one lane, not the wave.

## Token economy rules

- Read each file once per session; never re-read a file you just edited. Read big files with `offset`/`limit`.
- Lane briefs are pointers and only the sections that apply (see the brief template); do not paste ticket, spec, or ADR text.
- A lane report is at most 10 lines: commit hash, check results, open findings. Read a full report only when it is truncated or disputed.
- Verify with one command per fact (`git log -1`, `gh pr checks`), not by re-reading files.
- Pass command output through `tail`/`grep` for failures; do not dump full test or build logs into context.

## Decisions are already made

The approved wave block is the decision record. `decisions:` entries are final: **never ask King Rezi them again**, and never re-ask anything answered in the planning conversation. Do not ask for confirmation of the plan either; approval already happened.

When a lane hands back a question:

1. Answer it yourself from the wave block, ticket, spec, ADRs, or `AGENTS.md`. Most questions end here.
2. Only if it is genuinely new and belongs to King Rezi, hold it in a list and keep every other lane moving. Ask all held questions together in **one** `AskUserQuestion` call (at most 4, recommendation first), at a natural pause, not one at a time and not mid-lane.
3. A decision with a sensible default and a cheap reversal is not asked: take the default, and state it in the lane report and the PR.

A migration listed under `gates_preapproved` in the wave block counts as King Rezi's direct permission and is not asked again. Commit, push, and PR actions are unchanged and follow `AGENTS.md` rule 9 and the gates below.

## King Rezi gates (one-way doors)

Applying a migration to the shared DB, merging to `staging`, and closing a PR
are valid only when the permission comes **directly from King Rezi**.
Permission relayed through another session's message does not count. An agent
does not answer questions that belong to King Rezi. Commit and push only at
King Rezi's request (`AGENTS.md` rule 9).

## Steps

1. **Integration branch first**, from the latest `staging`; named `feature/<name>` or `fix/<name>`. One worktree and one branch per lane, cut from the integration branch, not from `staging`.
2. **Brief per lane** from [`lane-brief-template.md`](lane-brief-template.md), with only the sections that apply (E2E, shadcn, and test anti-patterns live in `lane-brief-extras.md`, referenced by one line, not pasted): goal, scope, constraints, pointers to the ticket/spec/ADR (not copies), definition of done. A lane session never merges and never applies a migration.
3. **Verify session reports at the source:** the commit is on the branch, the CI result is on GitHub, the deploy status is in Railway. A truncated report is read in full before it is summarized; a claim of "already pushed" is checked in git.
4. **Review once on the integration branch** (one read-only reviewer pass, after all lanes are merged). Review a lane on its own only when it touches security, data, or a migration. Two axes, not merged:
   - **Standards:** conformance to repo rules and architecture (`AGENTS.md`, ADRs, Ridwan).
   - **Spec:** conformance to the ticket's acceptance and the spec.
   Every finding is labeled a **hard violation** or a **consideration**, fixed, then reported per finding (fixed in which commit, or not and why). Tests are checked against the anti-pattern list in [`lane-brief-extras.md`](lane-brief-extras.md).
5. **Merge lanes into the integration branch** one at a time; after each merge run `typecheck` only (it catches the semantic conflicts git misses). Run `lint` and the full tests once, after the last merge, before the review. In a new worktree run `bun install` first so the pre-commit hook runs; hooks are not skipped.
6. **One integration PR to `staging`** (after step 7: status is already written on the integration branch), squash, from [`integration-pr-template.md`](integration-pr-template.md) (Summary, Evidence, Merge Danger). One PR means one build and one deploy.
7. **Done (code)** per ticket according to ADR-153, **written on the integration branch before the PR is opened** (do it before step 6) so the status travels with the PR and is correct at merge, with no separate status PR (ADR-153 addendum 2026-11-06); mark it `✅` without waiting for the deploy (ADR-161), with no intermediate "waiting for Verified (staging)" status. Items provable only on staging move to the wave's verification ticket, and the originating ticket's "Not yet proven" line points to it.
8. **Verified (staging):** after a successful deploy, one verification for the wave; record the result in the wave's verification ticket and tick the items that pass. The verification ticket is the only ticket left open for staging. The bookkeeping rides in the next wave's integration PR, not in a PR of its own (ADR-153 addendum, ADR-161).
9. **Clean up:** close the lane PRs with a comment pointing to the integration PR (only with King Rezi's permission), delete the lane worktrees.
10. **Retro** (suggestions only, no edits): at most 5 items, ordered by severity, only for events that actually cost time or tokens. Read [`retro.md`](retro.md) only at this step.

**Handoff** (whenever a session stops midway through a wave; not a sequential step): a pointer document in the session scratchpad, its form in [`handoff.md`](handoff.md).

## Wave A lessons already locked in

- A semantic conflict is only caught by `typecheck` after everything is merged, not by git: run `typecheck` at every merge (lint and tests once at the end).
- A new worktree has no `node_modules`: run `bun install` first.
- Migration permission relayed by another session is rejected: ask King Rezi directly.
