# Integration Layer

This document defines the **Integration Layer** for the **Postific** product — the integration architecture with the Outstand API as the social media integration provider, covering the Anti-Corruption Layer, ConnectedAccount management, the publishing flow, webhook handling, engagement sync, analytics sync, and the error handling strategy.

This document is the reference for external integration design and does not cover code implementation. Implementation details (HTTP client, retry library, folder structure) are documented in Engineering Planning (M6).

---

# Purpose

* Define the position of the Outstand API in the system architecture.
* Set the Anti-Corruption Layer (ACL) as the boundary between the internal domain and external systems.
* Document the ConnectedAccount management flow via Outstand OAuth.
* Define the flow for publishing to social media through the Outstand API.
* Set the webhook handling pattern for events from Outstand.
* Document the synchronization strategy for engagement and analytics data.
* Define the error handling strategy for integration failures.

---

# Pre-Architecture Decisions

The following decisions were set before this document was created and are the foundation of the Integration Layer:

| Topic | Decision | Source |
|-------|-----------|--------|
| Social Media Integration Provider | Outstand API | ADR-005 |
| Entry Point for webhooks | Route Handler | ADR-016 |
| Cross-domain communication | Service-to-service call via public module API | ADR-018 |

---

# Outstand's Position in the Architecture

The Outstand API is an **external system** — outside the boundary of the internal domain. All interaction with Outstand is done exclusively through the **Anti-Corruption Layer**, so the internal domain never depends directly on Outstand's data structures or API contract.

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNAL SYSTEM                               │
│                                                                  │
│  Publishing BC ──────────────────────────────►                  │
│  Workspace BC  ──────────────────────────────►                  │
│  Engagement BC ──────────────────────────────►  OutstandAdapter │
│  Analytics BC  ──────────────────────────────►  (ACL)           │
│                                                      │           │
└──────────────────────────────────────────────────────┼──────────┘
                                                        │
                                               Outstand HTTP API
                                                        │
┌──────────────────────────────────────────────────────┼──────────┐
│                    EXTERNAL SYSTEM                    │           │
│                                                       ▼           │
│  Instagram · Facebook · Twitter · LinkedIn · TikTok · YouTube    │
│                  · Threads · Pinterest                           │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBHOOK FLOW (Inbound)                        │
│                                                                  │
│  Outstand ──► Route Handler `/api/webhooks/outstand`             │
│                   └──► WebhookProcessor                          │
│                             └──► ApplicationService (domain)     │
└─────────────────────────────────────────────────────────────────┘
```

---

# Anti-Corruption Layer

## Principles

The Anti-Corruption Layer (ACL) is a translation layer that:

1. Isolates the internal domain from breaking changes in the Outstand API.
2. Translates Outstand concepts into internal domain concepts (and vice versa).
3. Is the only point that knows Outstand's data structures.

**ACL rules:**
- The internal domain **must not** import Outstand types or data structures directly.
- All responses from the Outstand API are parsed and validated inside `OutstandAdapter` before being returned to the domain.
- If Outstand changes its response format, only `OutstandAdapter` needs to be updated — no changes in the domain.

## OutstandAdapter

`OutstandAdapter` is a dedicated module that implements all communication with the Outstand API.

**(ADR-079)** The `IOutstandAdapter` contract was promoted from a domain-only location
(`domains/publishing/adapters/`) to `packages/shared/src/contracts/` as a
**cross-domain shared contract** — originally built for Publishing's needs
(ADR-059), but the Analytics BC (metric ingestion) also needs to implement
the same methods (`fetchPostMetrics`, `fetchWorkspaceMetrics`). The old
file location in the `publishing` domain is kept as a re-export barrel. This is a new
exception to the `packages/shared` rule (AGENTS.md rule 5): port/ACL
contracts now belong to the category that may live there, besides shared types.

**(amendment to ADR-092)** `schedulePost`/`publishNow` accept ALL targets
at once in a single call and return ONE `outstandPostId` — no
longer one call per account. The per-account status (`platformPostId`,
`platformPostUrl`, `status`, etc.) is not available synchronously from this call;
it must be resolved later through `fetchPostOutcome`.

```
OutstandAdapter (Anti-Corruption Layer)
  ├── connectAccount(params) → ConnectedAccountData
  ├── disconnectAccount(outstandAccountId) → void
  ├── requestMediaUpload(params) → OutstandUploadTarget
  ├── uploadMedia(uploadUrl, bytes, contentType) → void
  ├── confirmMediaUpload(uploadId) → OutstandMediaData
  ├── schedulePost(targets[], params) → { outstandPostId }
  │     // targets: all destination accounts of this post at once (1 call, 1 post.id)
  │     // params include: caption, outstandMediaUrls, scheduledAt,
  │     // contentFormat, platformOptions? — mapped to Outstand overrides in the ACL
  ├── publishNow(targets[], params) → { outstandPostId }
  ├── fetchPostOutcome(outstandPostId, expectedOutstandAccountIds[]) → PostTargetOutcome[]
  │     // must be called to resolve the status per account (pending|published|failed);
  │     // not assumed to be synchronous from schedulePost/publishNow
  │     // (amendment to ADR-108) the list of target accounts is explicitly resent by the
  │     // caller — the adapter must not depend on state left by a previous
  │     // schedulePost/publishNow call (broken across the separate
  │     // process/module chunks of Server Action ↔ Route Handler, found in T-027.5)
  ├── cancelScheduledPost(outstandPostId) → void
  ├── fetchComments({ outstandPostId, platform, accountUsername }) → { comments }   // ADR-113: per post, no cursor
  ├── replyToComment({ outstandPostId, content, accountUsername, parentOutstandCommentId? }) → ReplyResult   // ADR-113, ADR-117
  ├── fetchPostMetrics(outstandPostId) → PostMetricsData
  └── fetchWorkspaceMetrics(outstandAccountId, period) → WorkspaceMetricsData
