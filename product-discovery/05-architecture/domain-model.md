# Domain Model & Bounded Context

This document defines the **Domain Model** and **Bounded Contexts** for the **Postific** product.

The Domain Model is the conceptual representation of the system — it defines what exists in the system, how those domains are divided, and how they interact without depending on each other's implementation.

This document is the foundation of all subsequent architecture documents and serves as the canonical naming reference for all entities in the Database Strategy, Application Layer, and Engineering Planning.

---

# Purpose

* Set the Bounded Contexts that reflect the product modules from the Product Baseline.
* Define the Core Entities and main aggregates per bounded context.
* Map the relations between bounded contexts through the Context Map.
* Set the Shared Types used across contexts via `packages/shared`.
* Document the domain boundary rules that every implementation must follow.

---

# Domain Overview

## Bounded Context Classification

| ID | Bounded Context | Classification | MVP Scope |
|----|----------------|-------------|-----------|
| BC-01 | Identity | Core Domain | ✅ MVP |
| BC-02 | Workspace | Core Domain | ✅ MVP |
| BC-03 | Publishing | Core Domain | ✅ MVP |
| BC-04 | MCP Access | Supporting Domain | ✅ MVP (ADR-138) |
| BC-05 | Engagement | Core Domain | ✅ MVP |
| BC-06 | Analytics | Core Domain | ✅ MVP |
| BC-07 | Start Page | Core Domain | ✅ MVP |
| BC-08 | Media | Supporting Domain | ✅ MVP |
| BC-09 | Notification | Supporting Domain | ✅ MVP |
| BC-10 | Billing | Supporting Domain | Post-MVP |

**Classification:**
- **Core Domain** — a bounded context that represents the product's core business value.
- **Supporting Domain** — a bounded context that supports the operations of the core domain but is not the main differentiator.

## Bounded Context Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CORE DOMAINS                                           │
│                                                                           │
│  ┌─────────────┐   ┌──────────────────────────────────────────────────┐  │
│  │             │   │  BC-03 Publishing                                 │  │
│  │ BC-01       │   │  ┌─────────┐        ┌──────────────────────────┐ │  │
│  │ Identity    │   │  │  Post   │        │ Publishing               │ │  │
│  │             │   │  │ Draft   │        │ Target                   │ │  │
│  │ User        │   │  │ Schedule│        │ (per account)            │ │  │
│  │ Session     │   │  │ Publish │        └──────────────────────────┘ │  │
│  │             │   │  └─────────┘                                     │  │
│  └──────┬──────┘   └──────────────────────┬───────────────────────────┘  │
│         │                                  │                               │
│  ┌──────▼──────────────────────────────────▼────────────────────────┐    │
│  │  BC-02 Workspace                                                   │    │
│  │  Workspace · Member · ConnectedAccount · BrandSettings             │    │
│  └─────────────────────────────────────────────────────────────────-─┘    │
│             │                       │                       │            │
│  ┌──────────▼─────────┐  ┌──────────▼─────────┐  ┌──────────▼─────────┐  │
│  │ BC-05 Engagement   │  │ BC-06 Analytics    │  │ BC-07 Start Page   │  │
│  │ InboxItem          │  │ Metrics            │  │ StartPage          │  │
│  │ Reply              │  │ Snapshot           │  │ PageLink           │  │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                    SUPPORTING DOMAINS                                     │
│                                                                           │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────┐  ┌──────────────┐ │
│  │ BC-04 MCP  │  │ BC-08 Media│  │ BC-09 Notification│  │ BC-10 Billing│ │
│  │ Access     │  │ MediaItem  │  │ Notification      │  │ Subscription │ │
│  │ McpGrant   │  │            │  │                   │  │ Invoice      │ │
│  │ McpAuditLog│  │            │  │                   │  │              │ │
│  └────────────┘  └────────────┘  └───────────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEM                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Outstand API — Social Media Integration Provider                 │    │
│  │  (Anti-Corruption Layer is defined in integration-layer.md)       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

# Bounded Contexts

---

## BC-01 — Identity

### Responsibility

Manages user identity, authentication, and sessions. Identity is the entry point of the system — every interaction starts from verifying the user's identity.

Identity is managed through **Better Auth** (pre-architecture decision). The internal implementation is not built from scratch.

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `User` | Aggregate Root | A user registered on the platform |
| `Session` | Entity | The user's active session (managed by Better Auth) |
| `OAuthAccount` | Entity | An OAuth account linked to a User (Better Auth managed) |

### Key Attributes

**User**
- `id: UserId` — unique identifier, consumed by all other bounded contexts
- `email: string` — unique email address
- `name: string` — display name
- `avatarUrl: string?` — user avatar
- `createdAt: Date`

**Session** and **OAuthAccount** are managed entirely by Better Auth — there is no custom domain logic.

### Notes

- `UserId` is the only Identity data consumed by other domains, always through `packages/shared`.
- Other domains **must not** import the Identity implementation to fetch User data — use `UserId` as a reference and query User separately if needed.

