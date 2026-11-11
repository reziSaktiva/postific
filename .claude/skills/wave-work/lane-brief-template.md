# Lane brief

One brief per lane. Fill it with pointers (path or URL), not copies of documents (ADR-133).

## Goal

One sentence: the result that must exist when the lane is done.

## Scope

- Ticket: `T-xxx` (`project-os/tickets/...`), the items being worked.
- Applicable spec and ADRs: `specs/S-NNN.md`, `ADR-xxx`.
- Files the lane may change, and files that no other lane may touch.

## Constraints

- The lane's branch and worktree are cut from the integration branch `<name>`.
- Do not merge. Do not apply a migration. Do not commit or push unless King Rezi asks.
- A question that belongs to King Rezi is handed back, not answered by the lane.
- In a new worktree run `bun install` first; the pre-commit hook is not skipped.

## Definition of done

- [ ] The ticket's acceptance is met (Spec axis).
- [ ] Conforms to repo rules and architecture (Standards axis).
- [ ] `typecheck`, `lint`, and tests are green; E2E golden path when the ticket changes product behavior (ADR-149). The rules for running it are in the E2E section.
- [ ] The "Belum terbukti" (not yet proven) section in the ticket is updated honestly.

## E2E

When the lane changes product behavior (ADR-149):

- Run E2E in the main checkout. `E2E_BASE_URL` points to the dev server already running in that checkout.
- A golden path E2E is valid only when the checkout serving `E2E_BASE_URL` is at the lane's commit. A server in another checkout tests that checkout's code. Playwright uses the server that is already running (`reuseExistingServer` in `apps/web/playwright.config.ts`).
- A lane worktree has no `apps/web/.env.local`. Git ignores that file. Playwright loads it next to the config, so E2E from a lane worktree does not carry the main checkout's env.
- Do not run a second `next dev` in the same directory. `next dev` locks `.next/dev` per directory, so the main checkout's lock does not hold back another worktree. Evidence: T-225.1 (`project-os/tickets/v01-foundation.md`).

## MCP shadcn

- `.mcp.json`, `.cursor/mcp.json`, and `apps/web/components.json` are tracked by git, so a lane worktree already has them. Do not copy or link them. `.mcp.json` and `.cursor/mcp.json` are twin files (`AGENTS.md` rule 12); if they need to change, change them together, and that is outside the lane unless the ticket names those files.
- `apps/web/components.json` uses `"registries": {}`. `search_items_in_registries` answers that no registry is configured when that object is empty, or when the search runs from the repo root instead of `apps/web`. Evidence: T-225.3 (`project-os/tickets/v01-foundation.md`).
- Handling: run the shadcn search with working directory `apps/web` in the lane worktree. If the registry is still empty, read the local component source in that worktree. An IDE MCP session is bound to the workspace that was opened, not to a second worktree.

## Test checklist (anti-patterns)

Reject a test that is:

- **Implementation-bound:** it fails on a refactor with no behavior change (peeking at private functions, call order, or internal structure).
- **Tautological:** it proves something that is always true (asserting a value that was just set, or a mock that returns its own answer).

A good test crosses a public boundary (use case, repository, route) and fails when behavior changes.

## Lane report

Write the result as pointers: commit, tests run, open findings. Do not report "already pushed" without naming the commit.
