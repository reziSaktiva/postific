# PROJECT STATE

## Snapshot

- **Phase / Milestone:** Phase 6 — Implementation · M8 — Development (Sprint 5) · Overall: M7 100%, M8 in progress
- **Active Mode:** Ready for Development — implement product features according to the Architecture & Engineering Baseline
- **Top Next Tasks:** **The v0.6 Start Page MVP release (T-070 to T-074) is merged to `staging` (PR #200; ADR-142, ADR-143, ADR-144) and verified on staging (T-164 ✅, 2026-10-28)**; T-159, T-163, T-170 ✅. **T-166 ✅ and T-167 ✅ (2026-10-29, PR 217; the T-167.4 migration is applied to staging and verified).** The only open v0.6 ticket left is **T-171** (🟡: T-171.2 real Safari check ✅ closed 2026-10-29 with an iPhone Safari iOS 18 result, nothing else tested; the remainder of T-171.1, the view/click ratio, waits for production traffic) in `AVAILABLE_TICKETS.md`; a finding from that verification, **KI-104 / T-177** (light flash in dark mode): code and E2E test finished in PR 219 (2026-10-29), the ticket closes after it is merged and proven on staging. **QA E2E Playwright (ADR-149, spec S-002, tickets in v0.1):** T-172 ✅ (2026-10-29, PR 209 already merged to `staging`); T-176 ✅ (2026-10-29, PR 210); T-173 ✅ and T-174 ✅ (2026-10-29, PR 211; test accounts, E2E Sandbox workspace, Start Page tests 8/8 on staging and local); T-175 ✅ (staging E2E workflow proven to run, run 40820128077 on test PR 213 closed without merge, ADR-150; required check on `main` deferred to MVP public launch, **T-088.1, ADR-151: the AI must remind King Rezi when the v1.0 / MVP public launch phase starts**). **T-037 Enrich the coding rules** (🟡 In Progress, low priority). **T-115 Wire up the periodic daily Import Posts cron** (🟡 In Progress — remainder of T-115.5: native Facebook posts appear in Postific). T-128/T-129 finished 2026-10-19 (Home/Analyze default view became Monthly; Imported posts are counted in Analyze). Import Posts scope revision from King Rezi (2026-10-20): **T-131 finished** — differing request bodies for cron/connect/manual. **T-132 finished (2026-10-20, ADR-135)** — classification of Story/Reel/Post content type for Import results via Outstand Analytics. **Batch T-130/T-134/T-135/T-136 (KI-093/094/095/096) — implementation finished 2026-10-21 (ADR-136), E2E verification with a real account 2026-10-22:** the investigation of the Supabase vs Outstand data mismatch that produced these 4 tickets is fixed on the code side — Home `totalPosts` moved from Outstand `posts_count` (not supported for Facebook Page) to the internal `PublishingPost` status; disconnecting an account now triggers an immediate snapshot recompute (no Outstand call, the `DELETE` option was rejected by King Rezi because it breaks ADR-127 reactivation); the "monthly" window moved to the calendar month; the "Published posts" label became accurate automatically with the T-130 fix. The granularity of totalPosts in Home vs Analyze may differ (King Rezi's final decision, not a gap). Ridwan review PASS, Najwa QA PASS (898 tests); snapshots of 13 workspaces were backfilled manually. The real test account "Cook It Real Good" (4 channels) was used for E2E verification: **T-134 and T-135 ✅ Done** (2026-10-22); **T-130, T-136 ✅ Done** (2026-10-23, Home shows the 12 October posts matching the DB). Bug **T-139 (KI-099)** — transaction timeout when inserting a large import batch — fixed with a per-transaction chunk (50 posts) and verified (182 Instagram posts, 18.6 seconds) ✅ Done; new bug **T-141 (KI-101)** — `GET /v1/posts` max limit of 100 made imports of >100 posts fail with HTTP 400 — fixed with pagination ✅ Done. **T-133 ✅ Done (2026-10-23):** the T-133.2/.3 scripts were run on King Rezi's confirmation (Facebook 184, Instagram 182 posts, classified), verified in Home/Analyze/History; TikTok is proven supported by Import, Pinterest remains an explicit limitation (no test account). T-124 finished 2026-10-19 (KI-091, the `void` column error is gone in the staging retest). T-116 → T-117 → T-118 (agent token cost) finished 2026-10-16 (ADR-133). **T-137 (KI-097, ADR-137) — finished 2026-10-22**, Railway staging env filled in by King Rezi and e2e verification PASS. **T-140 (KI-100) — finished 2026-10-22**: production bug, an infinite redirect loop `/` ↔ `/login` when the session cookie is stale/invalid (`proxy.ts`), found by King Rezi during local `bun dev`, fixed in the same session (the stale session cookie is deleted before redirecting to `/login`) + a regression test was added (919 passed, 0 failed). **T-142 finished (2026-10-23, PR 193)** — History uses `publishedAt`, verified in the browser. Tickets from the PR 193 review **finished 2026-10-23 (PR 194):** **T-144** (WIB display time zone) and **T-145** (`occurred_at` generated column in the DB) ✅ Done; **T-122 ✅ Done (2026-10-23, on King Rezi's statement after a manual test; KI-053 closed)**; **T-146** (draft editor schedule input interpreted as WIB) ✅ Done 2026-10-23 (on King Rezi's statement after browser verification); **T-148** (MCP spike) ✅ Done 2026-10-26 and ADR-139 Accepted on King Rezi's decision; **T-149** (`mcp-access` schema and domain) ✅ Done 2026-10-26, with three things not yet verified on Postgres carried over to T-150; **T-150** (v0.5) 🟡 In Progress, sub-ticket details in [`tickets/v05-mcp-server-mvp.md`](tickets/v05-mcp-server-mvp.md). **T-178** ✅ 2026-10-29 (automated MCP E2E tests on staging). **T-147** (per-user time zone, ADR-146) ✅ Done 2026-10-28 (migration applied to the dev DB, verified by King Rezi in the browser; PR 204); follow-up **T-168** (MCP follows the user's time zone) ⏳ in v0.5. Full queue: [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md).
- **Blocker:** 1 active blocker — KI-015 (Google OAuth). The T-051 migration and the remaining KI-025 follow-ups are verified closed on staging (2026-10-13). Details in the **Blockers** section.
- **v0.5 pivot (2026-10-23, ADR-138, ADR-139 Accepted 2026-10-26):** the built-in AI Assistant is replaced by an MCP Server — the user's own AI works in Postific through MCP. Tickets **T-148–T-157** in [`tickets/v05-mcp-server-mvp.md`](tickets/v05-mcp-server-mvp.md); T-060–T-065 cancelled. Spikes T-148 ✅ and T-149 ✅ (2026-10-26); T-150 🟡 In Progress (2026-10-29): endpoint, 8 read tools, permanent consent hook, SQL test on staging, review, QA, and verification on Railway staging (T-150.7) finished; T-178 ✅ (2026-10-29, automated MCP E2E test on staging; refresh token and member leaving proven); T-150.8 ✅ (2026-10-30; Claude Code and Cursor proven, the Claude.ai web connector deferred in T-179.7); remaining T-150.9 (cleanup of dynamic OAuth clients and rate limit for registration without login); T-150.7 findings that are still open are in T-179. **Wave 1 (2026-10-30, branch `feature/mcp-v05-gelombang-1`):** code for T-151 (OAuth consent screen), T-152 (draft tools + `created_via` source marker), and T-154 (Postgres rate limit) finished and passed typecheck, lint, unit tests, and Ridwan review; three migrations were applied to the shared DB (with King Rezi's permission, 2026-10-30) and 34 DB integration tests passed, and all three (together with T-180) are Done (code), waiting for Verified (staging) via T-189 (ADR-153; testing on the local server is blocked by a different secret, see T-179.4). The baseline decision was approved by King Rezi in **ADR-152 (Accepted 2026-11-02)**; non-blocking follow-up in T-180.
- **Draft Editor redesign following the Buffer pattern (2026-11-03, ADR-155, spec S-005):** the Stage 1 design was confirmed by King Rezi in the Postific Design Review gallery (the ADR-155 addendum closes the open questions and adds the rule that a Reel requires a video, amending ADR-154). Tickets **T-199 to T-214** (foundation, Reel rule, channel row, editor and network blocks, Preview, footer and schedule, screen variants, QA, then fixes, review follow-ups, and RBAC E2E in T-208 to T-214) are in `AVAILABLE_TICKETS.md`; code may be written through those tickets. **Wave 8 (2026-11-05, PR 258 merged to staging):** tickets T-213 (remainder of the T-212 review) and T-214 (Creator RBAC E2E) were born; T-211 and T-214 Done (code). **Wave 9 (2026-11-05, PR 260 and 261):** T-207.6 Verified (staging) through staging E2E run 41999328811 (67 passed) and the post status QA spec 13 passed; T-214.5 proven in CI. Remaining S-005: T-207.7, T-209, T-215, T-204.4, and T-213/T-208 as named in their tickets. Per-ticket status is in `AVAILABLE_TICKETS.md`.
- **Per-post Engage following the Buffer pattern (2026-11-05, ADR-157 Accepted, spec S-006):** tickets **T-216** ✅ (design confirmed by King Rezi in the gallery) and **T-221** ✅ (UX and architecture baselines aligned, 2026-11-06), T-217 to T-220, T-222 and T-224 in [`tickets/v04-engagement-mvp.md`](tickets/v04-engagement-mvp.md); T-223 (Mentions) ⏸️ Deferred. T-217 and T-218 Done (code) (PR 263, 264, 265). **Wave 3 (2026-11-06, integration branch `feature/s006-gelombang-3-engage-ui`, no PR yet):** T-219, T-220, T-224 Done (code), waiting for Verified (staging) (ADR-153); T-222 🟡 (E2E 11/11 green on `local`, Ridwan review, Najwa QA, `/code-review` finished; T-222.1-.3 not yet checked). Decisions from King Rezi that are waiting: review findings that were not fixed, the T-216 design deviation, and follow-ups without a ticket (sidebar badge, Home Snapshot, List pagination); details in T-222 and `AVAILABLE_TICKETS.md`. Per-ticket status is in `AVAILABLE_TICKETS.md`.
- **S-007 documentation language (2026-11-13, ADR-163, ADR-164):** layer 3 documents are in English and the document keywords are replaced in tickets and specs (T-263 to T-277 Done (code)); ADR files and the `DECISIONS.md` index keep their Indonesian prose and keywords by decision of King Rezi. Spec: [`specs/S-007.md`](specs/S-007.md).
- **Task queue:** [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md). Tickets, including finished ones, are in `tickets/`. Do not look for task details in this file.
- **KI-073–080 Resolved (2026-09-26)** — 4 Instagram publish bugs (caption required for Story, Story publish without media, media upload >1MB fails, account avatar not shown in the sidebar) fixed + verified live against real Instagram/Facebook accounts (ADR-120). 2 derived bugs found during verification (a `disconnected` account cannot reconnect; the OAuth callback silently succeeds on a genuine conflict) fixed via **ADR-122**. Plus **KI-080** (new and immediately Resolved) — the Railway staging build failed (`next.config.ts` could not resolve the workspace import `@social/shared`), fixed in a separate branch before the KI-078/079 fixes went in.
- Phase/mode/issue details are in the sections below. Finished tickets are in `tickets/`. Decisions are in `DECISIONS.md`.