---

## BC-02 — Workspace

### Responsibility

Manages the organizational structure that uses the platform: workspaces, team membership, roles & permissions, connected social media accounts, and brand settings.

Workspace is the **root context** — all other domain data is bound to `WorkspaceId`. RLS at the database level uses `workspace_id` as the isolation boundary (pre-architecture decision).

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `Workspace` | Aggregate Root | The organizational unit of platform users |
| `Member` | Entity | A workspace member with a given role |
| `ConnectedAccount` | Entity | A social media account connected to the workspace |
| `BrandSettings` | Value Object | Workspace brand settings |

### Key Attributes

**Workspace**
- `id: WorkspaceId`
- `name: string`
- `slug: string` — internal unique identifier, not used in routing/URL (a human-readable reference in logs/debugging/support; workspace context in routing uses a cookie, see `auth-architecture.md`)
- `ownerId: UserId` — reference to the Identity BC
- `pendingOwnerTransferTo: UserId?` — filled when the Owner triggers `transferOwnership`; cleared again after the target accepts (`acceptOwnershipTransfer`) or the process is cancelled (ADR-050)
- `plan: WorkspacePlan` — `free | pro | (post-MVP: team)`
- `createdAt: Date`

**Member**
- `id: MemberId`
- `workspaceId: WorkspaceId`
- `userId: UserId` — reference to the Identity BC
- `role: MemberRole` — `owner | admin | creator` (ADR-074 — previously included `manager`)
- `invitedAt: Date`
- `joinedAt: Date?`
- `status: MemberStatus` — `pending | active | removed`

**ConnectedAccount**
- `id: ConnectedAccountId`
- `workspaceId: WorkspaceId`
- `platform: SocialPlatform` — `instagram | facebook | twitter | linkedin | tiktok | youtube | threads | pinterest`
- `outstandAccountId: string` — ID from the Outstand API (external reference)
- `handle: string` — account name (@handle or page name)
- `status: ConnectedAccountStatus` — `active | disconnected | error`
- `reconnectRequired: boolean` — `true` when the ACL maps `account.token_expired`
- `connectedAt: Date`

**BrandSettings** (Value Object, embedded in Workspace)
- `name: string?` — brand name
- `tone: string?` — tone of voice guidance
- `guidelines: string?` — brand guidelines notes

### Notes

- `ConnectedAccount` is the bridge between the internal domain and the Outstand API. `outstandAccountId` is an external reference that does not change after the connection.
- For Twitter/X, the Project Owner must configure the BYOK credentials manually in the Outstand dashboard. The application domain has no X Client ID/Client Secret attribute.
- `MemberRole` and `MemberStatus` are published to `packages/shared` so other domains can read the role without importing the Workspace implementation.

---

## BC-03 — Publishing

### Responsibility

Manages the entire content lifecycle — from draft creation, review, and scheduling to publication. Publishing is the **main core domain** that is the foundation of product-market fit (I-04: Publishing Trust).

Publishing is responsible for the canonical content statuses: `Draft → In Review → Ready to Schedule → Scheduled → Published / Failed`.

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `Post` | Aggregate Root | A unit of content that will be or has been published |
| `PostTarget` | Entity | A specific publication target per connected account |

### Key Attributes

**Post**
- `id: PostId`
- `workspaceId: WorkspaceId`
- `authorId: UserId` — reference to the Identity BC
- `status: ContentStatus` — canonical enum from `packages/shared`
- `caption: string`
- `mediaIds: MediaId[]` — reference to the Media BC (ID only)
- `targets: PostTarget[]` — list of publication targets
- `outstandPostId: string?` — **(amendment to ADR-092)** ONE post ID from the Outstand API, covering all `PostTarget`s of this post at once (1 `schedulePost`/`publishNow` call for all targets, not 1 job per target). Filled at the post level, not per `PostTarget`.
- `scheduledAt: Date?` — the desired publish time
- `publishedAt: Date?` — time it was successfully published
- `failedAt: Date?`
- `failureReason: string?`
- `createdAt: Date`
- `updatedAt: Date`

**PostTarget**
- `id: PostTargetId`
- `postId: PostId`
- `connectedAccountId: ConnectedAccountId` — reference to the Workspace BC
- `platform: SocialPlatform`
- `contentFormat: ContentFormat` — `post | reel | story | pin` (enum in `packages/shared`; ADR-039)
- `platformOptions: PlatformPublishOptions?` — platform-specific fields (e.g. Pinterest: title, destination link, board)
- `platformPostId: string?` — **(amendment to ADR-092)** the post ID on the ACTUAL platform (e.g. Instagram) — DIFFERENT from the post-level `outstandPostId` on `Post`. Filled async through `OutstandAdapter.fetchPostOutcome`/webhook (T-026), not synchronously from `schedulePost`/`publishNow`. Replaces the old `outstandJobId`.
- `status: PostTargetStatus` — `pending | scheduled | published | failed`
- `platformPostUrl: string?` — **(amendment to ADR-092)** the URL of the published post per account, filled async together with `platformPostId`. Replaces the old `publishedUrl`.
- `error: string?`

