---
name: wave-plan
description: >-
  Prepares a wave of work from the ticket graph: computes the frontier
  (tickets with no blockers) from the Depends field, separates AFK and HITL
  tickets, checks for file conflicts, then stops at a numbered list for King
  Rezi to approve. Reads documents only; safe and cheap to call at any time,
  including just to see which waves are available. Execution uses the
  wave-work skill.
---

# Wave Plan

Step 1 of the wave flow (S-003 § Behavior 2). A spec is the planning unit;
a wave is the frontier at that moment and may cross specs. Basis: ADR-153, ADR-132.

## Boundaries

- **Reads documents only.** Does not create branches, worktrees, or commits, and does not change files.
- Stops at the numbered list King Rezi approves. Execution is started by the `wave-work` skill, only at King Rezi's request.

## Steps

1. **Collect candidates:** open `project-os/AVAILABLE_TICKETS.md` and stop there to choose an ID. Read ticket sections with `offset` and `limit` (or `bun run docs:where` when available, T-186), not the whole ticket file. The queue row alone is not enough to call a ticket remaining; the checkboxes are checked in step 2.
2. **Compute the frontier:** read the **Depends** field as a blocking edge. A ticket with no blockers, or whose blockers are already ✅ (or Accepted for an ADR), enters the frontier. It may cross specs. Tickets marked 🚫, and tickets whose blockers are not finished, are flagged and get no lane. Before a ticket is called remaining or enters the wave list, read the item checkboxes in the ticket file (`- [ ]` still open, `- [x]` done), not just the queue row. A ticket whose items are all `- [x]` is left off the list. An item already `- [x]` is not part of a lane's scope. Evidence: T-225.2 (`project-os/tickets/v01-foundation.md`).
3. **Separate AFK and HITL** from the **Mode** field in the ticket (its shape is in `project-os/specs/README.md`). A ticket with no marker is classified from its content: a decision item, migration permission, or manual verification by King Rezi means HITL. Only AFK tickets may become lanes; HITL tickets are flagged and not run by an agent.
4. **Check for file conflicts** between AFK tickets from the "Read first" section and the ticket items. Parallel lanes are only for tickets that do not touch the same files and do not depend on each other; otherwise order them sequentially within one lane.
5. **Vertical slices:** one lane produces a result that can be seen and tested, not a technical layer. A wide change uses expand, migrate, contract.
6. **Token economy:** limit concurrent lanes, flag mechanical lanes that may use a lower model and effort, and check the quota before the wave starts.

## Output

A numbered list for King Rezi, each row containing:

| Column | Content |
| --- | --- |
| Title | ticket ID and title |
| Blocker | the ticket or decision holding it, or none |
| Result | what exists when it is done |
| Mode | AFK or HITL |
| Lane | the proposed lane; HITL tickets get no lane |

Also include: the order of King Rezi's gates (ADR approval, migration permission, merge), the granularity questions that need an answer, and the estimated number of concurrent lanes. Then **stop** and wait for King Rezi's approval.