---

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 1.1.10     |
| Status       | Active     |
| Last Updated | 2026-11-06 |

---

## Current Status

| Item              | Value                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Current Phase     | Phase 6 — Implementation                                                                                   |
| Current Milestone | M8 — Development                                                                                           |
| Current Sprint    | Sprint 5                                                                                                   |
| Overall Progress  | M7 100% · M8 in progress                                                                                   |
| Project Status    | M8 in progress — Publishing MVP (Real OutstandAdapter required; the production-path Fake removed, ADR-119) |

---

## Current Focus

M7 Repository & Bootstrap is **finished**. M8 Development is **in progress**.

- **AI Context layer** (`context/`) is scaffolded (option A) — index + operational agent rules; not a duplicate of the baseline.
- `AGENTS.md` at the root exists; the relevant official vendor skills (Prisma,
  Better Auth, Vercel, Supabase) are installed in `.claude/skills/` —
  the only skill location since ADR-064 (`.agents/skills/` was deleted).
- The project is worked on in **two tools**: Claude Code (primary) and Cursor. Parity of
  agent assets + two twin file pairs that must be kept in sync (MCP config,
  secret-read protection) are documented in the section "Tool compatibility"
  in `AGENTS.md` (ADR-064).
- The real Outstand runtime integration (ADR-040) is live through the Real
  OutstandAdapter (T-025 ✅, KI-003 Resolved); the production-path Fake was deleted
  (T-106 ✅, ADR-119 — `OUTSTAND_API_KEY` required). The Astryx→shadcn/ui UI
  migration (ADR-097, release v0.7) is 100% complete — its tickets are in
  `tickets/v07-astryx-shadcn-migration.md`, not here.
