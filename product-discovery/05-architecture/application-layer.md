# Application Layer

This document defines the **Application Layer** for the **Postific** product — how the Next.js App Router interacts with domain logic, the service layer, and the repository layer in the Modular Monolith + DDD architecture.

This document is the reference for the system's layer structure and the interaction rules between layers. Detailed implementation (code, ORM, exact folder structure) is documented in Engineering Planning (M6).

---

# Purpose

* Define the system layer stack and the responsibilities of each layer.
* Determine the Next.js entry point patterns: when to use Server Components, Server Actions, and Route Handlers.
* Set the Application Service contract per Bounded Context.
* Define the Repository Pattern used across all domains.
* Set the rules for cross-domain communication.
* Document the error handling strategy at the architecture level.

---

# Layer Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS                                  │
│  (Next.js App Router — Server Components, Server Actions,        │
│   Route Handlers, Middleware)                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    APPLICATION SERVICE LAYER                     │
│  (One service per Bounded Context — orchestration, authorization,│
│   coordination of domain logic + repository)                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    DOMAIN LOGIC LAYER                            │
│  (Entities, Value Objects, Domain Rules — pure business logic,   │
│   no dependency on infrastructure)                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    REPOSITORY LAYER                              │
│  (Interface defined in the domain module; implementation          │
│   uses Prisma Client)                                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    INFRASTRUCTURE                                │
│  (Supabase PostgreSQL, Supabase Storage, Better Auth)            │
└─────────────────────────────────────────────────────────────────┘
```

---

# Layer Responsibilities

## Entry Points — Next.js App Router

The outermost layer that receives requests from the browser or external systems. It must not contain business logic.

| Entry Point | Responsibility | Usage Example |
|-------------|----------------|-------------------|
| **Server Component** | Fetch data to render pages; no side effects | Load the post list, load the analytics snapshot |
| **Server Action** | Handle mutations triggered from the UI (form, button click) | Create a draft, schedule a post, update a profile |
| **Route Handler** | Handle requests from external systems or API clients | Outstand webhook, health check endpoint |
| **Middleware** | Authentication guard, injecting workspace context into the request | Verify the session, redirect if not logged in |

**Rules:**
- Entry Points may only call the **Application Service** — they must not go directly to the repository or domain logic.
- Entry Points are responsible for data serialization/deserialization (request → DTO → service input).
- Errors from the Application Service are caught at the Entry Point and translated into an appropriate response.

---

## Application Service Layer

The heart of every Bounded Context. The service layer orchestrates the operation flow: input validation, authorization, domain logic execution, and interaction with the repository.

**One service per Bounded Context:**

| Bounded Context | Application Service |
|----------------|---------------------|
| BC-01 Identity | `IdentityService` |
| BC-02 Workspace | `WorkspaceService` |
| BC-03 Publishing | `PublishingService` |
| BC-04 MCP Access | `McpAccessService` |
| BC-05 Engagement | `EngagementService` |
| BC-06 Analytics | `AnalyticsService` |
| BC-07 Start Page | `StartPageService` |
| BC-08 Media | `MediaService` |
| BC-09 Notification | `NotificationService` |

**Responsibilities of the Application Service:**
1. Receive input from the Entry Point (format already validated at the Entry Point).
2. Run the **authorization check** — does the user have permission for this operation.
3. Call domain logic to validate and execute business rules.
4. Interact with the repository to read/write data.
5. Call other domain services if needed (via service-to-service call).
6. Throw a domain error if the operation is invalid.

**Rules:**
- The Application Service **must not** execute SQL queries directly or access the Prisma / Supabase client — all domain data access goes through the repository.
- The Application Service **must not** contain rendering logic or HTTP concerns.
- Each service may only access the repositories of its own bounded context.

---

## Domain Logic Layer

The layer that contains **pure business logic** — not dependent on any framework, database, or infrastructure.

**Domain Logic components:**
- **Entities** — objects with identity (Post, Workspace, Member, etc.)
- **Value Objects** — objects without identity, immutable (BrandSettings, PostStatus, etc.)
- **Domain Rules** — business validations and constraints (e.g. only the Owner can delete a workspace, a Post cannot be scheduled in the past)

**Rules:**
- Domain logic **must not** import from infrastructure, the framework, or the service layer.
- Domain logic may be unit-tested without a database or server setup.
- Shared types between domains (UserId, WorkspaceId, etc.) are taken from `packages/shared`.

---

## Repository Layer

The abstraction layer between domain logic and the database. The repository interface is defined inside the domain module; its implementation uses **Prisma Client** (ADR-031). The Supabase client is used separately for Realtime and Storage.

**Pattern used:**

```
[Interface — defined in the domain]
IPostRepository
  ├── findById(id: PostId): Promise<Post | null>
  ├── findByWorkspace(workspaceId: WorkspaceId, filter): Promise<Post[]>
  ├── save(post: Post): Promise<void>
  └── delete(id: PostId): Promise<void>

