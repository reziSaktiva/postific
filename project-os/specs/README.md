# Specs

The home of the **spec** layer (ADR-131). Not the home of docs, not the home of tickets, not an implementation log.

## Four layers

| Layer     | Home                                                                                                                                                                                                                       | When the agent opens it                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Docs      | `product-discovery/`, `context/`, `decisions/`                                                                                                                                                                             | When it needs the domain language or a decision that already exists                  |
| Spec      | `specs/S-NNN.md` in this folder                                                                                                                                                                                            | When the work spans more than one session                                            |
| Ticket    | `tickets/vXX-*.md`, `tickets/known-issues.md` for tickets born from a Known Issue (ADR-134), `tickets/s004-orchestration-language.md` for S-004 (ADR-159), or `tickets/s007-documentation-language.md` for S-007 (ADR-164) | After a task ID is chosen from `AVAILABLE_TICKETS.md`                                |
| Implement | code and tests                                                                                                                                                                                                             | When the ticket is worked. The result is a commit, not a new paragraph in the ticket |

Work that fits one session does not get a spec. The ticket points to the applicable docs and is implemented directly.

## When to write a spec

Write a spec after the decision has been made (docs / ADR), and before the ticket is split, when the result does not fit one context window.

Do not write a spec to repeat the interview. The interview happens before this file exists.

## Shape of `specs/S-NNN.md`

```markdown
# S-NNN · Title

**Docs:** ADR-xxx, the applicable baseline paths
**Tickets:** T-xxx (filled in after the tickets are created)

## Behavior

What must be true from the user's side. Not a list of files.

## Test seams

At which boundary this is tested. Module names, not code snippets.

## Out of scope

What is deliberately left out.
```

Spec IDs are global and never recycled. The next number is recorded in `AVAILABLE_TICKETS.md` when the first spec is created. While this folder is still empty, the first spec is **S-001**.

## Shape of a ticket

Release tickets stay in `tickets/vXX-*.md`, including after they are finished. Tickets born from a Known Issue live in `tickets/known-issues.md` (ADR-134) and have the same shape. S-004 tickets live in `tickets/s004-orchestration-language.md` (ADR-159) and S-007 tickets in `tickets/s007-documentation-language.md` (ADR-164).

```markdown
### T-xxx · Title

| Field            | Value                               |
| ---------------- | ----------------------------------- |
| **Status**       | ⏳ Not Started                      |
| **Mode**         | AFK or HITL                         |
| **Verification** | `local` or `staging` (ADR-161)      |
| **Domain**       | …                                   |
| **Spec**         | S-NNN, or "none — fits one session" |
| **Docs**         | the applicable ADR / baseline       |
| **Depends**      | T-xxx, or —                         |

**What to build:** the behavior that is finished when this ticket is done, from the user's side.

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

**Blocked by:** none, or T-xxx
```

**Mode (ADR-153, S-003):** **AFK** means an agent can finish the ticket on its own; **HITL** means an item needs an answer or decision from King Rezi (ADR approval, migration permission, manual verification). Only AFK tickets may become parallel lanes of a wave; HITL tickets are flagged and not run by an agent. A ticket without a marker is classified by `wave-plan` from its content, and the result is put to King Rezi. The marker is written on the ticket's status line, e.g. `⏳ Not Started` · **Mode** AFK.

**Verification and ticket status (ADR-161):** the **Verification** field answers once, at the start: provable as `local`, or some item is provable only on `staging`. A ticket is ✅ at Done (code); there is no intermediate waiting-for-staging status. Staging items move to the wave's verification ticket. The rule: ADR-161 and the `project-os-navigator` skill § New Work.

Do not write file paths, test counts, subagent names, or session stories into a ticket. They belong to the commit.

When a ticket is ✅, its row leaves `AVAILABLE_TICKETS.md`. Its section in the ticket file stays.