- The **task queue** is in [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md). Tickets
  per release are in `tickets/` (ADR-062, ADR-131).

---

## Active Conversation Mode

Current Mode: Ready for Development

Current Phase: Phase 6 / M8 Development in progress

Current Objective:

- Start implementing product features according to the Architecture & Engineering Baseline
- Use `context/` + `AGENTS.md` as the agent's entry point while coding

Allowed Actions:

- Discussion
- Brainstorm
- Documentation
- Feature Implementation (M8)
- Refining the AI Context (`context/`, `AGENTS.md`) when needed

Restricted Actions:

- Changes to the Architecture / Engineering Baseline without an ADR
- Detailed wireframes (unless needed to implement a screen)

---

## Milestone Progress

| Milestone                   | Status         |
| --------------------------- | -------------- |
| M0 — Project Foundation     | ✅ Completed   |
| M1 — Discovery              | ✅ Completed   |
| M2 — Business Planning      | ✅ Completed   |
| M3 — Product Planning       | ✅ Completed   |
| M4 — UX Planning            | ✅ Completed   |
| M5 — System Architecture    | ✅ Completed   |
| M6 — Engineering Planning   | ✅ Completed   |
| M7 — Repository & Bootstrap | ✅ Completed   |
| M8 — Development            | 🟡 In Progress |
| M9 — Testing & Release      | ⏳ Pending     |