[Implementation — uses Prisma Client]
PrismaPostRepository implements IPostRepository
```

**One repository per Aggregate Root:**

| Aggregate Root | Repository Interface |
|----------------|---------------------|
| `Post` | `IPostRepository` |
| `Workspace` | `IWorkspaceRepository` |
| `Member` | `IMemberRepository` |
| `ConnectedAccount` | `IConnectedAccountRepository` |
| `McpGrant` | `IMcpGrantRepository` (atomic revocation through the `IMcpGrantRevocationPort` port) |
| `McpAuditLog` (entity, BC-04) | `IMcpAuditRepository` |
| `InboxItem` | `IInboxItemRepository` |
| `PostMetrics` | `IPostMetricsRepository` |
| `WorkspaceSnapshot` | `IWorkspaceSnapshotRepository` |
| `StartPage` | `IStartPageRepository` |
| `MediaItem` | `IMediaItemRepository` |
| `Notification` | `INotificationRepository` |

**Rules:**
- A repository interface may only be known to the Application Service of the same domain.
- The repository implementation may use Prisma Client directly (not Supabase JS for CRUD).
- The repository is responsible for the mapping between a database row and a domain entity.

---

# Next.js Entry Point Patterns

## Server Components — Data Fetching

Used for all **read** operations needed to render a page.

```
Page Component (Server)
  └── calls ApplicationService.findXxx(...)
       └── calls Repository.findXxx(...)
            └── Prisma Client query
```

**When used:**
- Load the post list for the Calendar page.
- Load the analytics snapshot for the Analytics page.
- Load workspace profile data.
- Load the media library.

**Rules:**
- A Server Component must not hold state or receive events from the browser.
- Data fetching in a Server Component does not go through `fetch()` to an internal endpoint — call the Application Service directly.

---

## Server Actions — UI Mutations

Used for all **write** operations triggered from user interaction in the UI.

```
Client Component (triggers action)
  └── calls Server Action
       └── calls ApplicationService.doXxx(...)
            ├── authorization check
            ├── domain logic
            └── Repository.save(...)
```

**When used:**
- Creating or editing a draft post.
- Scheduling or cancelling a post.
- Managing workspace members (invite, remove, change role).
- Replying in the engagement inbox.
- Revoking an AI client connection (`revokeGrant`).
- Uploading media.

**Rules:**
- A Server Action must validate the input format before calling the service (use schema validation — the library is decided in Engineering Planning).
- A Server Action is responsible for catching domain errors and returning a structured error response to the client.
- A Server Action must not bypass authorization — authorization is done in the Application Service.

---

## Route Handlers — External & API

Used for requests from **external systems** or needs that Server Actions cannot serve.

```
External System / Browser Fetch
  └── Route Handler (apps/web/app/api/...)
       └── calls ApplicationService.handleXxx(...)
            └── ...
```

**When used:**
- Official Outstand webhooks (`post.published`, `post.error`, `account.token_expired`).
- Health check endpoint.
- File download endpoint (if needed).
- **Mobile-ready API** (`/api/v1/...`, ADR-043) — a versioned REST/JSON contract for mobile clients, covered in the section "Route Handler v1 — Mobile Client" below.

**Rules:**
- The webhook Route Handler reads the raw body, validates HMAC over those bytes, then calls the ingestion Application Service to persist an idempotent receipt and enqueue JOB-01 before ACK `2xx`.
- A Route Handler must not access the database directly — including the webhook receipt; it must go through the system's Application Service/repository.
- A Route Handler is not a replacement for Server Actions for mutations from the UI.

---

## Route Handler v1 — Mobile Client (ADR-043)

The Next.js App Router remains the only API runtime — **there is no separate
backend** (Hono, etc.) to serve mobile clients. Mobile is exposed through
versioned Route Handlers that call the same Application Services used by
Server Actions for the web.

```
Mobile App (iOS/Android)
  └── Authorization: Bearer <token>
       └── Route Handler (apps/web/app/api/v1/...)
            └── calls ApplicationService.xxx(...) — same as the Server Action
                 └── ...