```

**Responsibilities of OutstandAdapter:**
- Build HTTP requests to the Outstand API (auth header, base URL, timeout).
- Parse and validate Outstand responses.
- Translate Outstand errors into an `IntegrationError` recognized by the domain.
- Hide pagination, retry, and protocol details from the caller.

**Not the responsibility of OutstandAdapter:**
- Business logic (authorization validation, domain rules).
- Data persistence to the database.
- Notifications to the user.

---

# ConnectedAccount Management

## Connect Account Flow

Connecting a social media account to a workspace is done through an OAuth flow managed by Outstand.

```
┌─────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  User   │    │  Next.js Server  │    │  Outstand API   │    │ Social Media │
│ Browser │    │  (Route Handler) │    │                 │    │  Platform    │
└────┬────┘    └────────┬─────────┘    └────────┬────────┘    └──────┬───────┘
     │                  │                        │                    │
     │  Click "Connect" │                        │                    │
     │─────────────────►│                        │                    │
     │                  │  Request OAuth URL     │                    │
     │                  │───────────────────────►│                    │
     │                  │  Return OAuth URL      │                    │
     │                  │◄───────────────────────│                    │
     │  Redirect to     │                        │                    │
     │  Outstand OAuth  │                        │                    │
     │◄─────────────────│                        │                    │
     │                  │                        │  OAuth consent     │
     │──────────────────────────────────────────►│───────────────────►│
     │                  │                        │  OAuth callback    │
     │                  │                        │◄───────────────────│
     │  Redirect to     │                        │                    │
     │  /callback URL   │                        │                    │
     │─────────────────►│                        │                    │
     │                  │  Verify + get account  │                    │
     │                  │───────────────────────►│                    │
     │                  │  Return account data   │                    │
     │                  │◄───────────────────────│                    │
     │                  │  Create ConnectedAccount│                   │
     │                  │  (WorkspaceService)    │                    │
     │  Account connected│                       │                    │
     │◄─────────────────│                        │                    │
