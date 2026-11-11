# Handoff

Used when a wave session stops midway (usage limit, idle, change of agent). Basis: `project-os/specs/S-003.md` § 3, ADR-133. This document only **points**; the content of the spec, ticket, ADR, and diff is not copied.

## Rules

- **Keep it in the session scratchpad**, not in the repo, and do not commit it.
- **Pointers, not copies:** spec, ticket, ADR, commit, and PR are written as a path, hash, or URL. The next agent opens the sources itself.
- **No secrets or personal data:** no `.env.local` content, tokens, credentials, emails, or user data. If a value must be mentioned, write where it lives, not the value.
- **Brief:** enough for the next agent to continue without rereading the conversation.
- King Rezi's gate permissions (migration, merge to `staging`, close a PR) do not carry over through a handoff. The next agent asks King Rezi directly (see `SKILL.md` § King Rezi gates).

## Form

```markdown
# Handoff <wave or lane name> · <date>

## Follow-up goal

One to three sentences: what must be finished and which ticket (ID, section path).

## Last state

- Integration branch and lane branch: <name>; worktree: <path>
- Last commit per branch: <hash>
- PR and CI result: <URL>
- What is done (✅) and what is not, per ticket item
- What is not yet proven (e.g. items that can only be checked on staging)

## Decisions already made

One line per decision, with a pointer (ADR, PR comment, or a short quote of King Rezi's
message). Mark questions that still belong to King Rezi.

## Skills the next agent must call

Skill name and reason (e.g. `wave-work` starting from the step "Merge lanes into the integration branch").

## Reading pointers

Paths to open first: spec, ticket section, lane brief.
```