**ContentFormat per platform (MVP — ADR-039)**

The format is chosen **per `PostTarget`** (not one global format for the whole post), so multi-account can still have a different type per network.

| Platform | Formats allowed in the MVP | Default |
| -------- | ---------------------------- | ------- |
| Instagram | `post`, `reel`, `story` | `post` |
| Facebook | `post`, `reel`, `story` | `post` |
| TikTok | `post` (TikTok video/feed; no Reel/Story selector in the UI) | `post` |
| Pinterest | `pin` | `pin` |
| Twitter / X | `post` | `post` |
| LinkedIn | `post` | `post` |
| YouTube | `post` | `post` |
| Threads | `post` | `post` |

`platformOptions` (conceptual shape — stored as JSON in the DB, **not** a shared enum; contains no business logic):

```typescript
// Pinterest payload example (MVP)
type PlatformPublishOptions = {
  pinTitle?: string;
  destinationUrl?: string;
  boardId?: string;
};
```

The field is filled only if the platform needs it. Mapping to the Outstand API stays in `OutstandAdapter`.

**Default `contentFormat` when a target is created:** determined by the Application Service per platform (Pinterest → `pin`; others → `post` if allowed). The DB column default `post` is only a technical migration fallback — **not** permission to store `post` on Pinterest.

**Queue is not a separate entity (amendment to ADR-083, 2026-08-19)**

The Publish → Queue screen (KSP-03) is **not** backed by a persistent
`QueueSlot` entity — removed from the baseline. Queue is a **computed view**: a query of
`Post`/`PostTarget` with `status = Scheduled`, ordered purely ascending
by `Post.scheduledAt` (grouped by date then by hour in the
UI). There is no manual reorder mechanism — moving a schedule means
editing that post's own `scheduledAt` through the Draft Editor, not rearranging
the slot order. Reason: the "slot" concept (an empty time that can be filled,
with an `order` independent of time) is not used — every Scheduled Post
already has its own `scheduledAt` that definitively determines its order.

The Prisma model `PublishingQueueSlot` (column `order`, nullable `postId?`, etc.)
still physically exists in `apps/web/prisma/schema.prisma` but has **zero
references in application code** — considered deprecated per this ADR, scheduled to
be removed through a migration when T-032.5
is worked, not left as a confusing second source of truth.

### Domain Rules

1. `Post` status transitions follow the rules defined in `roles-permissions.md` — no unauthorized transitions are allowed.
2. A `Post` can have multiple `PostTarget`s (multi-account posting).
3. `Post` only stores `MediaId[]` references — it does not embed media data. Media details are fetched from the Media BC separately.
4. **(amendment to ADR-092)** `outstandPostId` on `Post` only exists after `schedulePost`/`publishNow` (1 call for all targets) is sent to the Outstand API — managed by the Integration Layer. `platformPostId` on `PostTarget` is only filled later (async), after `fetchPostOutcome`/webhook resolves the status per account.
5. `contentFormat` on `PostTarget` must be valid for that `platform` (the ADR-039 matrix). The Application Service rejects create/update/schedule of a target if the format is not allowed or the media does not meet the format's requirements (e.g. Story/Reel needs suitable media).
6. Platform-specific fields (Pinterest pin metadata) are stored in `platformOptions` on `PostTarget` — not on `Post`, so multi-target stays independent.
7. Business default format: Pinterest = `pin`; other platforms = `post` (unless the user chooses Reel/Story on IG/FB). Do not rely on the DB column default alone when writing a new target.

---

## BC-04 — MCP Access

### Responsibility

Manages users' AI access to the product through MCP (ADR-138, ADR-139): OAuth grants per workspace and scope, tool call audit, and rate limit. This BC **contains no AI** and **contains no product business logic**. MCP tools are entry points that wrap the Application Services of other BCs (Publishing, Analytics, Engagement, Media, Workspace); BC-04 only holds permissions, the audit trail, and usage limits.

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `McpGrant` | Aggregate Root | The permission a user gives to one AI client for one workspace |
| `McpAuditLog` | Entity | One row per tool call |

### Key Attributes (final; columns and types in `database-strategy.md` § BC-04)

**McpGrant**
- `id: McpGrantId`
- `workspaceId: WorkspaceId` — one workspace per connection
- `userId: UserId` — the user who connects; their membership in the workspace is what applies
- `clientId: string` — the AI client (result of dynamic client registration)
- `clientName: string?` — a copy of the client name at the time of approval (for the AI client list screen)
- `scopes: McpScope[]` — `read | draft | schedule` (MVP)
- `createdAt: Date`, `lastUsedAt: Date?`, `revokedAt: Date?`
- Invariant: at most one active grant (`revokedAt` empty) per `userId` + `clientId` + `workspaceId`.