```

**Entry Point:** Route Handler at `/api/integrations/outstand/callback`

**Steps:**
1. The user clicks "Connect Account" in Settings → Workspace Service requests the OAuth URL from `OutstandAdapter`.
2. The user is redirected to the Outstand OAuth URL — Outstand handles OAuth with the platform.
3. After consent, Outstand redirects to `/api/integrations/outstand/callback` with `code` and `state`.
4. The Route Handler verifies `state` (CSRF protection) and calls `WorkspaceService.completeAccountConnection(code)`.
5. `WorkspaceService` calls `OutstandAdapter.connectAccount(code)` to exchange the code for account data.
6. `WorkspaceService` creates the `ConnectedAccount` entity and saves it to the repository.

**Data stored on `ConnectedAccount`:**
- `outstandAccountId` — the ID from Outstand (permanent external reference).
- `platform` — the connected platform (`instagram`, `facebook`, etc.).
- `handle` — the account or page name.
- `status` — `active`.

**Notes:**
- The OAuth access token is **not stored** in the internal database. The token is managed entirely by Outstand.
- Token revocation is done through the Outstand API, not directly to the platform.
- **Twitter/X stays an MVP platform with mandatory BYOK.** The Project Owner configures the X Client ID/Client Secret manually in the Outstand dashboard for each environment. The application only uses accounts that are already available through Outstand and **does not receive, store, or forward the X secret**.

## Disconnect Account Flow

1. The user chooses "Disconnect" in Settings.
2. `WorkspaceService` calls `OutstandAdapter.disconnectAccount(outstandAccountId)`.
3. `WorkspaceService` changes `ConnectedAccount.status` to `disconnected`.
4. Posts already scheduled to this account are marked `failed` in the Publishing BC.

---

# Publishing Flow

## Schedule Post to Outstand Flow

Publishing to social media is done through the Outstand API — the internal system does not interact directly with the social media platform APIs.

**(amendment to ADR-092)** The diagram and steps below reflect the
1-call-all-targets model: `schedulePost` is called ONCE for all
`PostTarget`s of the same post, returning ONE `outstandPostId` at the
`Post` level. The per-account outcome (`platformPostId`, `platformPostUrl`,
`status`) is NOT returned synchronously by this call — it must be resolved
later through `OutstandAdapter.fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)`
(amendment to ADR-108; the T-026 webhook and the T-027/JOB-07 job both use
this path now).

```
┌──────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  PublishingService│    │  OutstandAdapter (ACL)│    │  Outstand API   │
└────────┬─────────┘    └──────────┬───────────┘    └────────┬────────┘
         │                          │                          │
         │  schedulePost(targets[]) │                          │
         │─────────────────────────►│                          │
         │                          │  POST /v1/posts/         │
         │                          │  (accounts: [...])       │
         │                          │─────────────────────────►│
         │                          │  Return { post.id, ... } │
         │                          │◄─────────────────────────│
         │  Return { outstandPostId}│                          │
         │◄─────────────────────────│                          │
         │                          │                          │
         │  Save outstandPostId      │                          │
         │  on Post (not PostTarget) │                          │
         │                          │                          │
         │  fetchPostOutcome(...)   │                          │
         │  (async/polling, resolve │                          │
         │  status per PostTarget)  │                          │
```

**Trigger:** The `Post` status transitions to `Scheduled` (after review is approved or the user schedules directly).

**Steps:**
1. `PublishingService` validates that all `PostTarget`s have an `active` `ConnectedAccount`.
2. `PublishingService` validates each `PostTarget`'s `contentFormat` against the platform matrix (ADR-039) as well as the completeness of media / `platformOptions` (e.g. a Pinterest pin).
3. For each original media from Supabase Storage, `PublishingService` requests a working copy through the ACL: request an Outstand upload URL → `PUT` the bytes to that URL → confirm the upload → receive the Outstand media URL.
4. `PublishingService` calls `OutstandAdapter.schedulePost(targets[], params)` ONCE for all `PostTarget`s of this post, with:
   - Each target's `outstandAccountId` from its `ConnectedAccount`.
   - Caption, the Outstand media working copy URL, and the publish time.
   - `contentFormat` + `platformOptions` per target — translated by the ACL into Outstand overrides (Story/Reel/Pin, etc.).
5. Outstand returns ONE `post.id` for all targets (not a job per account).
6. `PublishingService` stores `outstandPostId` on the `Post` (not the `PostTarget`) and changes `Post.status` to `Scheduled`. `PostTarget.status` stays `pending` until the per-account outcome is resolved.
7. `PublishingService` calls `OutstandAdapter.fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)` (amendment to ADR-108; immediately for Publish Now, or via the T-026 webhook/the T-027 JOB-07 job for Schedule) to fill in `platformPostId`/`platformPostUrl`/`status` per `PostTarget`.

**Notes:**
- The original media stays owned by the application in the private Supabase Storage bucket. A Supabase signed URL may only be used for internal/UI access, **not** as the publishing URL to Outstand.
- The Outstand working copy URL/media ID may be stored as optional metadata for observability, safe reuse, or cleanup; it is not the source of truth for the original asset.
- **(amendment to ADR-092)** Because `schedulePost` is now 1 call for all targets (all-or-nothing at the call level), the failure of that call marks ALL `PostTarget`s of that post `failed` at once — no longer an independent failure per target. Partial success (some accounts fail to publish after the call succeeds) is only known later through `fetchPostOutcome`/webhook, and that is marked per `PostTarget` independently.
- **Content format (ADR-039):** Outstand facilitates Post / Reel / Story (and other platform options such as a Pinterest board). The domain stores `ContentFormat` per target; only `OutstandAdapter` knows the shape of Outstand API fields (e.g. the Story flag / Reel routing / Pin metadata).

## Cancel Post Flow

1. The user cancels the schedule from the UI → `PublishingService.cancelScheduledPost(postId)`.
2. **(amendment to ADR-092)** `PublishingService` calls `OutstandAdapter.cancelScheduledPost(outstandPostId)` ONCE per post (not per `PostTarget`) — consistent with the 1-post-many-targets model.
3. `PostTarget.status` is changed to `pending` (back to the queue or draft).

---

# Webhook Handling

## Overview

Outstand sends webhook events for publication results and account token validity. Engagement does not use webhooks in the MVP.

**Endpoint:** `POST /api/webhooks/outstand`

## Webhook Security

Every webhook request from Outstand must be verified over the **raw body** before the payload is parsed:

```
Request comes in
    └── Route Handler `/api/webhooks/outstand`
            ├── Read the raw body
            ├── Verify the HMAC-SHA256 signature over the raw body
            ├── Reject if the signature is invalid → 401
            ├── Persist an idempotent receipt to outstand_webhook_events
            └── ACK 2xx; processing is continued by JOB-01
