# Background Jobs & Scheduler

This document defines the **Background Jobs & Scheduler Architecture** for the **Postific** product — the asynchronous job execution strategy covering content scheduling, retry mechanisms, engagement synchronization, analytics synchronization, and handling of failed jobs.

This document is the reference for background job design and does not cover code implementation. Implementation details (library, cron expression configuration) are documented in Engineering Planning (M6).

---

# Purpose

* Define the types of background jobs needed in the system.
* Set the PostgreSQL-based job queue architecture.
* Define the retry mechanism and handling of failed jobs.
* Set the scheduling strategy for periodic sync jobs.
* Document the integration of background jobs with the domains that need them.

---

# Pre-Architecture Decisions

The following decisions were set before this document was created and are the foundation of the Background Jobs Architecture:

| Topic | Decision | Source |
|-------|-----------|--------|
| Database Platform | Supabase PostgreSQL Cloud | Pre-architecture decision |
| Deployment | Railway | Pre-architecture decision |
| Social Media Integration | Outstand API (webhook for post status) | ADR-005 |
| Webhook Handling | Raw-body HMAC verification → idempotent durable receipt → ACK 2xx → internal processing | ADR-020, ADR-040 |
| Schema Organization | Single `public` schema with a domain prefix | ADR-014 |

---

# Job Type Overview

The system needs two categories of background jobs:

| Category | Trigger | Example |
|----------|---------|--------|
| **Event-driven** | Triggered by a specific domain event | Webhook receipt processing, publish notification |
| **Periodic** | Scheduled repeatedly at a fixed interval | Engagement sync, analytics sync, MCP audit purge |

---

# Job Queue Architecture

## Approach: PostgreSQL Job Queue + Railway Cron

The system uses a **PostgreSQL-backed job queue** with the `background_jobs` table as the source of truth for job status. Job execution is triggered by:

1. **Railway Cron** — calls the `/api/jobs/run` Route Handler at a given interval (every minute for event-driven jobs and every 30 minutes for the JOB-03 Engagement sync; Analytics, JOB-08 MCP audit purge, and JOB-10 import thumbnail sweep each have their own daily schedule).
2. **Ingestion/Application Service** — writes a new job to the `background_jobs` table when there is a new webhook receipt or another async operation.

```
┌──────────────────────────────────────────────────────────────────┐
│                    JOB LIFECYCLE                                  │
│                                                                   │
│  Domain Event / Cron Trigger                                      │
│         │                                                         │
│         ▼                                                         │
│  background_jobs table                                            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  id · type · payload · status · scheduled_at             │     │
│  │  attempts · max_attempts · last_error · created_at       │     │
│  └──────────────────────────────┬──────────────────────────┘     │
│                                  │                                 │
│                  Railway Cron ───► POST /api/jobs/run              │
│                                  │  (JobRunner Route Handler)      │
│                                  │                                 │
│                                  ▼                                 │
│                         Pick next pending job                      │
│                         Execute job handler                        │
│                         Update status (done / failed / retry)      │
└──────────────────────────────────────────────────────────────────┘
```

## `background_jobs` Table

```
background_jobs
├── id                UUID PK
├── type              TEXT        -- job type (see Job Type Registry)
├── payload           JSONB       -- data needed by the job handler
├── status            TEXT        -- pending | running | done | failed
├── scheduled_at      TIMESTAMPTZ -- time the job may be executed (for delay/retry)
├── started_at        TIMESTAMPTZ
├── completed_at      TIMESTAMPTZ
├── attempts          INT DEFAULT 0
├── max_attempts      INT DEFAULT 3
├── last_error        TEXT
└── created_at        TIMESTAMPTZ DEFAULT now()
```

**Status transitions:**

```
pending → running → done
                 → failed (attempts < max_attempts → scheduled_at updated → pending)
                 → failed (attempts >= max_attempts → status = failed, no retry)
```

## JobRunner Route Handler

`POST /api/jobs/run` is an internal endpoint called only by Railway Cron.

**Security:**
- The request must include the secret header `X-Job-Secret`, matched against an environment variable.
- Requests from outside (not Railway Cron) are rejected with `401 Unauthorized`.

**Execution:**
1. The Route Handler takes a batch of jobs with `status = pending` and `scheduled_at <= now()`.
2. Each job is executed by the matching handler based on `type`.
3. The status is updated after execution finishes.
4. A maximum of **10 jobs per run** to prevent a Railway timeout.

---

# Job Type Registry

## JOB-01 — Internal Webhook Processing

**Trigger:** A new receipt is successfully persisted to `outstand_webhook_events`, or a previous internal processing attempt failed.

**Type:** `outstand.webhook.process`

**Payload:**
```
{
  "webhookEventId": "uuid"
}
```

