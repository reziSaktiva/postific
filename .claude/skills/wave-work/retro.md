# Wave retro

The last step of `wave-work` (S-003, Behavior section (Perilaku), item 2, step 11). **Suggestions
only:** the retro does not edit rules, skills, scripts, or tickets. King Rezi
decides which ones to act on, and each becomes its own ticket (ADR-132,
ADR-133).

## How to compile it

1. Collect only the wave events that cost time or tokens, or nearly went wrong (session reports, `typecheck`/CI results, permission denials, repeated reads). No event, no item.
2. Put each into one category below, written as a suggestion: what to change, in which file, evidence.
3. **At most 5 items**, ordered by severity: wrong result or unauthorized action first, then wasted time or tokens, then convenience.
4. A suggestion that already has a home (an existing rule or skill) only points to it. Lessons already locked in `SKILL.md` are not repeated.

## Categories

| Category                    | Guiding question                                                        |
| --------------------------- | ----------------------------------------------------------------------- |
| Navigation                  | Which document or section was searched for repeatedly or misread?       |
| Automated checks            | Which mistake was caught too late and could be caught by a script/hook? |
| Tool economy                | Which read, call, or model cost more than it needed to?                 |
| Instructions with no effect | Which instruction was read but changed no behavior, or collided?        |
| Information access          | What was out of the agent's reach (permission, network, MCP)?           |

## Output format

```markdown
# Retro <wave name> · <date>

1. [<category>] <suggestion> · Evidence: <event, path or URL> · Severity: high | medium | low
```