```

- Outstand includes the `X-Outstand-Signature` header containing the HMAC-SHA256 of the request body.
- The webhook secret is stored in an environment variable, not in the database.
- If the signature is invalid, a `401 Unauthorized` response is returned without processing the payload.

## Webhook Event List

| Event | Description | Domain Notified |
|-------|-----------|--------------------------|
| `post.published` | At least one target was published successfully; the outcome is still read per account | Publishing BC |
| `post.error` | All targets failed after Outstand retries; the ACL maps the per-account outcome to the domain status `failed` | Publishing BC, Notification BC |
| `account.token_expired` | The account token expired; the ACL maps the account to `error` and requires a reconnect | Workspace BC, Notification BC |

The events `comment.received`, `message.received`, mention, and other engagement webhooks are **not part of the MVP contract**. Note (2026-11-06): the vendor documentation as of 2026-11-05 does include `comment.received` and `message.received`; both are available but **not used** by the MVP (ADR-040, ADR-157). The "reason" column of ADR-040 stating that comment webhooks do not exist is a historical note on the documentation at the time.

## Webhook Processing Flow

```
Outstand
    └── POST /api/webhooks/outstand
            └── Route Handler
                    ├── Read raw body + verify HMAC
                    ├── Idempotent INSERT into outstand_webhook_events
                    ├── Enqueue JOB-01 for a new receipt
                    └── ACK 2xx

JOB-01
    └── WebhookProcessor.process(receipt)
            ├── post.published / post.error
            │     → OutstandAdapter.fetchPostOutcome(...)
            │     → PublishingService.applyTargetOutcomes(...)
            └── account.token_expired → ACL mapping
                                      → WorkspaceService.markAccountReconnectRequired(...)