**Handler:** Loads the raw payload of the receipt that has passed HMAC from `outstand_webhook_events`, marks it `processing`, then calls `WebhookProcessor`. Official MVP events: `post.published`, `post.error`, `account.token_expired`. The ACL maps `post.error` → domain status `failed`, and `account.token_expired` → account status `error`/reconnect.

**Retry:** Maximum 3 times. Interval: 5 minutes, 15 minutes, 60 minutes (exponential backoff).

**On permanent failure:** Record in the log, mark the receipt `dead_lettered`, send an internal notification (if monitoring exists).

**Retry boundary:** Delivery retry by Outstand only happens if ingestion did not succeed durably/ACK. After ACK `2xx`, all retries are the internal JOB-01 mechanism and do not depend on vendor redelivery.

---

## JOB-02 — Post Status Notification

**Trigger:** JOB-01 completes `post.published` or maps `post.error` to the domain status `failed`.

**Type:** `notification.post_status`

**Payload:**
```
{
  "postId": "uuid",
  "postTargetId": "uuid",
  "workspaceId": "uuid",
  "userId": "uuid",        -- post owner
  "eventType": "published | failed",
  "platform": "instagram | facebook | ..."
}
```

**Handler:** Calls `NotificationService.createPostStatusNotification(payload)`.

**Retry:** Maximum 3 times. Interval: 1 minute, 5 minutes, 15 minutes.

---

## JOB-03 — Engagement Sync

**Trigger:** Railway Cron (periodic, every 30 minutes).

**Type:** `engagement.sync`

**Payload:**
```
{
  "workspaceId": "uuid",
  "connectedAccountId": "uuid",
  "outstandAccountId": "string"
}
```

**Handler:**
1. Fetches the list of published posts of the account from the database (maximum the 50 latest, only those that already have an `outstandPostId`), then calls `OutstandAdapter.fetchComments({ outstandPostId, platform, accountUsername })` **per post, sequentially** (Outstand only provides comments per post, ADR-113; there is no cursor). Details and the reason for the 50 limit: `integration-layer.md` § Data Source (T-218.7).
2. One post failing to be pulled does not fail the job: it is recorded, and the job continues to the next post.
3. Idempotent upsert of each comment (`workspace_id, connected_account_id, external_id`) with the internal `post_id` filled in, through `SyncCommentsUseCase` (the `engagement` domain).
4. Calls `NotificationService.notify(workspaceId, { type: 'engagement_new', ... })` from the sync result. Sends only one aggregate notification if many new comments are found.

**Retry:** Maximum 2 times. Interval: 10 minutes.

**Note (T-218.7):** `outstandAccountId` in the payload is used by the handler to find the account owner/member (RLS), and is no longer used as the `fetchComments` argument; what is sent to Outstand is `outstandPostId`, `platform`, and `accountUsername`. Cost per cycle: at most 50 calls per active account.

**Note:** JOB-03 is the main source of the MVP Engagement and is created per `active` `ConnectedAccount`. Manual refresh triggers the same sync handler on demand. There are no comment, DM, or mention webhooks; the scope is only comments/replies.

---

## JOB-04 — Analytics Sync

**Trigger:** Railway Cron (periodic, every 24 hours — midnight UTC).

**Type:** `analytics.sync`

**Payload:**
```
{
  "workspaceId": "uuid",
  "connectedAccountId": "uuid",
  "outstandAccountId": "string",
  "period": "last_7_days | last_30_days"
}
```

**Handler:**
1. Calls `OutstandAdapter.fetchWorkspaceMetrics(outstandAccountId, period)`.
2. Calls `OutstandAdapter.fetchPostMetrics(outstandPostId)` per post that does not yet have a snapshot (amendment to ADR-092, renamed from `outstandJobId` — now a post-level ID that covers all targets).
3. Stores the snapshot through `AnalyticsService`.

**Retry:** Maximum 2 times. Interval: 30 minutes.

---

## JOB-07 — Resolve Scheduled Post Outcome

**Trigger:** `SchedulePostsUseCase` enqueues this job when a scheduled post
(`Scheduled`) has passed its `scheduledAt` (due) — it is not created
directly by Railway Cron, but by the publishing domain itself;
Railway Cron triggers `/api/jobs/run`, which claims & executes any
generic job that is already due, including this type (T-027, the number JOB-07
is used because JOB-05/JOB-06 are already reserved by ADR-093 for Import Posts,
not yet implemented when this entry was written).

**Type:** `publishing.scheduled_post.resolve_outcome`

**Payload:**
```
{
  "outstandPostId": "string"
}
```

**Handler:** `ResolveScheduledPostOutcomeJobHandler` calls
`OutstandAdapter.fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)`
(ADR-108) then reuses `OutstandWebhookProcessor.resolvePostOutcome` — the
same method used by JOB-01/the T-026 webhook — to resolve the status per target
(`PublishingPostTarget`) and aggregate the post-level status
(`PublishingPost.status` → `Published`/`Failed`, ADR-109).

