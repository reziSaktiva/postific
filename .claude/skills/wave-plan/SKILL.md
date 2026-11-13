---
name: wave-plan
description: >-
  Prepares a wave of work from the ticket graph: asks King Rezi about the type
  of work first when no direction is given, computes the frontier (tickets with
  no blockers) from the Depends field, separates AFK and HITL tickets, checks
  for file conflicts against concrete file paths, resolves every open decision
  with King Rezi one question at a time, then stops at a numbered list plus a
  machine-readable wave block for King Rezi to approve. Reads documents only;
  safe and cheap to call at any time, including just to see which waves are
  available. Execution uses the wave-work skill.
---

# Wave Plan

Step 1 of the wave flow (S-003, Behavior section (Perilaku), item 2). A spec is the planning unit;
a wave is the frontier at that moment and may cross specs. Basis: ADR-153, ADR-132.

## Boundaries

- **Reads documents only.** Does not create branches, worktrees, or commits, and does not change files.
- Stops at the numbered list King Rezi approves. Execution is started by the `wave-work` skill, only at King Rezi's request.
- Asking King Rezi a question (steps 0 and 7) is allowed and expected; it changes nothing.

## Steps

0. **Direction first.** If King Rezi has not said what kind of work the wave is for (a spec, a milestone, a theme such as bugs, UI, backend, docs, or "whatever is ready"), do **not** compute anything yet. Ask first with `AskUserQuestion`: offer 2 to 4 concrete work types drawn from a quick read of `project-os/PROJECT_STATE.md` (nearest focus) and the queue headings of `project-os/AVAILABLE_TICKETS.md`, put your recommended type first marked "(Recommended)", and say in its description why you recommend it. Only continue once King Rezi has chosen. If a direction was already given, restate it in one line and continue.
1. **Collect candidates:** open `project-os/AVAILABLE_TICKETS.md` and stop there to choose an ID. Keep only tickets that match the chosen direction. Read ticket sections with `offset` and `limit` (or `bun run docs:where` when available, T-186), not the whole ticket file. The queue row alone is not enough to call a ticket remaining; the checkboxes are checked in step 2.
2. **Compute the frontier:** read the **Depends** field as a blocking edge. A ticket with no blockers, or whose blockers are already ✅ (or Accepted for an ADR), enters the frontier. It may cross specs. Tickets marked 🚫, and tickets whose blockers are not finished, are flagged and get no lane. Before a ticket is called remaining or enters the wave list, read the item checkboxes in the ticket file (`- [ ]` still open, `- [x]` done), not just the queue row. A ticket whose items are all `- [x]` is left off the list. An item already `- [x]` is not part of a lane's scope. Evidence: T-225.2 (`project-os/tickets/v01-foundation.md`).
3. **Separate AFK and HITL** from the **Mode** field in the ticket (its shape is in `project-os/specs/README.md`). A ticket with no marker is classified from its content: a decision item, migration permission, or manual verification by King Rezi means HITL. Only AFK tickets may become lanes; HITL tickets are flagged and not run by an agent.
4. **Check for file conflicts with concrete paths.** For every AFK ticket build a **file footprint**: the actual paths (or directories, or globs) it will touch, taken from its "Read first" section, its open items, and, where the ticket names a symbol or module, a `Grep`/`Glob` to resolve it to files. Also add the shared hot spots a ticket touches implicitly: `prisma/schema.prisma` and migrations, `packages/shared`, route/navigation registries, `project-os/*` status files, lockfiles, and i18n or message files. Then compare footprints pairwise:
   - **Overlap on a file** (same path, or one is a directory containing the other): the two tickets share a lane in sequence, or the later one waits for the next wave. Never two parallel lanes.
   - **Overlap only on a shared hot spot** (schema, `packages/shared`, registry): flag it as a semantic-conflict risk; recommend sequential order or an expand, migrate, contract split, and note that `typecheck` runs at every merge.
   - **No overlap:** safe for parallel lanes.
   - **Footprint unknown** (the ticket is too vague to name files): say so, treat it as conflicting with everything it might touch, and raise it as a decision in step 7 instead of guessing.
   Show the result as a conflict table (see Output).
5. **Vertical slices:** one lane produces a result that can be seen and tested, not a technical layer. A wide change uses expand, migrate, contract.
6. **Token economy:** limit concurrent lanes, flag mechanical lanes that may use a lower model and effort, and check the quota before the wave starts.
7. **Resolve every open decision, one at a time.** Collect every question you cannot answer from the documents: granularity (one ticket per lane or grouped), unknown footprints, an ambiguous AFK/HITL call, which of two conflicting tickets goes first, a ticket that needs a decision before it can start, a model or effort choice, anything else that would change the wave. Then ask them **sequentially**, one `AskUserQuestion` per question, never batched into a single call and never as a numbered list in prose. Each question stands on its own, offers concrete options, and puts your recommendation first marked "(Recommended)". After each answer, re-check whether it changes the frontier, the conflict table, or the remaining questions, and drop or add questions accordingly. Do not present the final list while any decision is unanswered, and do not guess an answer on King Rezi's behalf. Follow `.claude/skills/proactive-clarification/SKILL.md` for the shape of a good question.

## Output

Shown only after step 7 has no open question left.

### 1. Numbered list for King Rezi

Each row contains:

| Column | Content |
| --- | --- |
| Title | ticket ID and title |
| Blocker | the ticket or decision holding it, or none |
| Result | what exists when it is done |
| Mode | AFK or HITL |
| Lane | the proposed lane; HITL tickets get no lane |

### 2. Conflict table

| Ticket A | Ticket B | Shared path or hot spot | Verdict |
| --- | --- | --- | --- |

Verdict is one of: parallel-safe, sequential in one lane, next wave, semantic-conflict risk. List every pair that is not parallel-safe; for a wave with many tickets, summarize parallel-safe pairs in one line.

### 3. Wave block (machine-readable)

A single fenced `yaml` block that `wave-work` can read directly, so nothing is retyped. Contents come from the approved list; ticket IDs and paths are exact, and nothing here restates status that lives in the ticket files.

```yaml
wave:
  direction: <the work type King Rezi chose>
  approved: false            # becomes true only after King Rezi approves in chat
  max_concurrent_lanes: <n>
  gates_in_order: [<ADR approval | migration permission | merge to staging>, ...]
  lanes:
    - lane: <short-name>
      tickets: [<T-xxx>, ...]          # sequential order inside the lane
      model_hint: <default | lower model/effort for mechanical work>
      footprint: [<path or glob>, ...]
      depends_on_lanes: []
  hitl:
    - ticket: <T-xxx>
      reason: <decision | migration permission | manual verification>
  excluded:
    - ticket: <T-xxx>
      reason: <blocked by T-yyy | all items done | 🚫 | wrong direction>
  decisions:
    - question: <the question asked in step 7>
      answer: <King Rezi's answer>
```

Also include: the order of King Rezi's gates (ADR approval, migration permission, merge) and the estimated number of concurrent lanes. Then **stop** and wait for King Rezi's approval. After approval, set `approved: true` when the block is handed to `wave-work`.