```

**Why not Server Actions for mobile:** Server Actions are Next.js's internal
RPC mechanism — the action ID changes with every build/deploy and they are not designed
to be called from outside the Next.js application. Mobile clients must go through a stable
REST/JSON contract (Route Handler), not a Server Action.

**Additional rules specific to `/api/v1`:**
- **Auth**: the Better Auth Bearer plugin (`Authorization: Bearer <token>`)
  replaces the cookie session — see `auth-strategy.md` for configuration.
  One Better Auth instance, one session table shared with the web (AS-D02 does not
  change).
- **Workspace context**: because there is no "active workspace" cookie like the web
  Middleware, `workspaceId` must be explicit in the path or header of every
  request (e.g. `/api/v1/workspaces/:workspaceId/...`). The Route Handler still
  calls the Application Service for granular authorization checks — there is
  no mobile-specific authorization shortcut.
- **Versioning**: a breaking change must bump to `/api/v2`; the `/api/v1` contract
  already used by the mobile app must not be changed in a breaking way.
- **Domain priority exposed** (following `future-roadmap.md` — "Mobile
  Publishing, Mobile Inbox"): `WorkspaceService` → `PublishingService` →
  `EngagementService` → `NotificationService`.
- **Timing**: the foundation (the `/api/v1` schema, Bearer configuration) is prepared
  ahead of M8, the actual mobile endpoints are implemented after the web MVP
  is finished (not part of the MVP — `mvp-definition.md`, `product-scope.md`).

---

## Middleware — Auth Guard & Workspace Context

Middleware runs before every request to a dashboard page. Its responsibilities:

1. Verify the active session via Better Auth.
2. Extract `userId` from the session.
3. Resolve the active `workspaceId` from the URL or cookie.
4. Redirect to the login page if the session is invalid.
5. Redirect to the workspace selector if the workspace is not found.

**Note:** Middleware does not call the Application Service — it only performs session verification and context resolution. Granular authorization (role-based permission) is done in the Application Service.

---

# Cross-Domain Communication

When one domain needs data or triggers an operation in another domain, the mechanism is a **direct service-to-service call**.

## Service-to-Service Call Rules

1. **Import only from a module's public API** — each domain exposes `index.ts` as the only entry point. Importing from another domain's internal files is not allowed.
2. **No circular dependency** — if BC-A calls BC-B, then BC-B must not call BC-A.
3. **Pass only IDs, not entities** — when calling another domain's service, send IDs (WorkspaceId, UserId, etc.) not a full entity object across domains.

## Inter-Domain Dependency Map

```
BC-01 Identity
    ↑ (consumed by all BCs via UserId)

BC-02 Workspace
    ↑ (consumed by BC-03, BC-04, BC-05, BC-06, BC-07, BC-08, BC-09)

BC-03 Publishing ──→ BC-02 Workspace (verify ConnectedAccount)
                ──→ BC-08 Media (attach MediaItem to a post)
                ──→ BC-06 Analytics (post metrics per target account, via PostMetricsPort — KI-064)

BC-04 MCP Access ──→ BC-02 Workspace (verify active member per call)
                 (MCP tools are entry points that call the BC-02/03/05/06/08 services; BC-04 itself only holds grants, audit, rate limit)

BC-05 Engagement ──→ BC-02 Workspace (filter per ConnectedAccount)

BC-06 Analytics ──→ BC-02 Workspace (filter per ConnectedAccount)

BC-07 Start Page ──→ BC-02 Workspace (bound to the workspace)

BC-08 Media ──→ BC-02 Workspace (all media bound to the workspace)

BC-09 Notification ──→ all BCs (consumed by other BCs to send notifications)
```

**Forbidden dependencies (circular):**
- BC-02 must not call BC-03, BC-04, BC-05, BC-06, BC-07, BC-08
- `McpAccessService` (BC-04) must not call BC-03/05/06/08. Calling domain services is done by the MCP tool handler (entry point), not by `McpAccessService`.
- BC-08 must not call BC-03

---

# Error Handling Strategy

## Error Hierarchy

```
ApplicationError (base)
├── AuthorizationError      — user does not have permission
├── NotFoundError           — resource not found
├── ValidationError         — input invalid / domain rule violated
├── ConflictError           — operation conflicts with the existing state
└── ExternalServiceError    — error from the Outstand API or an external service
```

## Error Flow

```
Application Service
  └── throws a domain error (AuthorizationError, ValidationError, etc.)
       └── caught at the Entry Point
            ├── Server Action → returned as a structured error response to the client
            ├── Route Handler → returned as a JSON error response with the matching HTTP status
            └── Server Component → rendered as a page error state