**Retry:** Follows the generic job runner retry (see § Retry Strategy
below — 5m/15m/60m), not a separate dedicated retry.

---

## JOB-08 — MCP Audit Purge

**Trigger:** Railway Cron (periodic, every 24 hours). Not the result of a domain event.

**Type:** `mcp.audit.purge`

**Payload:**
```
{}
```

**Handler:** Calls `McpAccessService.purgeAudit()`, which deletes the
`McpAuditLog` rows older than 90 days (MCP audit retention, ADR-138).
Done in T-149. Since v0.5 wave 1 (T-151, T-154; ADR-152) the same
job also cleans up expired `mcp_rate_limit_windows` and
`mcp_workspace_choices` rows (three cleanups).

**Idempotency:** Safe to run repeatedly — deletion is time-limit-based
(`created_at` older than 90 days), so a second run without expired
rows deletes nothing.

**Retry:** Follows the generic job runner retry (see § Retry Strategy
below — 5m/15m/60m).

## JOB-09 — Import Media (imported post thumbnails)

**Trigger:** After Import Posts (JOB-05) processes new posts, `EnqueueImportMediaUseCase`
enqueues a job (best-effort) for the imported post targets of that account that do not yet
have a thumbnail; also a one-off backfill through `POST /api/jobs/run?type=import-media`
(ADR-158, T-230).

**Type:** `import.media`

**Payload:**
```
{ workspaceId, connectedAccountId, actingUserId, targetIds: string[] }   // at most 5 targets
```

**Handler:** `ImportMediaJobHandler` calls `ProcessImportMediaUseCase`: download the
platform CDN media (image) or grab one frame (video, `ffmpeg`), shrink it to
webp 640 px (`sharp`), store it in the `media` bucket at
`{workspaceId}/imports/{targetId}.webp`, then fill in `thumbnail_storage_path`,
`thumbnail_kind`, and `thumbnail_attempted_at` in `publishing_post_targets`.

**Queue dedup:** an account that still has a pending/running `import.media` job is not enqueued again (payload key `connectedAccountId`).

**Time budget:** 20 seconds per job (BG-D05), cancelled via `AbortSignal`;
the remaining targets stay pending for the next job.

**Idempotency:** Only targets that do not yet have a thumbnail and have not been attempted
are processed. Permanent failures (expired URL, unknown host, too
large, redirect on a video `HEAD`) are marked with `thumbnail_attempted_at`; temporary
failures (timeout, 5xx, `ffmpeg` not installed) increment
`thumbnail_attempts` and are retried on the next trigger, up to a limit of 5
(`MAX_THUMBNAIL_ATTEMPTS`, T-233), then marked permanent like a permanent
failure. Cancellation due to the job time budget does not increment the counter.
The warning log includes the nested cause of the error.

**Retry:** Follows the generic job runner retry (see § Retry Strategy below).

## JOB-10 — Orphaned Import Thumbnail Sweep

**Trigger:** Daily fan-out (once per UTC day, riding the minute cron that is
already running through `executeIfDue`), or forced through
`POST /api/jobs/run?type=import-media-sweep` (ADR-158, T-231).

**Type:** `import.media.sweep` — empty payload.

**Handler:** `ImportThumbnailSweepJobHandler` calls
`PurgeImportThumbnailsUseCase.sweepOrphans`: for each workspace, list the files in
`{workspaceId}/imports/` in the `media` bucket, ask the DB which paths are still
referenced by `thumbnail_storage_path` (the SECURITY DEFINER function
`import_thumbnail_referenced_paths`), then delete the unreferenced ones. Files
younger than 1 hour are skipped (the upload precedes saving the path in the DB).
20-second budget; the workspace starting point is rotated per UTC day; the failure of one
workspace does not hold up the others. Idempotent.

**Immediate cleanup (not a job):** `WorkspaceService.deleteWorkspace`
calls `PurgeImportThumbnailsUseCase.purgeWorkspace` best-effort AFTER the
workspace row is deleted (cascade); its failure is only logged and swept by this
job. Disconnecting an account (`disconnectAccount`) only changes the status and does not
delete targets, so the imported post thumbnails of that account ARE KEPT (the
imported post history stays visible); imported posts cannot be soft-deleted (only
Drafts can, T-091.1).

---

# Retry Strategy

## Exponential Backoff

The retry delay is computed based on the number of `attempts`:

| Attempt | Delay |
|---------|-------|
| 1 (first retry) | 5 minutes |
| 2 | 15 minutes |
| 3 | 60 minutes |