```

**Webhook processing principles:**
- The Route Handler contains **no** business logic — it only reads the raw body, verifies HMAC, performs a durable idempotent receipt, enqueues, then ACKs.
- `WebhookProcessor` calls the right Application Service using `outstandPostId` (amendment to ADR-092, previously `outstandJobId`) or `outstandAccountId` as the external reference.
- A `2xx` response is only returned **after** the receipt has been persisted successfully. A persistence failure returns non-2xx so Outstand can retry delivery.
- Outstand's delivery retry stops at the receipt/ACK boundary. Internal processing retry is done separately by `JOB-01`; a processing failure does not ask Outstand to resend the event.

## Idempotency

Outstand may send the same event more than once. `outstand_webhook_events.outstand_event_id` stores the vendor event ID if available; if the delivery contract does not provide it, ingestion uses a deterministic fingerprint (SHA-256 of the raw body) as the receipt identity. A valid duplicate is ACKed `2xx` without re-enqueueing.

- The domain handler stays idempotent and applies the outcome per `PostTarget`. A `post.published` event must not mark all targets successful because that event can also represent partial success.
- The receipt status records `received | processing | processed | failed | dead_lettered` for auditing internal processing.

---

# Engagement Data Sync

## Data Source

The MVP Engagement covers only **comments and replies**. Direct Messages and mentions are outside the MVP scope.

| Mechanism | Trigger | Purpose |
|-----------|---------|----------|
| **Periodic pull** | JOB-03 every 30 minutes | Main source of new/changed comments |
| **Manual refresh** | User action | Runs the comment sync on demand then loads the latest data |

`OutstandAdapter.fetchComments` translates the Outstand response into domain comment data.

**Per-post comment pulling (T-218.7, an agent decision for King Rezi to review, 2026-11-06).** Outstand only provides comments **per post** (`GET /v1/posts/{id}/replies`, ADR-113); there is no per-account endpoint. Therefore JOB-03 and manual refresh pull comments per account by walking through posts, not by pulling a single comment list per account:

1. The post list comes from our own database (`PublishingPost`/`PublishingPostTarget`, not Outstand's list-posts endpoint): `published` targets of that account, `outstandPostId` filled in, not soft-deleted, ordered newest first (`publishedAt`, then `createdAt`).
2. **Limit: the 50 latest posts per account per cycle.** Posts older than the 50 latest are not pulled again, so new comments on those posts do not come in until another mechanism exists. The number 50 already applies in code (`listSyncablePostsByConnectedAccount`); T-218.7 keeps it rather than changing it.
3. One `fetchComments` call per post, **sequentially** (not in parallel) so the load on Outstand is controlled. `accountUsername` (= the account's `handle`) is always sent to disambiguate posts published to more than one account on the same network (ADR-117).
4. The failure of one post (404, temporary error) is recorded and skipped; the account sync does not fail entirely. Each comment is upserted idempotently (`workspace_id, connected_account_id, external_id`) with the internal `post_id` filled in from the post being pulled, so the per-post Engage (ADR-157) can group comments without a separate lookup.
5. Cost: Outstand calls per cycle per account <= 50 (one per post), so for N active accounts at most 50 x N per 30 minutes. If account/post volume grows, the next options (needing a decision): lower the limit, pull only posts published within a time window, or pull old posts less often. Not yet measured against the real Outstand quota.
6. Comments without a `post_id` (data from before KI-068) are not pulled again and appear in the "Tanpa posting" group; they cannot be replied to from Postific (ADR-113). `EngagementService` performs an idempotent upsert based on the external comment ID. If the sync finds new items, the service creates an internal `engagement_new` notification in aggregate; this notification **comes from the sync**, not a webhook.

**`InboxItem` attributes that come from Outstand:**
- `externalId` — the comment ID from Outstand (column `external_id`), used for the idempotency check.
- `platform` — from `ConnectedAccount`.
- `authorHandle` — the username of the comment sender (column `author_handle`).
- `content` — the comment text.
- `postId` — reference to `Post` if the comment relates to an internal post (matched via `outstandPostId`, amendment to ADR-092, previously `outstandJobId`).
- `receivedAt` — timestamp from Outstand.

## Reply via Outstand API

When the user replies from the Engagement Inbox:

1. `EngagementService.reply(inboxItemId, text)` is called.
2. `EngagementService` calls `OutstandAdapter.replyToComment(outstandCommentId, text)`.
3. After success, the `Reply` entity is saved in the repository as an audit trail.

---

# Analytics Data Sync

## Data Source

Analytics data (post metrics and workspace metrics) is fetched through periodic polling of the Outstand API. Outstand aggregates data from the social media platforms.

| Data | Polling Frequency | Stored As |
|------|-------------------|------------------|
| Post metrics (likes, comments, shares, reach) | Per-job after publish | `analytics_post_metrics` |
| Workspace metrics (followers, daily/weekly reach) | Daily | `analytics_workspace_snapshots` |

## Sync Flow

```
Background Job (scheduler)
    └── AnalyticsService.syncPostMetrics(workspaceId)
            └── OutstandAdapter.fetchPostMetrics(outstandPostId)
                    // amendment to ADR-092: renamed from outstandJobId. The result shape
                    // (per-account metrics + aggregated_metrics) has not yet been revised to follow
                    // the real get-post-analytics response — follow-up when T-041 is touched.
                    └── AnalyticsService.upsertPostMetrics(postId, metricsData)

Background Job (scheduler)
    └── AnalyticsService.syncWorkspaceMetrics(workspaceId, period)
            └── OutstandAdapter.fetchWorkspaceMetrics(outstandAccountId, period)
                    └── AnalyticsService.upsertWorkspaceSnapshot(workspaceId, snapshotData)
