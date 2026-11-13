# Real-time Strategy

This document defines the **Real-time Strategy** for the **Postific** product — the in-app notification approach, content status synchronization, and data update patterns without a full page reload.

This document is the reference for real-time design and does not cover code implementation. Implementation details (Supabase Realtime client setup, subscription lifecycle) are documented in Engineering Planning (M6).

---

# Purpose

* Set a realistic real-time scope for the MVP.
* Define the in-app notification architecture based on Supabase Realtime.
* Set the manual refresh pattern for content data and post status.
* Document the mapping from domain events to user notifications.
* Define the rules for when the system uses Realtime vs polling vs manual refresh.

---

# Pre-Architecture Decisions

The following decisions were set before this document was created and are the foundation of the Real-time Strategy:

| Topic | Decision | Source |
|-------|-----------|--------|
| Real-time Approach | In-app notification + manual refresh | Pre-architecture decision |
| Database Platform | Supabase PostgreSQL Cloud | Pre-architecture decision |
| Notification BC | BC-09 Notification as its own bounded context | `domain-model.md` |
| Background Jobs | JOB-02 creates notifications when a post is published/failed | `background-jobs.md` |

---

# MVP Real-time Scope

The system does **not** build full real-time collaboration (like Google Docs). The real-time scope is limited to:

| Feature | Approach | Reason |
|-------|-----------|--------|
| In-app notifications (badge, toast) | Supabase Realtime | Needed for team awareness without polling |
| Calendar/Queue/Drafts/History (4 Publish screens) | Supabase Realtime, granular client-side patch (ADR-094) | Buffer-style team collaboration — other users see changes without a manual refresh; scope added after this initial baseline (see § "Extension to `publishing_posts`" below) |
| Engagement inbox (comments/replies) | JOB-03 30-minute pull + manual refresh + badge | Internal sync detects new comments; there is no Engagement webhook in the MVP |
| Analytics | Manual refresh | Daily snapshot data — no real-time needed |
| Presence (who's editing) | Post-MVP | High complexity, not an MVP need |
| Collaborative editing | Post-MVP | Out of MVP scope |

---

# In-App Notification Architecture

## Notification Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                              │
│                                                                   │
│  Domain Event (post published, post failed, engagement new)       │
│         │                                                         │
│         ▼                                                         │
│  Background Job (JOB-02)                                          │
│         │                                                         │
│         ▼                                                         │
│  NotificationService.create()                                     │
│         │                                                         │
│         ▼                                                         │
│  INSERT into the notifications table                              │
│         │                                                         │
│         ▼ (PostgreSQL change → Supabase Realtime)                 │
│                                                                   │
│  Client (Next.js)                                                 │
│  └── Supabase Realtime subscription                               │
│        └── Receive the new notification payload                   │
│              ├── Update the notification badge count              │
│              └── Show a toast (optional, depending on type)       │
└──────────────────────────────────────────────────────────────────┘
```

## Supabase Realtime Subscription

The client subscribes to changes on the `notifications` table using Supabase Realtime with a per-user filter:

```
Channel: notifications:{userId}
Table:   notifications
Filter:  user_id = eq.{userId}
Event:   INSERT
```

**Subscription rules:**
- The subscription is created when the user logs in and the active workspace is loaded.
- The subscription is removed when the user logs out or the session ends.
- Subscribe only to the `INSERT` event — update and delete are not needed for notifications.
- The per-`user_id` filter ensures a user only receives their own notifications.

## `notifications` Table

The full schema of this table is defined in `database-strategy.md` (BC-09). Columns relevant to the Realtime subscription:

```
notifications
├── id                   UUID PK
├── workspace_id         UUID FK → workspaces
├── user_id              UUID       -- notification recipient (subscription filter)
├── type                 TEXT       -- notification type (see Notification Type Registry)
├── title                TEXT
├── body                 TEXT
├── is_read              BOOLEAN DEFAULT false
├── related_entity_type  TEXT       -- context: 'post' | 'inbox_item' | 'member' | ...
├── related_entity_id    UUID       -- ID of the related entity
├── created_at           TIMESTAMPTZ DEFAULT now()
└── read_at              TIMESTAMPTZ
```

---

# Notification Type Registry

| Type | Trigger | Recipient | Toast |
|------|---------|----------|-------|
| `post_published` | JOB-01 processes `post.published` | Post owner (the Creator who made it) | Yes |
| `post_failed` | JOB-01 maps the vendor event `post.error` to the domain status `failed` | Post owner | Yes |
| `account_reconnect_required` | JOB-01 maps `account.token_expired` to the account status `error` | Account Owner, Admin | Yes |
| `engagement_new` | JOB-03/manual sync finds new comments | Creator, Admin, Account Owner | No (badge only) |
| `post_scheduled_reminder` | A post will go live within 1 hour | Post owner | No |

**Notes:**
- `engagement_new` does not show a toast, to avoid spam when a sync finds many comments at once. Only the badge count increases.
- Vendor event names are not used as `NotificationType`; internal names such as `post_failed` stay canonical.
- `post_scheduled_reminder` is an MVP nice-to-have — it can be skipped if it adds complexity.

---

# Extension to `publishing_posts` (ADR-094)

**Amendment to RT-D01/RT-D02.** The initial baseline of this document (above) limited
Supabase Realtime to the `notifications` table only, with the Content Calendar
manual-refresh-only. ADR-094 (2026-08-28) extends the scope to the
`publishing_posts` table, specifically for the 4 Publish screens (Calendar, Queue, Drafts,
History) — not application-wide, not other tables.

**Subscription:**
```
Channel: publishing_posts:{workspaceId}
Table:   publishing_posts
Filter:  workspace_id = eq.{workspaceId}
Event:   INSERT, UPDATE   -- no DELETE, soft-delete is reflected as an UPDATE
```

Unlike `notifications` (per-user), this channel is **per-workspace** — all
workspace members need to know about the change, not just the post owner.

**Update strategy: granular client-side patch** (not a full-page refresh).
Each screen keeps its own data list as client state
(initialized from the initial Server Component props). When a Realtime event arrives
(`{postId, eventType}`), the screen calls the fetch-1-record function from
`PublishingService` (reuse, not a refetch of the whole list), then **upserts or
removes** it in local state depending on whether the post still matches the
display criteria of that screen (e.g. Queue only shows `Scheduled` — once the
status changes to `Published`, the item is removed from the Queue local state, not
updated). Events from the user's own actions (echo) are processed the same as
events from other people — there is no special detection/skip, because
fetch-and-patch is already idempotent.

**New RLS policy specific to Realtime** (not a reuse of the existing
server-side policy): `publishing_posts_realtime_workspace_members`, based on
`auth.uid()` — see the additional variant in `database-strategy.md` § RLS Policy
Pattern.

**Per-screen subscription lifecycle** — created when the screen mounts, released
on unmount/navigating away from the page/workspace (unlike the notification bell, which is
global for the whole session).

**Hard dependency on T-036** (notification bell) — the generic Supabase
Realtime client wiring + Better Auth↔Supabase JWT bridge is built in T-036 first;
this feature is purely a reuse, not a rebuild. History (T-034), because it
has not been built yet, must include this Realtime pattern from the initial design.

---

# Manual Refresh Pattern

## Content Calendar & Post List

**Note:** this section describes the initial pattern (pre-ADR-094). For
Calendar/Queue/Drafts/History, the Supabase Realtime granular patch pattern above
now applies once T-036 is finished — the manual refresh below remains
relevant as a fallback/the state before that Realtime implementation is running.

Before ADR-094, the content calendar did not use Supabase Realtime. The reasons at the time:
- Data changes mainly through the user's own actions or through webhooks (post published/failed).
- Notifications already inform the status change — the user can refresh consciously.
- A real-time calendar subscription adds complexity without significant benefit for the MVP.

**Pattern used:**
- After the user performs an action (create a draft, schedule a post), the UI is updated optimistically or via a Server Action that returns the latest data.
- The user can press a manual refresh button in the Content Calendar.
- When a `post_published` or `post_failed` notification is received, the UI shows the message "Status konten berubah. Refresh untuk melihat update." with a refresh button.

## Engagement Inbox

The engagement inbox uses a combination of badge + manual refresh:
- JOB-03 pulls comments every 30 minutes; the refresh button triggers the same sync on demand.
- The badge count is updated via Supabase Realtime when an `engagement_new` notification from the sync result arrives.
- The user opens the Engagement Inbox → data is fetched fresh from the database (Server Component).
- There is no auto-refresh without user interaction.
- Replies are sent through the Outstand API; DMs, mentions, and engagement webhooks are outside the MVP.

## Analytics Dashboard

Analytics does not need real-time — the data is a periodic snapshot (daily sync). The user only sees historical data. There is no subscription or polling.

---

# Rules: Real-time vs Polling vs Manual Refresh

| Condition | Approach |
|---------|-----------|
| Notifications that must be visible to the user immediately | Supabase Realtime (INSERT subscription) |
| Status that changes because of the user's own action | Optimistic update + Server Action response |
| Data that changes via a background job / webhook receipt | Manual refresh + notification badge/toast |
| Snapshot data (analytics, audit log) | Manual refresh on demand |
| Data that rarely changes (workspace settings) | Fetch when the page loads, not subscribed |

---

# RLS on Supabase Realtime

Supabase Realtime respects Row-Level Security (RLS). A subscription to the `notifications` table only returns the rows the user can read based on the applicable RLS policy.

**Policy for the Realtime subscription:**
```sql
-- a user can only subscribe to their own notifications
CREATE POLICY "users_own_notifications"
ON notifications
FOR SELECT
USING (user_id = auth.uid());
```

This ensures that even if the client misconfigures the filter, server-side RLS still protects the data.

**Note:** `auth.uid()` here refers to the Better Auth + Supabase JWT integration configured in Engineering Planning (M6) — see the details in `auth-architecture.md`. This policy applies to Realtime subscriptions from the client (anon key), which differs from server-side queries using the service role key (which use `current_setting('app.current_user_id')`).

---

# Notification Bell Component

The UI component for in-app notifications works as follows:

```
NotificationBell (Client Component)
  ├── Supabase Realtime subscription on mount
  ├── Shows the badge count (unread notifications)
  ├── Dropdown: list of the 10 latest notifications
  ├── Click a notification → mark is_read = true → navigate to the related content
  └── "Lihat semua" → /notifications page
```

**Badge count:**
- Computed from `SELECT count(*) FROM notifications WHERE user_id = ? AND is_read = false`.
- Updated in realtime when a new notification arrives.
- Reset when the user opens the dropdown (mark as read).

---

# Post-MVP Considerations

The following real-time features are not in the MVP but need to be considered when scaling:

| Feature | Complexity | Priority |
|-------|-------------|-----------|
| Presence indicator (who is editing a draft) | High | Low |
| Live collaborative editing | Very high | Very low |
| Auto-refresh content calendar | Medium | Medium |
| Push notification (browser/mobile) | Medium | Medium |

---

# Decision Log

| ID | Decision | Reason |
|----|-----------|--------|
| RT-D01 | Supabase Realtime only for the `notifications` table | Minimal scope — notifications are the only use case that truly needs real-time in the MVP |
| RT-D02 | The content calendar uses manual refresh, not Realtime | Reduces complexity; calendar changes happen through user actions or webhooks that are already handled via notifications |
| RT-D03 | Filter the Realtime subscription per `user_id` | Privacy — a user must not receive another user's notifications; consistent with RLS |
| RT-D04 | `engagement_new` does not raise a toast | Prevents notification spam when a sync finds many comments at once; a badge count is more appropriate |
| RT-D05 | Optimistic update for the user's own actions | A responsive UX without waiting for database confirmation; falls back to an error state on failure |
| RT-D06 | Internal notification names use `snake_case`; the ACL separates them from vendor event names | The domain does not depend on the Outstand contract; `post.error` still produces `post_failed` |
| RT-D07 | Engagement notifications only come from JOB-03/manual sync | There are no comment/DM/mention webhooks in the MVP contract |
| RT-D08 | ADR-040 | RT-D06–D07 amend the old notification registry and sources |
| RT-D09 | ADR-094 | RT-D01/RT-D02 amended: `publishing_posts` added as the second Realtime target (per-workspace channel, granular client-side patch), specifically for the 4 Publish screens; hard dependency on T-036 |

---

# Related Documents

* `domain-model.md` — BC-09 Notification as a bounded context
* `database-strategy.md` — `notifications` table
* `background-jobs.md` — JOB-02, which creates notifications
* `integration-layer.md` — webhooks that trigger the chain to notifications
* `auth-architecture.md` — authentication is required before a Realtime subscription
* `../../project-os/DECISIONS.md` — ADR-023, ADR-094