---

## In Progress

Tasks with status 🟡 exist **only** in [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md)
and their ticket section in `tickets/vXX-*.md` (ADR-131) — they are not duplicated here.

Non-task notes (not tasks, so they do belong here): the template
`design-tokens.md` has status Draft / TBD; final values evolve iteratively
co-equal with the design artifact (ADR-140, replacing ADR-056) — there is no longer a "designer
joins" gate, this project will not hire an external designer (ADR-057,
amending ADR-038 & ADR-041).

---

## Next Tasks

The queue of unfinished tasks is in **[`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md)**.
The Snapshot above already copies their IDs + short titles. **Do not rewrite the
task list/details here** (ADR-062, ADR-131).

---

## Known Issues

> **`KI-XXX` ID** (ADR-066, ADR-067, ADR-131, ADR-132). IDs are never recycled. Every open KI has a ticket. A row here only points to that ticket. A KI leaves this list when its closing ticket is finished.

| KI     | Status                                                                                                               | Ticket                                |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| KI-015 | Partly Resolved — remaining: Google OAuth env not yet filled in                                                      | [T-119](tickets/known-issues.md)      |
| KI-028 | Open — production environment does not exist yet                                                                     | [T-088](tickets/v10-public-launch.md) |
| KI-103 | Open — the old Claude Design project is not yet detached and its contents are not yet verified (deadline 2026-12-14) | [T-158](tickets/known-issues.md)      |
| KI-105 | Open — scheduling fails with HTTP 400 and one post published immediately but recorded as `failed`                    | [T-195](tickets/known-issues.md)      |
| KI-106 | Open — RLS disabled on 8 `public` tables on staging                                                                  | [T-196](tickets/known-issues.md)      |
| KI-107 | Open — Instagram and other platforms can be scheduled/published without media                                        | [T-197](tickets/known-issues.md)      |
| KI-108 | Open — Save as Draft from the Queue does not move to Drafts (a Realtime server action makes the redirect fail)       | [T-208](tickets/known-issues.md)      |

KI-104 (T-177) removed 2026-11-02. KIs whose tickets are finished were removed from this list on 2026-10-16 (ADR-132): KI-044 (T-108), KI-046 (T-007.7), KI-049 and KI-063 (T-107), KI-058 (T-109), KI-086 (ADR-127), KI-088 (T-090), KI-090 (T-113). On 2026-10-19: KI-027 (T-008), KI-033 (T-120), KI-050 (T-121), KI-089 (T-123), KI-091 (T-124). On 2026-10-21: KI-098 (T-138, Resolved — HTML escape fix implemented + review + QA PASS). On 2026-10-22: KI-097 (T-137, Resolved — staging SMTP adapter finished, Railway staging env filled in by King Rezi & e2e verification PASS); KI-094 (T-134, Resolved — E2E disconnect→recompute verification PASS with a real account, YouTube `@cookitrealgood` intentionally left disconnected); KI-095 (T-135, Resolved — calendar month window verification PASS via SQL query with a real account). On 2026-10-23 (tickets Done): KI-084 (T-123, along with KI-089), KI-092 (T-127), KI-093 (T-130), KI-096 (T-136), KI-099 (T-139), KI-100 (T-140), KI-101 (T-141). On 2026-10-23: KI-102 (T-143, Resolved on King Rezi's statement; evidence of the 2026-10-24 cron cycle was not yet visible in the DB when checked, reopen if the result differs). On 2026-10-23: KI-053 (T-122, Resolved on King Rezi's statement after a manual test of email A vs email B; no automated evidence was verified).

---

## Blockers

**The AI must check this before working on any subtask that touches the area below.** One blocker is still open. If executing a subtask in this area
fails, first check whether this blocker is the cause before concluding
there is a bug in the code.

| ID         | Blocker                                                                                                                                | Blocks               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **KI-015** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` not yet filled in. Ticket: T-119. `JOB_SECRET` is filled in on Railway staging (2026-08-14) | Google OAuth sign-in |

**Resolved 2026-10-13:** the migration `20260922110000_t051_filter_active_status_engagement_sync_lookup` has been applied to the staging database since 2026-09-22 (`_prisma_migrations.finished_at` is filled in, not rolled back). The function `webhook_find_account_owner_by_outstand_account_id` returns the `status` column. The "not yet deployed" note in Blockers was document drift. No new `db:deploy` in this session.

**Resolved 2026-10-13:** remaining KI-025 follow-ups (item 1 cron health check + item 3 backfill). The Railway `cron` service on staging answered **200** every minute on 2026-10-13. The last `engagement.sync` job finished 2026-10-13 07:08 UTC; the two `pending` rows are the next 30-minute schedule, not a stuck job. The five targets that used to be stuck `pending` (`l21bW`, `MAnO3`, `FWnBp`, `XnD5d` → `published`; `3YuZC` → `failed`) have had a final status since 2026-10-05. There is no `PublishingPostTarget` with status `pending`. Item 2 (enqueue `resolve_outcome` in Publish Now) finished 2026-10-05. No new code.

**Resolved 2026-09-07:** KI-048 (3 Prisma T-026 migrations not yet `prisma
migrate deploy`-ed to the dev/live DB) — King Rezi ran `bun run
db:deploy`, the migrations were verified applied (Najwa QA Engineer cross-check
via Supabase MCP), real end-to-end retest of 5 webhook scenarios all PASS.
**T-026 and T-036 are both closed `✅ Done`**, see the tickets in `tickets/`.

**Resolved 2026-08-14:** KI-025 (Railway never created) — staging
is live & verified, see the tickets in `tickets/`. The remaining production gap
is recorded separately as **KI-028** (does not block M8/T-027 staging).

**Resolved 2026-08-24:** KI-034 (QA Najwa has not retested the golden path of workspace switch
with the new Tier 2 confirmation dialog, T-089.6/ADR-089) — Najwa's
formal QA finished, passed fully (unit tests + full suite 157 passed/3
skipped/0 failed + end-to-end browser golden path, no new bugs),
see the tickets in `tickets/`.

**Resolved 2026-08-31:** KI-038 (T-093.4 real 2-account browser end-to-end RBAC verification not yet
done) — Najwa QA Engineer completed the verification
with 3 real accounts (Owner/Admin/Creator) in one workspace, all RBAC
scenarios PASS; 1 bug found (a Creator could access `/settings/members` that
should be "No access") and was fixed + re-verified
(commit `6fdf272`), see the tickets in `tickets/`.

Details of each are in the **Known Issues** section above — this table
is only a pointer so the active blocker is visible immediately without having to comb through
the whole Known Issues list.

---

## Completed (Summary)

- **T-172 ✅ Done — Playwright (Chrome) installed in `apps/web` (2026-10-29, ADR-149, spec S-002; PR 209)** — smoke test 2/2 passed on local and staging; `typecheck`, `lint`, and unit tests green. Details in `tickets/v01-foundation.md`.
- **T-070 to T-074 ✅ Done — Start Page MVP, release v0.6 (2026-10-28, PR #200, merged to `staging`; ADR-142, ADR-143, ADR-144)** — public page `/u/[slug]` (Card Stack, preset themes `default`/`dark`/`accent`), Page Editor (links, reorder, Publish, Share, Profile with Save), basic analytics (visits and clicks) only in the editor. Public reads and counters go through `SECURITY DEFINER` functions. Ridwan review PASS, Najwa QA PASS. CSP nonce `/u/*` (T-160), artifact cleanup (T-161), and small counter/data fixes (T-162.1-.3) ✅. **T-159 ✅** (2026-10-28, PR #203, merged): the profile photo is uploaded to the `avatars` bucket, not a pasted URL. Four migrations applied and verified on staging (T-164 ✅); details in `tickets/v06-start-page-mvp.md`.
- **T-149 ✅ Done — `mcp-access` schema and domain (2026-10-26, ADR-141)** — tables `mcp_grants` and `mcp_audit_logs` (RLS policy `app_runtime`) migrated to staging, the old AI tables and domain deleted, `McpAccessService`, the Prisma repository, and JOB-08 `mcp.audit.purge` finished (Ridwan review passed, Najwa QA PASS). The repository SQL and JOB-08 are not yet tested on Postgres staging; carried over to T-150. PR 201 (review 2026-10-28): 6 findings fixed, 3 skipped on King Rezi's decision (detailed in T-149.8).
- **T-144 and T-145 ✅ Done — WIB Publish display and `occurred_at` for History ordering (2026-10-23, PR 194)** — History/Calendar/Queue use a fixed Asia/Jakarta (helper `wib-time.ts`); the generated column `occurred_at` + index `(workspace_id, occurred_at DESC)` replace the JS sort. Verified through the DB and a local dev server (not a Railway deploy).
- **T-143 ✅ Done — periodic import catches up on the history of a new account (2026-10-23, KI-102, PR 192)** — a `null` watermark uses a 1-year lookback and a limit of 1000, the job result is stored in `payload.result`. Closed on King Rezi's statement; evidence of the 2026-10-24 cron cycle was not yet visible in the DB when checked.
  The following are the last 5 items finished. Full tickets are in `tickets/`. Session history is in git.

---

## Recent Decisions (Summary)

The latest ADRs. Full list (index + link to each ADR): see `DECISIONS.md`.

- **ADR-164** — S-007 tickets live in their own file `tickets/s007-documentation-language.md` (amending ADR-159).
- **ADR-163** — Layer 3 documents move to English, keywords change with them, an Append-Only exception for keyword replacement in history (amending ADR-160; S-007, T-263).
- **ADR-162** — The eight `.claude/agents/` files follow English as part of layer 2 (amending ADR-160; S-004, T-254).
- **ADR-161** — ✅ tickets are at Done (code); items that need staging move to the wave verification ticket, the intermediate status 🟡 `waiting for Verified (staging)` is removed, the Verification field is `local` or `staging` (amending ADR-153; T-247).
- **ADR-160** — Orchestration language: layers 1 and 2 move to English; the rule text lives only in `AGENTS.md` rule 8 (S-004, T-234).
- **ADR-159** — S-004 tickets live in their own file (amending ADR-131 and ADR-134).
- **ADR-158** — Imported post media is stored at Import as a small thumbnail, not a hotlinked platform CDN URL (amending ADR-093; T-228).
- **ADR-157** — Engage follows the Community Buffer pattern: the main unit is per post, statuses `replied` / `resolved` / `dismissed`, Filter & Sort panel, By post / List toggle; Mentions deferred (amending KSP-06 and KSP-D06 via T-221; spec S-006).

---

## Related Documents

- AVAILABLE_TICKETS.md — queue of unfinished tasks; tickets in `tickets/`
- PROJECT_OVERVIEW.md
- ARCHITECTURE_OVERVIEW.md
- PROJECT_RULES.md
- DECISIONS.md
- ../product-discovery/06-engineering/
- ../product-discovery/05-architecture/
- ../product-discovery/04-ux/