```

**Notes:**
- The scheduling of the background job for analytics polling is defined in `background-jobs.md`.
- Analytics does not use webhooks — Outstand does not provide webhooks for metrics changes.
- Metrics data is **append-only** or **upsert** — old snapshots are not deleted.

---

# Error Handling Strategy

## Error Classification

| Error Type | Example | Handling |
|------------|--------|------------|
| **Transient** | Timeout, 5xx, network error | Retry with exponential backoff |
| **Client Error** | 400 Bad Request, invalid params | Log + fail the operation, do not retry |
| **Auth Error** | 401 Unauthorized (wrong API key) | Alert the developer (monitoring), do not retry |
| **Account Error** | 403 (account access revoked) | Mark `ConnectedAccount.status = error`, notify the workspace owner |
| **Not Found** | 404 (job not found) | Log + skip (idempotent) |

## Strategy per Operation

**Connect Account:**
- Fails on the OAuth callback → show an error message to the user, do not save an invalid `ConnectedAccount`.

**Schedule Post:**
- Fails (transient) → retry via background job (max 3x).
- Fails (permanent) → mark `PostTarget.status = failed`, save `PostTarget.error`, notify the creator.

**Webhook Processing:**
- Failing to process a receipt → JOB-01 is rescheduled internally and the receipt is marked `failed`.
- Retry max 3x with exponential backoff: 5 minutes, 15 minutes, 60 minutes (per JOB-01 in `background-jobs.md`).
- After max retries are exhausted → the job is `failed` and the receipt `dead_lettered`, recorded for manual inspection.

**Analytics Sync:**
- Polling fails → log the error, skip this cycle, try again on the next schedule.
- The failure does not block other operations.

## IntegrationError

All errors from the Outstand API are translated by `OutstandAdapter` into the `IntegrationError` type before being returned to the domain:

```
IntegrationError
  ├── type: 'transient' | 'client_error' | 'auth_error' | 'account_error' | 'not_found'
  ├── outstandErrorCode: string?
  ├── message: string
  └── retryable: boolean
```

The internal domain **never** sees Outstand HTTP error codes directly.

---

# Integration Layer Decisions

| ID | Topic | Decision |
|----|-------|-----------|
| IL-D01 | ACL Pattern | Anti-Corruption Layer via `OutstandAdapter` — the only point of interaction with the Outstand API |
| IL-D02 | Token Management | The OAuth access token is not stored in the internal database — managed entirely by Outstand |
| IL-D03 | Webhook Security | HMAC-SHA256 verified over the raw body before parse/persist |
| IL-D04 | Webhook Response | Durable-before-ACK: the idempotent receipt is stored and JOB-01 scheduled before the `2xx` response |
| IL-D05 | Webhook Idempotency | Vendor event ID or SHA-256 raw body fingerprint on `outstand_webhook_events`; the domain handler stays idempotent |
| IL-D06 | Analytics Strategy | Periodic pull-based polling — there is no webhook from Outstand for metrics |
| IL-D07 | Media Strategy | Original in Supabase Storage; working copy uploaded via Outstand request URL → PUT → confirm; the Outstand URL is used for publishing |
| IL-D08 | Error Translation | All Outstand errors are translated into `IntegrationError` inside `OutstandAdapter` |
| IL-D09 | Engagement MVP | Comments/replies only through the JOB-03 30-minute job + manual refresh; no webhook/DM/mention |
| IL-D10 | X BYOK | The Project Owner sets the X credentials in the Outstand dashboard; the application does not store the X client secret |
| IL-D11 | Publish Outcome | `post.published`/`post.error` trigger a per-account outcome read; the status of each `PostTarget` is updated independently |
| IL-D12 | ADR-040 | IL-D03–D11 amend the old contract per ADR-040 |

---

# Related Documents

* `domain-model.md` — definition of `ConnectedAccount`, `PostTarget`, `outstandPostId`/`platformPostId` as external references (ADR-092)
* `database-strategy.md` — tables `workspace_connected_accounts`, `publishing_post_targets`, `analytics_post_metrics`, `analytics_workspace_snapshots`
* `application-layer.md` — Route Handler as the webhook entry point; Application Service as the OutstandAdapter caller
* `background-jobs.md` — webhook event retry strategy and analytics polling schedule
* `auth-architecture.md` — workspace membership check on every ConnectedAccount operation
* `../../project-os/DECISIONS.md` — ADR-005, ADR-016, ADR-018, ADR-019, ADR-020, ADR-021, ADR-079, ADR-092