```

**Mapping domain errors to HTTP status (Route Handlers):**

| Domain Error | HTTP Status |
|-------------|------------|
| `AuthorizationError` | 403 Forbidden |
| `NotFoundError` | 404 Not Found |
| `ValidationError` | 422 Unprocessable Entity |
| `ConflictError` | 409 Conflict |
| `ExternalServiceError` | 502 Bad Gateway |

**Note:** Error handling details (error class implementation, logging, monitoring) are determined in Engineering Planning.

---

# Request Flow — Operation Examples

## Example 1: Schedule a Post (Happy Path)

```
User clicks "Schedule" in the UI
  │
  ├─ [Client Component] calls the Server Action schedulePost(postId, scheduledAt)
  │
  ├─ [Server Action]
  │    ├─ Validate the input format (postId is a valid UUID, scheduledAt is an ISO date)
  │    └─ Call PublishingService.schedulePost(userId, postId, scheduledAt)
  │
  ├─ [PublishingService]
  │    ├─ Get the Post via IPostRepository.findById(postId)
  │    ├─ Verify userId is a member of this post's workspace (WorkspaceService.getMember)
  │    ├─ Verify the member role >= Creator (domain rule — all roles can, ADR-074)
  │    ├─ Run the domain rule: scheduledAt must not be in the past
  │    ├─ Run the domain rule: the post must have at least one PublishingTarget
  │    ├─ Update Post.status = "scheduled", Post.scheduledAt = scheduledAt
  │    └─ Save via IPostRepository.save(post)
  │
  └─ [Server Action] Return { success: true } to the Client Component
```

## Example 2: Outstand Webhook — Post Published

```
Outstand API sends POST /api/webhooks/outstand
  │
  ├─ [Route Handler]
  │    ├─ Read raw body + validate HMAC
  │    ├─ Call WebhookIngestionService.persistReceipt(rawBody, headers)
  │    └─ ACK 2xx after the receipt is durable + JOB-01 is scheduled
  │
  ├─ [JOB-01 / WebhookProcessor]
  │    ├─ Load the idempotent receipt
  │    ├─ The ACL translates the vendor event into a domain command
  │    └─ PublishingService.markPostPublished(...)
  │
  └─ [PublishingService]
       ├─ Find the Post via outstandPostId (amendment to ADR-092, renamed from outstandJobId — post-level, covers all targets)
       ├─ Call OutstandAdapter.fetchPostOutcome(outstandPostId) to resolve the status per PostTarget
       ├─ Update status "published"
       └─ NotificationService.notify(..., { type: "post_published" })
```

## Example 3: Load the Calendar Page

```
User navigates to /publish/calendar  ← Calendar; /publish itself permanently redirects here (ADR-046 Final Amendment, permanent exception). The route group `(app)` does not appear in the URL — only a wrapper folder name in `src/app/`
  │
  ├─ [Middleware]
  │    ├─ Verify the session (Better Auth)
  │    └─ Resolve workspaceId from the active-workspace-id cookie (`auth-architecture.md`)
  │
  ├─ [Server Component CalendarPage]
  │    └─ Call PublishingService.getScheduledPosts(workspaceId, dateRange)
  │
  ├─ [PublishingService]
  │    └─ Call IPostRepository.findByWorkspace(workspaceId, { status: "scheduled", dateRange })
  │
  └─ [Server Component] Render the calendar with the post data