**McpAuditLog**
- `id: McpAuditLogId`
- `workspaceId`, `userId`, `grantId?` (empty if rejected because there is no grant), `clientId`
- `toolName: string`, `scope: McpScope`
- `inputSummary: string` — a redacted summary (without the full caption and without URLs with secret parameters)
- `status: success | denied | error`, `errorCode: string?`, `durationMs: number`
- `targetId: string?` — the ID of the action result, for example `PostId`
- `createdAt: Date` — 90-day retention

### Notes

- `McpGrant` is the authorization source of MCP calls; the per-call check rules and revocation are in `application-layer.md` § McpAccessService.
- A post created through MCP carries a source marker in BC-03 (`createdVia = mcp` along with the client); that marker belongs to Publishing, not BC-04.
- Comment content returned by read tools is marked as untrusted data.
- Postgres-based rate limit per workspace (60 calls per minute, 30 write actions per hour, 50 scheduled contents per day; configurable).

---

## BC-05 — Engagement

### Responsibility

Manages audience comments and replies from connected social media accounts. Engagement is the **retention layer** after Publishing (I-05). Direct Messages and mentions are outside the MVP scope.

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `InboxItem` | Aggregate Root | An audience interaction item that enters the inbox |
| `Reply` | Entity | A reply sent from the platform |

### Key Attributes