The delay comes from an explicit table (lookup, not a formula) — it does not follow a
consistent power-of-two ratio (5→15 is ×3, 15→60 is ×4). Implemented
as the array `RETRY_DELAY_MINUTES = [5, 15, 60]` in
`apps/web/src/lib/jobs/backoff.ts` (T-027.3, KI-062).

## Dead Letter

A job that reaches `max_attempts` without success has its status changed to `failed` and will not be re-executed automatically. Dead letter jobs are recorded and can be inspected for debugging.

**For the MVP:** Dead letters are only recorded in the `background_jobs` table with `status = failed`. There is no automatic alerting — monitoring is done manually via the Railway dashboard or by querying the table.

---

# Integration with Domains

## Publishing BC → Background Job

```
PublishingService
  └── Webhook POST /api/webhooks/outstand
        └── Verify raw HMAC → persist outstand_webhook_events → ACK 2xx
              └── JOB-01 (internal processing)
                    ├── Success → update receipt + domain status → create JOB-02
                    └── Failure → internal retry; Outstand delivery stays separate
```

## Workspace BC → Background Job

```
WorkspaceService
  └── ConnectedAccount created/activated
        └── JobScheduler.scheduleEngagementSync(connectedAccount)
              └── Create JOB-03 (engagement sync, scheduled_at = now + 30m)
```

## Cron Trigger → Background Job

```
Railway Cron (*/30 * * * *)
  └── POST /api/jobs/run
        └── JobRunner.runScheduledJobs()
              ├── Fetch all active ConnectedAccounts
              ├── Create JOB-03 per ConnectedAccount (if none is pending yet)
              └── Execute pending jobs with scheduled_at <= now()

Railway Cron (0 0 * * *)
  └── POST /api/jobs/run?type=analytics
        └── JobRunner.runAnalyticsSync()
              └── Create JOB-04 per active ConnectedAccount
```

---

# Concurrency & Locking

To prevent race conditions when multiple Railway Cron workers execute the same job:

**Pessimistic Locking via `SELECT FOR UPDATE SKIP LOCKED`:**

```sql
SELECT * FROM background_jobs
WHERE status = 'pending'
  AND scheduled_at <= now()
ORDER BY created_at
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

`SKIP LOCKED` ensures two workers do not take the same job at the same time.

Once taken, the status is immediately changed to `running` within one transaction before execution begins.

---

# Error Handling

| Scenario | Behavior |
|----------|----------|
| Job handler throws an error | Status → pending with a delay (if attempts < max_attempts) |
| Job timeout (>30 seconds) | Status → pending, attempts + 1 |
| Database unavailable | JobRunner fails to start, Railway Cron will try again at the next interval |
| Outstand API down | Job handler fails → retry via exponential backoff |
| Job handler permanent failure | Status → failed, recorded in last_error |

---

# Monitoring (MVP)

For the MVP, monitoring is done simply:

* Query the `background_jobs` table to see jobs with `status = failed`.
* Railway dashboard to see the cron execution logs.
* Errors that occur in a job handler are recorded via `console.error` (Railway log stream).

More advanced monitoring (alerting, dashboard) is documented in Engineering Planning (M6) and implemented post-MVP.

---

# Decision Log

| ID | Decision | Reason |
|----|-----------|--------|
| BG-D01 | PostgreSQL job queue via the `background_jobs` table | No need to add new infrastructure — Supabase PostgreSQL already exists; simple and reliable for MVP volume |
| BG-D02 | Railway Cron as the execution trigger | Railway is already used as the deployment platform; the built-in cron needs no additional service |
| BG-D03 | `SELECT FOR UPDATE SKIP LOCKED` for concurrency | A native PostgreSQL feature — atomic, no need for Redis or a distributed lock |
| BG-D04 | Exponential backoff: 5m, 15m, 60m | Pragmatic for the MVP — gives enough time for Outstand recovery without being too long |
| BG-D05 | Max 10 jobs per run | Prevents a Railway timeout (max 30 seconds per request) |
| BG-D06 | Dead letter = status `failed` in the table | Sufficient for the MVP; no separate queue needed |
| BG-D07 | JOB-01 processes the internal durable receipt (`outstand.webhook.process`) | Separates vendor delivery retry from internal processing retry |
| BG-D08 | JOB-03 is the main source of comments/replies every 30 minutes + manual refresh | Outstand does not provide an MVP Engagement webhook |
| BG-D09 | ADR-040 | BG-D07–D08 amend the semantics of the old JOB-01 and Engagement |

---

# Related Documents

* `domain-model.md` — bounded contexts that need background jobs (BC-03, BC-05, BC-06, BC-09)
* `integration-layer.md` — webhook handling and retries that trigger JOB-01
* `realtime-strategy.md` — notifications created by JOB-02
* `database-strategy.md` — the `background_jobs` table as part of the schema
* `../../project-os/DECISIONS.md` — ADR-022