```

---

# Application Service Contracts

Below are the high-level contracts (architectural method signatures) per service. Parameter and return type details are determined in Engineering Planning.

## WorkspaceService

| Method | Trigger | Notes |
|--------|---------|-----------|
| `createWorkspace` | Server Action | Create a new workspace, automatically add the Owner |
| `getWorkspace` | Server Component | Load workspace data + brand settings |
| `updateWorkspace` | Server Action | Update the name, `slug` (internal unique identifier, not used in routing/URL — `domain-model.md`), or brand settings |
| `switchWorkspace` | Server Action | Deliberately move the user's active workspace — re-validate that the user is a member of the target workspace, set the `active-workspace-id` cookie to the target workspace, redirect Home. Called from Settings → Account → Workspaces (ADR-088) after the user confirms through the Tier 2 dialog (ADR-089), different from the `/onboarding` recovery flow when the cookie is lost (`auth-architecture.md`) |
| `inviteMember` | Server Action | Send an invitation to an email |
| `acceptInvite` | Server Action | Accept the invitation, activate the membership |
| `removeMember` | Server Action | Remove a member from the workspace — a Tier 2 confirmation dialog is mandatory before execution (ADR-049) |
| `updateMemberRole` | Server Action | Change a member's role — a Tier 2 confirmation dialog is mandatory before execution (ADR-049) |
| `getMember` | Internal (called by other services) | Get member data + role for the auth check |
| `connectAccount` | Server Action | Connect a social media account via Outstand |
| `disconnectAccount` | Server Action | Disconnect a social media account — Disconnect Confirmation is mandatory (KSP-08-F07, ADR-048) |
| `transferOwnership` | Server Action | The Owner triggers an ownership transfer to another Admin — set `pendingOwnerTransferTo`, send a notification (`ownership_transfer_requested`); does **not** swap roles immediately. RBAC: Owner only, the target must be an active Admin. A Tier 1 confirmation (type the workspace name, ADR-049) is mandatory before triggering (ADR-050) |
| `acceptOwnershipTransfer` | Server Action | The target Admin accepts the transfer — the old Owner's role and the target Admin's role are swapped in a single transaction, `pendingOwnerTransferTo` is cleared, a notification (`ownership_transfer_resolved`) goes to the old Owner. RBAC: only the user who is the target of `pendingOwnerTransferTo` (ADR-050) |
| `deleteWorkspace` | Server Action | Delete the workspace along with all related data — cascade follows `ON DELETE CASCADE` per `workspace_id` (`database-strategy.md`). RBAC: Owner only. A Tier 1 confirmation (type the workspace name, ADR-049) is mandatory before execution (ADR-050) |

## PublishingService

| Method | Trigger | Notes |
|--------|---------|-----------|
| `createDraft` | Server Action | Create a new draft post |
| `updateDraft` | Server Action | Edit draft content (caption, media, targets, `contentFormat`, `platformOptions`) |
| `schedulePosts` | Server Action | Schedule one or more posts — must validate the `ContentFormat` matrix per target (ADR-039) before calling Outstand |
| `cancelSchedule` | Server Action | Cancel the schedule, return to draft — a Tier 2 confirmation dialog is mandatory before execution, symmetric with the Schedule confirmation (ADR-049) |
| `publishNow` | Server Action | Publish immediately without a schedule (KSP-05-F12, ADR-047) — same RBAC as `schedulePosts` (all roles: Account Owner/Admin/Creator, since ADR-074); validation of the `ContentFormat` matrix per target (ADR-039) is still mandatory before calling Outstand |
| `deletePost` | Server Action | Soft delete a post — a Tier 2 confirmation dialog is mandatory before execution (ADR-049), even though it is a soft delete in the DB (DB-D03) |
| `getScheduledPosts` | Server Component | Load posts for the Calendar view |
| `getDraftPosts` | Server Component | Load posts for the Draft list |
| `applyTargetOutcomes` | JOB-01 internal | After `post.published`/`post.error`, read the Outstand outcome per account then update each `PostTarget` independently; the internal notification may be `post_published`/`post_failed` |
| `listQueue` | Server Component | Load the Queue list (KSP-03) — `Post`/`PostTarget` with status `Scheduled`, grouped by date, ordered purely ascending by `scheduledAt`. Not a separate `QueueSlot` entity, no manual reorder (amendment to ADR-083) |

## McpAccessService

MCP tools (ADR-138) are the entry point Route Handler `/api/mcp` that calls other BC services; this table only contains services owned by BC-04.

| Method | Trigger | Notes |
|--------|---------|-----------|
| `createGrant` | OAuth approval (hook point decided in T-149.2) | Create a grant for one workspace and the chosen scopes, or update the `scopes` of an existing active grant (one active grant per user, client, workspace); RBAC: active workspace member |
| `revokeGrant` | Server Action (Settings) | Revoke an AI client connection; a single transaction, see § Authorization and revocation rules |
| `listGrants` | Server Component (Settings) | List of active grants owned by the currently logged-in user (across workspaces) |
| `authorizeCall` | Internal (MCP Route Handler) | Validate grant, scope, and member per call, then rate limit (T-154); see § Authorization and revocation rules |
| `recordAudit` | Internal (MCP Route Handler) | Write one `McpAuditLog` row per call |
| `purgeAudit` | Cron (JOB-08) | Delete audit entries older than 90 days |

### Authorization and revocation rules (T-149.1, ADR-139 point 4)

The OAuth access token is a stateless JWT: it is still accepted until it expires (1 hour) even though the consent and refresh token have been deleted (proven in the T-148 spike). Therefore the token alone is never enough. **`mcp_grants` is the authorization source** (King Rezi's decision 2026-10-26); the plugin-owned `identity_oauth_consent` and `identity_oauth_refresh_token` rows are only OAuth mechanics.

`authorizeCall` checks every call, in this order, and rejects (fail closed, with a clear error, not empty data) on the first failure:

1. The token is valid (signature, `iss`, `aud`, expiry); done by `mcpHandler`, before the service is called.
2. An active grant exists for (token `sub`, token `azp`, token `workspace_id`) with `revoked_at` empty. Without a grant: rejected.
3. The scope required by the tool is covered by the token scope **and** the grant scope in the DB. The scope in the token must not exceed the grant; revoking or narrowing a grant takes effect immediately without waiting for a new token.
4. The user is still an active member of that workspace. In the MVP there is no scope restriction based on role (Account Owner, Admin, Creator are equal for read, draft, and schedule; ADR-139 point 4, S-001). A removed member is rejected, their grant is not deleted automatically.
5. The rate limit hook point (filled in by T-154). `last_used_at` is updated only after the call passes, at most once per minute.

A rejected call is still recorded through `recordAudit` (`status = denied`).

`revokeGrant` runs **a single transaction**: it marks `mcp_grants.revoked_at` and deletes the `identity_oauth_consent` and `identity_oauth_refresh_token` rows belonging to that grant's (client, user, workspace) (plugin `referenceId` = `workspace_id`). The transaction is run by an adapter in the repository layer through a port called by the service; the domain does not import Prisma. The plugin tables are not changed in shape and not given new FKs. Revoking an already-revoked grant does not error (idempotent). An access token that is still valid is rejected on the next call by rule 2, not by expiry.

The mapping of MCP tools to the services they wrap (method names were matched against the domain barrel in T-150.1; a tool handler is an entry point, so these cross-BC calls are legitimate per the dependency map above):

| Scope | Tool | Service called (public API of the domain barrel) |
|-------|------|---------------------------------------------------|
| `read` | `get_workspace` | `WorkspaceService.getWorkspaceById` (name); scope from `McpAuthorizedCall.grantScopes` |
| `read` | `list_accounts` | `WorkspaceService.listConnectedAccounts`; content formats per platform from `getAllowedContentFormats` (`publishing` barrel, pure function ADR-039) |
| `read` | `list_media` | `MediaService.listMediaItems` |
| `read` | `list_drafts` | `PublishingService.listDrafts` |
| `read` | `list_scheduled_posts` | `PublishingService.listQueue` (groups per date flattened) |
| `read` | `list_published_posts` | `PublishingService.listHistory` with `statuses = [Published, Imported]` |
| `read` | `get_analytics` (workspace) | `AnalyticsService.getDashboardSummary` |
| `read` | `get_analytics` (single post) | `PublishingService.getHistoryById` (`metrics` field per account; `authorName` is not used) |
| `read` | `list_comments` | `EngagementService.listInbox` |
| `draft` | `create_draft` | `ComposeDraftUseCase` (`publishing` domain; creates a draft with the source marker `created_via = 'mcp'` and `created_via_client_id` from the grant; T-152) |
| `draft` | `update_draft` | `ComposeDraftUseCase` (only drafts with status Draft; does not change the source marker; T-152) |
| `draft` | `upload_media` | `MediaService.uploadMedia` (download from a URL with SSRF protection) |
| `schedule` | `schedule_posts` | `ScheduleContentsUseCase` (`publishing` domain; checks all content first, reserves the quota once, then creates MCP-marked drafts and schedules them one by one; result per content; T-153) |

All the services above receive `workspaceId` and `userId` from the grant that passed `authorizeCall` (not from tool arguments), so workspace isolation and per-user RLS (KI-026) still apply as in the UI. Tools have no `workspaceId` parameter.

### Draft tools and rate limit (T-152, T-154; ADR-152 Accepted)

**`create_draft` and `update_draft`** (scope `draft`). Caption maximum 5000 characters and media maximum 10 per draft. `update_draft` is only for drafts with status Draft; a Scheduled post is rejected with `conflict` ("Batalkan jadwal di aplikasi dulu") and the source marker does not change. `platformOptions` (e.g. a Pinterest board) cannot be set through MCP. `list_drafts` does not yet return the source marker.

**Rate limit per workspace.** `McpAccessService.consumeQuota(workspaceId, quota, amount)` uses a Postgres fixed window (table `mcp_rate_limit_windows`, `database-strategy.md` BC-04): `calls` per minute, `write_actions` per hour, `scheduled_contents` per day; default limits 60, 30, and 50, changeable via env. A rejection is returned as a `rate_limited` error in the tool result with `retryAfterSeconds`, `quota`, and `limit`, not an HTTP `Retry-After` header (the HTTP response is always 200 for JSON-RPC). Fail-closed if the counter fails. Usage by the `schedule_posts` tool is set in T-153.

### Read tool output contract (T-150.1)

Applies to the eight `read` tools. The handler only maps the service record to the shape below; no business logic.

**Result wrapper.** One `text` block containing JSON. Rejections and failures use `isError: true` with a `text` block containing `{"error":{"code","message"}}`, never an empty list. `code`: `no_active_grant`, `token_scope_insufficient`, `grant_scope_insufficient`, `not_workspace_member` (`McpDenialReason`), `invalid_input` (also for `ValidationError` and `PublishingDomainError` from the service), `invalid_cursor`, `not_found`, `conflict` (write tools, e.g. `update_draft` on an already scheduled post), `rate_limited` (per-workspace quota exhausted; ADR-152, see below), `internal_error` (generic message; details only in the server log). Additional code `not_permitted` (T-252, ADR-138, ADR-074): an `AuthorizationError` from the domain thrown by any tool handler (currently only `schedule_posts`) is mapped to this code with the audit status `denied`, not `internal_error`; the role comes from the membership re-read by `McpAccessService.authorizeCall` on every call (`McpToolContext.actorRole`), never from tool arguments.

**Time.** All dates and times are ISO 8601 strings with the zone offset of the connection owner's `User.timeZone`, e.g. `2026-10-28T14:30:00+07:00` for WIB or `+08:00` for WITA (T-168, ADR-146); an invalid zone falls back to WIB. Schedule input without an offset is interpreted in that zone, with a given offset used as is. A date without a value is given `null`. Tools do not accept time input on the read tools.

**IDs.** Strings as-is from the domain. There are no `outstand*` ids, `storagePath`, signed URLs, or `slug` in the output.

**Paginated lists.** `list_media`, `list_drafts`, `list_scheduled_posts`, `list_published_posts`, `list_comments` return `{ "items": [...], "nextCursor": string | null }`, 20 items per page (fixed, no `limit` parameter), and accept an optional `cursor`. The cursor is opaque (base64url `{v, offset, filter}`); a broken cursor, or one created for a different filter, is rejected with `invalid_cursor`. **Known limit:** other BCs' services do not yet have pagination (the repository returns the full list), so the handler truncates the list in memory. The order follows the service: media newest first, drafts most recently edited first, schedule ascending by `scheduledAt`, published descending by publish time, comments newest first. Pages can shift if data changes between two calls. Pagination in other BCs' repositories is a separate ticket if volume demands it. `list_accounts` and `get_workspace` are not paginated.

| Tool | Arguments | Result shape |
|------|---------|--------------|
| `get_workspace` | none | `{ workspaceId, name, grantedScopes: ("read"\|"draft"\|"schedule")[], timezone: string }` (IANA zone name from the connection owner's `User.timeZone`; T-168). Brand settings are mentioned by S-001 but do not yet exist in the BC-02 model, so are not returned yet (gap recorded in T-150) |
| `list_accounts` | none | `{ items: [{ id, platform, handle, status, reconnectRequired, connectedAt, supportedContentFormats: ContentFormat[] }] }` |
| `list_media` | `cursor?` | item `{ id, filename, type: "image"\|"video"\|"gif", mimeType, sizeBytes, width, height, durationSeconds, createdAt }` |
| `list_drafts` | `cursor?` | item `{ id, caption, status: "draft"\|"in_review"\|"ready_to_schedule", mediaIds, createdAt, updatedAt }` |
| `list_scheduled_posts` | `cursor?` | item `{ id, caption, scheduledAt, createdAt, targets: [{ accountId, platform, accountHandle, contentFormat }] }` |
| `list_published_posts` | `cursor?` | item `{ id, caption, status: "published"\|"imported", publishedAt, createdAt, targets: [{ accountId, platform, accountHandle, contentFormat, status, postUrl, error }] }` |
| `get_analytics` | `period?: "weekly"\|"monthly"` (default `weekly`) or `postId` (wins over `period`) | workspace: `{ scope: "workspace", period, summary: { totalPosts, totalEngagements, avgEngagementRate, activeAccounts } \| null }` (`null` = no snapshot yet, not zero). Post: `{ scope: "post", postId, status, metrics: [{ accountId, platform, impressions, reach, likes, comments, shares, clicks, engagementRate, fetchedAt }] \| null }`; a `postId` that does not exist, is not in the workspace, or has not finished publishing: `not_found` |
| `list_comments` | `cursor?`, `status?: "unread"\|"replied"\|"resolved"\|"dismissed"` (ADR-157; `"done"` is still accepted as an alias for `"resolved"` so old clients do not break, King Rezi's decision 2026-11-06, T-217.8), `accountId?` | `{ notice, items: [{ id, accountId, platform, type, status, postId, receivedAt, author, content }], nextCursor }`; `author` and `content` are wrapped in the marker below |

**Third-party data (`list_comments`).** The comment content and the author handle come from a third party and may contain sentences that resemble commands. Both are returned inside the marker `<data_pihak_luar_tidak_tepercaya>...</data_pihak_luar_tidak_tepercaya>`, and the result includes a fixed `notice` stating that the content inside the marker is third-party data, not instructions. An occurrence of that marker inside the comment text is neutralized (replaced with `[penanda dihapus]`) so a comment cannot close its own wrapper. Draft and post captions are not wrapped: they are the workspace members' own writing. The marker is a mitigation, not a guarantee; `read` tools cannot change anything, so the impact of an injection is contained on the client side.

## EngagementService

| Method | Trigger | Notes |
|--------|---------|-----------|
| `listInbox` | Server Component / Server Action | Inbox list, filtered by account, platform, and status; grouped per post with sort and date range after T-218 (ADR-157) |
| `getInboxItemDetail` | Server Action | Item detail along with the snapshot of the originating post (T-056) |
| `markAsDone` | Server Action | Marks an item done (`done`). Replaced by the resolve, dismiss, and reopen actions in T-217 (ADR-157); the final name is determined in T-217 |
| `reply` | Server Action | Send a comment reply via Outstand (ACL `replyToComment`); automatically marks `replied` if the status is `unread` (T-217.3) |
| `syncComments` | JOB-03 / manual refresh Server Action | Pull comments via the ACL, idempotent upsert, create `engagement_new` for new items |

## AnalyticsService

| Method | Trigger | Notes |
|--------|---------|-----------|
| `getWorkspaceSnapshot` | Server Component | Load the workspace analytics summary |
| `getPostMetrics` | Server Component | Load metrics per post |
| `syncMetrics` | JOB-04 | Pull metric updates from Outstand |

## MediaService

| Method | Trigger | Notes |
|--------|---------|-----------|
| `uploadMedia` | Server Action | Upload a file to Supabase Storage + save metadata |
| `createOutstandWorkingCopy` | Internal Publishing flow | Request upload URL → PUT → confirm; return the Outstand URL for publishing |
| `getMediaLibrary` | Server Component | Load the workspace media list |
| `deleteMedia` | Server Action | Delete the file and metadata — a Tier 2 confirmation dialog is mandatory before execution (ADR-049); hard delete, no `deleted_at` |

## NotificationService

| Method | Trigger | Notes |
|--------|---------|-----------|
| `notify` | Internal (called by other services) | Create a new notification |
| `getNotifications` | Server Component | Load the user's notifications within the workspace |
| `markAllRead` | Server Action | Mark all notifications as read |

## StartPageService

| Method | Trigger | Notes |
|--------|---------|-----------|
| `getStartPage` | Server Component | Load the workspace start page |
| `updateStartPage` | Server Action | Update the start page content and settings |
| `addLink` | Server Action | Add a link to the start page |
| `removeLink` | Server Action | Remove a link from the start page |
| `reorderLinks` | Server Action | Change the link order |

---

# MVP Notes

For the MVP, not every service method above is implemented. Implementation priority refers to `product-discovery/02-product/mvp-definition.md`. This Application Layer defines the system's full contract — Engineering Planning will set the subset that goes into the MVP.

---

# Decision Log

| ID | Decision | Reason | Alternatives |
|----|-----------|--------|-----------|
| AL-D01 | Server Actions for UI mutations, Route Handlers for external/webhook | Clear separation of concerns; Server Actions are optimal for form-based UI, Route Handlers are optimal for external integration | Route Handlers only (loses progressive enhancement); Server Actions only (cannot handle webhooks) |
| AL-D02 | Explicit Repository Pattern — interface in the domain, implementation via Prisma Client (ADR-031) | Aligned with DDD; type-safe persistence; test domain logic without a database; clear dependency boundary | Direct Prisma/Supabase access in the service (high coupling, hard to test); Supabase client for CRUD (superseded by ADR-031) |
| AL-D03 | Service-to-service call via the module public API (`index.ts`) | Simple for a solo-developer MVP; needs no event bus; dependencies are explicit and easy to trace | Domain Events (more decoupled but high complexity for the MVP); Shared Read Model (direct DB queries across contexts — violates the boundary) |
| AL-D04 | 4-layer stack: Entry Points → Application Service → Domain Logic → Repository | Aligned with Modular Monolith + DDD; each layer has a clear responsibility; testable per layer | 2-layer (Entry Point + DB) — too flat, not scalable; full CQRS — too complex for the MVP |
| AL-D05 | The webhook Route Handler only verifies raw HMAC → durable receipt → enqueue → ACK | Guarantees events are not lost and keeps the entry point thin |
| AL-D06 | Engagement sync through JOB-03/manual refresh; not a webhook Route Handler | The official Outstand contract does not provide an MVP Engagement webhook |
| AL-D07 | ADR-040 | AL-D05–D06 amend the old examples and service contracts |
| AL-D08 | The `/api/v1` Route Handler as a mobile-ready API on top of the same Application Service as the web; no separate BE | Server Actions are not stable across builds for external clients; the Application Service is already framework-agnostic (AL-D02) so a mobile entry point is cheap to add (ADR-043) | Separate backend (Hono/Express) — duplicated business logic; mobile calling Server Actions directly — unstable/unsupported |

---

# Related Documents

* `domain-model.md` — bounded contexts and entities consumed by this Application Layer
* `database-strategy.md` — database tables accessed by the repositories
* `integration-layer.md` — the Outstand API called from Route Handlers and Application Services
* `background-jobs.md` — background jobs that also access Application Services
* `realtime-strategy.md` — notifications triggered via NotificationService
* `auth-architecture.md` — Better Auth and granular authorization in the Application Service
* `../02-product/mvp-definition.md` — MVP scope that determines which methods are implemented
* `../02-product/roles-permissions.md` — roles and permissions that are the authorization constraint
* `../../project-os/DECISIONS.md` — ADR-001 through ADR-015, AL-D01 through AL-D04, ADR-043 (AL-D08)
* `../06-engineering/auth-strategy.md` — Better Auth Bearer plugin, mobile auth configuration (AS-D06)