**InboxItem**
- `id: InboxItemId`
- `workspaceId: WorkspaceId`
- `connectedAccountId: ConnectedAccountId`
- `platform: SocialPlatform`
- `type: EngagementType` — `comment` in the MVP
- `externalId: string` — comment ID from the Outstand Comments API
- `authorHandle: string` — sender username
- `content: string` — interaction content
- `status: InboxItemStatus` — `unread | replied | resolved | dismissed` (ADR-157; previously written as `unread | read | replied | archived` and in code as `unread | done`, both obsolete)
- `postId: PostId?` — if the comment is bound to a specific post (reference to the Publishing BC)
- `receivedAt: Date`
- `readAt: Date?` — kept but unused; not related to the `read` status that no longer exists (ADR-157, King Rezi's decision 2026-11-06)

**Reply**
- `id: ReplyId`
- `inboxItemId: InboxItemId`
- `userId: UserId`
- `content: string`
- `outstandReplyId: string?` — ID from Outstand after the reply is sent
- `sentAt: Date`
- `status: ReplyStatus` — `pending | sent | failed`

### Notes

- `InboxItem` is filled by the JOB-03 periodic pull every 30 minutes or manual refresh through the Outstand Comments API.
- Status transitions (ADR-157): `unread` → `replied` / `resolved` / `dismissed`; `replied` → `resolved` / `dismissed`; `resolved` and `dismissed` → `unread` (Reopen). `replied` is filled automatically when a Reply is sent successfully if the status is `unread`, and does not downgrade `resolved` or `dismissed`. Old `done` rows are migrated to `resolved` (T-217.4). The `status` column is a text type without a database constraint.
- The Inbox query groups items by `postId` (items without a `postId` become one group "Tanpa posting"); the unanswered count, sort, and date range are computed in the repository (T-218).
- `postId` on `InboxItem` is a soft reference — the Engagement BC does not import the Publishing implementation.
- Replies are sent through Outstand; DMs, mentions, and Engagement webhooks are not modeled for the MVP.

---

## BC-06 — Analytics

### Responsibility

Manages content performance data and the workspace analytics summary. Analytics is a **retention layer** that gives visibility to the buyer (Maya) and context to the daily user (Raka).

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `PostMetrics` | Aggregate Root | Performance metrics of one post on one platform |
| `WorkspaceSnapshot` | Entity | The workspace analytics summary for a given period |

### Key Attributes

**PostMetrics**
- `id: PostMetricsId`
- `postId: PostId` — reference to the Publishing BC
- `connectedAccountId: ConnectedAccountId`
- `platform: SocialPlatform`
- `impressions: number`
- `reach: number`
- `likes: number`
- `comments: number`
- `shares: number`
- `clicks: number?`
- `engagementRate: number` — computed: (likes + comments + shares) / reach
- `fetchedAt: Date` — when this data was last fetched from Outstand

**WorkspaceSnapshot**
- `id: WorkspaceSnapshotId`
- `workspaceId: WorkspaceId`
- `period: SnapshotPeriod` — `weekly | monthly`
- `periodStart: Date`
- `periodEnd: Date`
- `totalPosts: number`
- `totalReach: number`
- `totalEngagements: number`
- `avgEngagementRate: number`
- `topPostId: PostId?`
- `createdAt: Date`

### Notes

- `PostMetrics` is fetched from the Outstand API — the fetch frequency is defined in `background-jobs.md`.
- `WorkspaceSnapshot` can be created periodically by a background job based on `PostMetrics` data.
- The Analytics BC reads `PostId` and `ConnectedAccountId` as references, and never depends on the implementation of Publishing or Workspace.

---

## BC-07 — Start Page

### Responsibility

Manages the workspace's public page containing a list of links and the brand profile. Start Page is a **supporting capability** that makes use of the workspace identity (I-05 positioning: Start Page is a supporting capability, not the center of the weekly journey).

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `StartPage` | Aggregate Root | A public page that can be shared |
| `PageLink` | Entity | An individual link shown on the page |

### Key Attributes

**StartPage**
- `id: StartPageId`
- `workspaceId: WorkspaceId`
- `slug: string` — public URL identifier (e.g. `/page/nama-brand`)
- `title: string` — page title
- `bio: string?` — short description
- `avatarUrl: string?`
- `theme: PageTheme` — `default | minimal | bold | ...`
- `isPublished: boolean`
- `viewCount: number` — basic analytics
- `updatedAt: Date`

**PageLink**
- `id: PageLinkId`
- `startPageId: StartPageId`
- `label: string`
- `url: string`
- `position: number` — display order
- `isActive: boolean`
- `clickCount: number` — basic analytics
- `createdAt: Date`

---

## BC-08 — Media

### Responsibility

Manages media files uploaded by users for use in content. The Media Library is a supporting domain that provides assets for Publishing.

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `MediaItem` | Aggregate Root | A media file uploaded to the workspace |

### Key Attributes

**MediaItem**
- `id: MediaId`
- `workspaceId: WorkspaceId`
- `uploaderId: UserId`
- `filename: string`
- `mimeType: string`
- `size: number` — bytes
- `url: string?` — application access URL cache from Supabase Storage; may be empty/expired and regenerated from `storagePath`
- `storagePath: string` — internal path in the Supabase Storage bucket
- `outstandMediaId: string?` — optional publishing working copy metadata
- `outstandMediaUrl: string?` — optional metadata; not the source of truth for the original
- `outstandUploadedAt: Date?` — time the working copy was confirmed in Outstand
- `outstandExpiresAt: Date?` — expiry time of the Outstand working copy
- `type: MediaType` — `image | video | gif`
- `width: number?`
- `height: number?`
- `duration: number?` — for video, in seconds
- `createdAt: Date`

### Notes

- Media files are stored in **Supabase Storage** (pre-architecture decision).
- On publish, the original is given a working copy through Outstand request upload URL → PUT → confirm; the returned Outstand URL is used for scheduling/publishing.
- The Publishing BC only stores `MediaId[]` — it does not embed media data.
- When rendering a Post, the Application Layer fetches `MediaItem` from the Media BC based on `MediaId[]`.

---

## BC-09 — Notification

### Responsibility

Manages in-app notifications for users. Notification is a supporting domain that receives triggers from other domains and sends messages to users.

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `Notification` | Aggregate Root | One notification item for one user |

### Key Attributes

**Notification**
- `id: NotificationId`
- `workspaceId: WorkspaceId`
- `userId: UserId` — notification recipient
- `type: NotificationType` — `post_published | post_failed | account_reconnect_required | engagement_new | member_invited | ownership_transfer_requested | ownership_transfer_resolved | ...`
- `title: string`
- `body: string`
- `isRead: boolean`
- `relatedEntityType: string?` — `post | inbox_item | member | ...`
- `relatedEntityId: string?` — ID of the related entity
- `createdAt: Date`
- `readAt: Date?`

### Notes

- Real-time delivery uses **Supabase Realtime** — details in `realtime-strategy.md`.
- The Notification BC has no domain business logic — it is only a consumer that writes notifications based on events from other domains.

---

## BC-10 — Billing

### Responsibility

Manages workspace subscriptions and payments. Billing is a post-MVP domain — defined here for completeness of the domain model but not implemented in the MVP.

### Core Entities

| Entity | Type | Description |
|---------|------|-----------|
| `Subscription` | Aggregate Root | The workspace's active subscription |
| `Invoice` | Entity | A bill per period |

### Key Attributes

**Subscription**
- `id: SubscriptionId`
- `workspaceId: WorkspaceId`
- `plan: WorkspacePlan` — `free | pro`
- `status: SubscriptionStatus` — `active | past_due | canceled | trialing`
- `currentPeriodStart: Date`
- `currentPeriodEnd: Date`
- `canceledAt: Date?`

**Invoice**
- `id: InvoiceId`
- `subscriptionId: SubscriptionId`
- `amount: number`
- `currency: string`
- `status: InvoiceStatus` — `draft | open | paid | void`
- `issuedAt: Date`
- `paidAt: Date?`

### Notes

- The payment provider (Stripe or equivalent) is an external dependency. Details in the Engineering Planning phase.
- The MVP uses `plan: free` for all workspaces — the Billing BC is built post-MVP.

---

# Context Map

The Context Map documents how bounded contexts interact. In the Pragmatic Boundary, relations between contexts happen **only through ID references and shared types from `packages/shared`** — there is no importing of implementations across domains.

## Context Map Diagram

```
                    ┌─────────────┐
                    │  BC-01      │
                    │  Identity   │
                    └──────┬──────┘
                    UserId │ (shared type)
                           ▼
                    ┌─────────────┐
                    │  BC-02      │◄─── WorkspacePlan ──── BC-10 Billing
                    │  Workspace  │
                    └──────┬──────┘
         WorkspaceId +     │ ConnectedAccountId
         (shared types)    │ (shared types)
           ┌───────────────┼───────────────────────────┐
           │               │               │            │
     ┌─────▼─────┐  ┌──────▼──────┐ ┌─────▼─────┐ ┌───▼────────┐
     │ BC-03     │  │ BC-05       │ │ BC-06     │ │ BC-07      │
     │Publishing │  │ Engagement  │ │ Analytics │ │ Start Page │
     └─────┬─────┘  └─────────────┘ └─────┬─────┘ └────────────┘
      PostId│                         PostId│
      (shared)                        (soft ref)
           │
     ┌─────▼─────┐
     │ BC-04     │◄──── MCP entry point (wraps other BCs' services)
     │ MCP       │
     │ Access    │
     └───────────┘

     MediaId (shared type)
     ─────────────────────
     BC-03 Publishing → BC-08 Media (ID reference only)

     Notification triggers (via service calls, not direct import):
     BC-03, BC-05 → BC-09 Notification

     External System:
     BC-03 Publishing ──── Outstand API ────► Post.outstandPostId (amendment to ADR-092)
     BC-05 Engagement ◄──── Outstand Comments API ─ JOB-03/manual pull
     BC-06 Analytics ◄──── Outstand API ───── PostMetrics (fetch)
```

## Inter-Context Relation Table

| Source BC | Target BC | Relation Type | Data Consumed |
|-----------|-----------|-------------|----------------------|
| Workspace | Identity | Downstream | `UserId` (Member reference) |
| Publishing | Workspace | Downstream | `WorkspaceId`, `ConnectedAccountId` |
| Publishing | Media | Downstream | `MediaId[]` (attachment reference) |
| MCP Access | Workspace | Downstream | `WorkspaceId`, `UserId` (grant and member validation) |
| Engagement | Workspace | Downstream | `WorkspaceId`, `ConnectedAccountId` |
| Engagement | Publishing | Downstream (soft) | `PostId` (comments related to a post) |
| Analytics | Publishing | Downstream (soft) | `PostId` (metrics per post) |
| Analytics | Workspace | Downstream | `WorkspaceId` |
| Start Page | Workspace | Downstream | `WorkspaceId` |
| Notification | Workspace | Downstream | `WorkspaceId`, `UserId` |
| Billing | Workspace | Downstream | `WorkspaceId` |

**Relation Types:**
- **Downstream** — a context consumes data from another context through an ID reference.
- **Downstream (soft)** — an ID reference that does not enforce a foreign key — may be null/missing.

---

# Shared Types — `packages/shared`

`packages/shared` is a package in the Hybrid Monorepo that publishes types used across bounded contexts. There must be no business logic or implementation in `packages/shared` — **only type definitions**.

## ID Types

Each bounded context publishes its branded IDs to `packages/shared` so cross-context references stay type-safe.

```typescript
// ID types — opaque branded types
type UserId = string & { readonly _brand: 'UserId' };
type WorkspaceId = string & { readonly _brand: 'WorkspaceId' };
type MemberId = string & { readonly _brand: 'MemberId' };
type ConnectedAccountId = string & { readonly _brand: 'ConnectedAccountId' };
type PostId = string & { readonly _brand: 'PostId' };
type PostTargetId = string & { readonly _brand: 'PostTargetId' };
type MediaId = string & { readonly _brand: 'MediaId' };
type InboxItemId = string & { readonly _brand: 'InboxItemId' };
type ReplyId = string & { readonly _brand: 'ReplyId' };
type McpGrantId = string & { readonly _brand: 'McpGrantId' };
type McpAuditLogId = string & { readonly _brand: 'McpAuditLogId' };
type PostMetricsId = string & { readonly _brand: 'PostMetricsId' };
type WorkspaceSnapshotId = string & { readonly _brand: 'WorkspaceSnapshotId' };
type StartPageId = string & { readonly _brand: 'StartPageId' };
type PageLinkId = string & { readonly _brand: 'PageLinkId' };
type NotificationId = string & { readonly _brand: 'NotificationId' };
type SubscriptionId = string & { readonly _brand: 'SubscriptionId' };
```

## Enums

Canonical enums used by more than one bounded context:

```typescript
// Content status — the only canonical status reference
// Source: product-discovery/02-product/roles-permissions.md
enum ContentStatus {
  Draft = 'draft',
  InReview = 'in_review',
  ReadyToSchedule = 'ready_to_schedule',
  Scheduled = 'scheduled',
  Published = 'published',
  Failed = 'failed',
}

// Member role (ADR-074 — 3 roles, "Manager" removed)
enum MemberRole {
  Owner = 'owner',
  Admin = 'admin',
  Creator = 'creator',
}

// Social media platform
enum SocialPlatform {
  Instagram = 'instagram',
  Facebook = 'facebook',
  Twitter = 'twitter',
  LinkedIn = 'linkedin',
  TikTok = 'tiktok',
  YouTube = 'youtube',
  Threads = 'threads',
  Pinterest = 'pinterest',
}

// Workspace plan
enum WorkspacePlan {
  Free = 'free',
  Pro = 'pro',
}

// Content format per publish target (ADR-039)
enum ContentFormat {
  Post = 'post',
  Reel = 'reel',
  Story = 'story',
  Pin = 'pin',
}
```

## Value Objects

Simple value objects used across contexts:

```typescript
// Date range — used by Analytics and Publishing
interface DateRange {
  start: Date;
  end: Date;
}

// Pagination params — used by all list queries
interface PaginationParams {
  page: number;
  limit: number;
}
```

---

# Domain Boundary Rules

The following rules must be followed across all implementations. These rules are a direct derivation of the **Pragmatic Boundary** decision (pre-architecture decision).

## Main Rules

**BR-01 — Must Not Import Implementations Across Domains**

A bounded context is forbidden from importing implementation files from another bounded context.

```
// ❌ FORBIDDEN
import { Post } from '../publishing/entities/post';

// ✅ CORRECT — only an ID reference via shared types
import { PostId } from '@postific/shared';
```

**BR-02 — Cross-Domain References Only Through IDs**

When one domain needs to reference an entity from another domain, use its ID only. If the full data is needed, the Application Layer is responsible for fetching data from both domains.

**BR-03 — Shared Types Only in `packages/shared`**

Types used by more than one domain must be defined in `packages/shared`. There must be no "shared type" defined in one domain and imported by another domain.

**BR-04 — Public API via `index.ts`**

Each domain exposes its public API only through the `index.ts` file (barrel export). A domain's internal files must not be imported directly from outside.

```
// ✅ CORRECT — import from the barrel
import { createPost } from '@postific/publishing';

// ❌ FORBIDDEN — import from an internal file
import { createPost } from '@postific/publishing/src/services/post-service';
```

**BR-05 — No Shared Database Table Across Domains**

Each domain has its own database tables. Relations between tables of different domains use ID reference foreign keys — there are no joins that cross a domain boundary at the domain query level.

Exception: the Application Layer may perform joins between tables of different domains for read model / view purposes.

**BR-06 — Event / Service Interface for Async Communication**

If one domain needs to trigger an action in another domain (for example: Publishing finishes → send a Notification), communication is done through a service interface defined in the Application Layer — not a direct call to the domain implementation.

The details of this mechanism are defined in `application-layer.md`.

## Folder Structure (Reference)

```
apps/
└── web/
    └── src/
        └── domains/
            ├── identity/
            │   └── index.ts        ← public API
            ├── workspace/
            │   └── index.ts
            ├── publishing/
            │   └── index.ts
            ├── mcp-access/
            │   └── index.ts
            ├── engagement/
            │   └── index.ts
            ├── analytics/
            │   └── index.ts
            ├── start-page/
            │   └── index.ts
            ├── media/
            │   └── index.ts
            └── notification/
                └── index.ts
packages/
└── shared/
    ├── src/
    │   ├── ids.ts          ← branded ID types
    │   ├── enums.ts        ← shared enums
    │   └── value-objects.ts
    └── index.ts
```

The full monorepo structure details are defined in `product-discovery/06-engineering/`.

---

# Traceability to the Product Baseline

The following table maps Bounded Contexts to the modules defined in Product Baseline v1.0 (`feature-modules.md`).

| Bounded Context | Product Module | Module Classification |
|----------------|----------------|-------------------|
| BC-01 Identity | Authentication | Supporting Module |
| BC-02 Workspace | Workspace | Core Module |
| BC-02 Workspace | User Profile (partial) | Supporting Module |
| BC-03 Publishing | Publishing | Core Module |
| BC-04 MCP Access | MCP Server | Core Module |
| BC-05 Engagement | Engagement | Core Module |
| BC-06 Analytics | Analytics | Core Module |
| BC-07 Start Page | Start Page | Core Module |
| BC-08 Media | Media Library | Supporting Module |
| BC-09 Notification | Notifications | Supporting Module |
| BC-10 Billing | Billing | Supporting Module |
| — | Settings | Supporting Module (distributed: Workspace + User Profile BC) |

**Notes:**
- The bounded context classification and the product module classification do differ for BC-04: BC-04 MCP Access is a Supporting Domain (it only holds grants, audit, and rate limit), while the "MCP Server" product module in `feature-modules.md` is a Core Module because it exposes product actions to the user's AI through other domains' services (ADR-138).
- The **Settings** module from the Product Baseline does not become its own bounded context — workspace settings are managed in BC-02 Workspace, user settings are managed in BC-01 Identity/User Profile.
- The **Infrastructure** modules (API Integrations, Webhooks, Audit Logs, Background Jobs) are cross-cutting concerns that do not become bounded contexts — covered in the following architecture documents.

---

# Traceability to User Insights

| Insight | Affected Bounded Context | Domain Implication |
|---------|-------------------------------|-----------------|
| I-01 — Workflow Consolidation | BC-03 Publishing, BC-05 Engagement, BC-06 Analytics | All three BCs must be able to "read" from one workspace context without context switching |
| I-04 — Publishing Trust | BC-03 Publishing | `Post` and `PostTarget` must model status with high granularity — `outstandPostId` (post-level, amendment to ADR-092) and `PostTargetStatus`/`platformPostId` per account |
| I-06 — AI in-workflow | BC-04 MCP Access | Replaced by ADR-138: the user's AI attaches to work in Postific through MCP tools that wrap the same Application Services as the UI, without a built-in AI UI; BC-04 (Supporting Domain) only holds grants, audit, and rate limit |
| I-08 — Lightweight Collaboration | BC-03 Publishing | `ContentStatus` models a light handoff (`In Review`, `Ready to Schedule`) without building a layered approval workflow |

---

# Decision Log

| ID | Decision | Reason | Alternatives |
|----|-----------|--------|-----------|
| DM-D01 | Use 10 bounded contexts matching the Product Baseline modules | Reflects the real business domain, not a technical abstraction | Few large BCs (easier at first, hard to grow) |
| DM-D02 | BC-10 Billing is defined but **out of MVP scope** | Billing needs to be modeled now so it does not break the domain when added later | Ignore Billing until needed |
| DM-D03 | Settings is not its own BC — distributed to Workspace and Identity | "Settings" is a UI capability, not a business domain — its entities already exist in the relevant BCs | A separate Settings BC (adds unnecessary indirection) |
| DM-D04 | The `ContentStatus` enum is defined in `packages/shared`, not in the Publishing BC | Content status is consumed by Engagement, Analytics, and Notification — it must be shared | Define it in Publishing and re-export (adds coupling) |
| DM-D05 | `ConnectedAccount` lives in the Workspace BC, not the Publishing BC | An account is a workspace-level resource, not a publication-level resource; Publishing only references `ConnectedAccountId` | ConnectedAccount in the Publishing BC (makes Publishing too large) |
| DM-D06 | There is no "Activity Feed" BC — activity is recorded in the Notification BC | The Activity Feed (Should Have in the MVP) can be modeled as a queried `NotificationType`; needs no new BC in the MVP | A separate Activity BC (post-MVP if needed) |
| DM-D07 | `ContentFormat` on `PostTarget` (+ `platformOptions`), enum in `packages/shared` | The format depends on platform & multi-account; Outstand overrides stay in the ACL (ADR-039) | The format only on the global `Post`, or hardcode Outstand fields in the domain |
| DM-D08 | The MVP Engagement is only `comment` + `Reply`, filled through pull | Aligned with the Outstand contract; DM/mention and Engagement webhooks are not available for the MVP | Keep types that the provider cannot fulfill |
| DM-D09 | The original media stays in Supabase; Outstand working copy metadata is optional | Separates asset ownership from provider publishing artifacts | Make the Outstand URL the source of truth |
| DM-D10 | ADR-040 | DM-D08–D09 and the account reconnect status amend the old model |
| DM-D11 | Two-step Transfer Ownership: `pendingOwnerTransferTo` on `Workspace`, not a direct `ownerId` swap | The target Admin must `acceptOwnershipTransfer` first before the roles actually swap — prevents the old Owner from forcing responsibility (including billing) onto an Admin who is not ready (ADR-050) | Direct `ownerId` swap without approval (simpler, but rejected — see ADR-050) |

---

# Related Documents

* `README.md` — scope and workflow of the 05-architecture folder
* `database-strategy.md` — database schema strategy based on this domain model *(next document)*
* `application-layer.md` — how the Next.js App Router interacts with domain services
* `integration-layer.md` — Outstand API and webhook architecture
* `background-jobs.md` — background jobs for Publishing and Analytics
* `realtime-strategy.md` — Supabase Realtime for Notification
* `auth-architecture.md` — Better Auth and MemberRole-based authorization
* `../02-product/feature-modules.md` — Product Baseline: product modules
* `../02-product/mvp-definition.md` — Product Baseline: MVP scope
* `../02-product/roles-permissions.md` — Product Baseline: roles and canonical content status
* `../03-user/insights.md` — User Discovery: insights I-01, I-04, I-06, I-08
* `../04-ux/key-screen-patterns.md` — UX Baseline: screen patterns as an entity reference
* `../../project-os/DECISIONS.md` — ADR-004 (Modular Monolith + DDD), pre-architecture decisions
