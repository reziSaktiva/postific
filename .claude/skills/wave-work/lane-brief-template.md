# Lane brief

One brief per lane, as short as possible. Pointers (path or URL), not copies (ADR-133). Delete any line that does not apply; do not send empty sections.

## Goal

One sentence: the result that must exist when the lane is done.

## Scope

- Ticket: `T-xxx` (`project-os/tickets/...`), the open items only.
- Spec and ADRs: `specs/S-NNN.md`, `ADR-xxx`.
- May change: <paths>. No other lane touches: <paths>.

## Constraints

- Branch and worktree cut from integration branch `<name>`. First step: `git merge-base --is-ancestor <integration tip you were cut from> HEAD`; if it fails, reset the lane worktree to the integration branch before any work. Then `bun install`; do not skip the pre-commit hook.
- Commit once to your own lane branch. Never push, merge, open a PR, or apply a migration (push and PR: `AGENTS.md` rule 9). Hand questions that belong to King Rezi back.
- Do not re-read files you already read or just edited; trim command output to failures.

## Definition of done

- [ ] Ticket acceptance met (Spec axis); repo rules and architecture respected (Standards axis).
- [ ] `typecheck`, `lint`, tests green. E2E golden path only if the ticket changes product behavior (ADR-149).
- [ ] The ticket's "Not yet proven" line is honest.
- [ ] After ticking an item or changing a status, grep the same ticket for older status phrases (e.g. "tetap terbuka", "belum Done (code)", "awaiting", "still open"); fix or mark them superseded.

## Only if it applies

Add one line, not the content. A lane reads [`lane-brief-extras.md`](lane-brief-extras.md) for:
- **E2E** (product behavior change), **MCP shadcn** (UI components), **Test anti-patterns** (any new tests).

## Lane report

At most 10 lines: commit hash, checks run and result, open findings. Never "already pushed" without the commit.
