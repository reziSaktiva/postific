# Wave retro

The last step of `wave-work` (S-003 § Behavior 2, step 11). **Suggestions
only:** the retro does not edit rules, skills, scripts, or tickets. King Rezi
decides which ones to act on, and each becomes its own ticket (ADR-132,
ADR-133).

## How to compile it

1. Collect the wave events that cost time or tokens, or nearly went wrong: session reports, `typecheck`/CI results, permission denials, repeated reads.
2. Put each event into one category below and write it as a suggestion (what to change, in which file, and the evidence from the event).
3. **Order by severity** in a single list: what could produce a wrong result or an unauthorized action comes first, then what wastes time or tokens, then convenience.
4. A suggestion that already has a home (an existing rule or skill) only points to that home; do not copy its content.

## Categories

| Category                     | Guiding question                                                            |
| ---------------------------- | --------------------------------------------------------------------------- |
| Navigation                   | Which document or section was searched for repeatedly or misread?           |
| Automated checks             | Which mistake was caught too late and could be caught by a script or hook?  |
| Tool economy                 | Which read, call, or model cost more than it needed to?                     |
| Instructions with no effect  | Which instruction was read but changed no behavior, or collided with another? |
| Information access           | What information was out of the agent's reach (permission, network, MCP) when needed? |

## Output format

```markdown
# Retro <wave name> · <date>

1. [<category>] <suggestion> · Evidence: <event, path or URL> · Severity: high | medium | low
2. ...
```

## Starting content: wave A lessons

Already locked in at `SKILL.md` § Wave A lessons already locked in; below is the
form the suggestions take if they are carried into the next wave.

1. [Automated checks] `typecheck` caught a semantic conflict that git let through after the lanes were merged. Suggestion: run `typecheck` after every merge, not only at the end. Severity: high.
2. [Information access] A migration permission relayed through another session was denied. Suggestion: ask King Rezi for the permission directly before a lane reaches that step. Severity: high.
3. [Navigation] A session report was cut off and then summarized as-is. Suggestion: read the full report and check commits, CI, and deploys at the source before summarizing (`SKILL.md` step 3). Severity: medium.
4. [Automated checks] A fresh worktree without `node_modules` kept the pre-commit hook from running. Suggestion: run `bun install` first in every worktree; consider a reminder in the brief template. Severity: medium.
5. [Tool economy] One build and one deploy per wave saves Railway and verification effort. Suggestion: keep one integration PR and one Verified (staging) per wave. Severity: low.
