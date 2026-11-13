# User Flows

This document defines the **solution flows** for the user's core jobs on the **Postific** product.

The user flows here are future-state — they describe how the product completes the user's jobs, not current working conditions.

---

# Overview

Each flow is documented from the point of view of **Raka (P0 daily user)** as the main actor. Maya (P0 buyer) acts as an observer on flows that involve visibility.

These flows do not define visual layout or detailed UI interaction. They are the logic and work-sequence reference that serves as input for Navigation Patterns, Key Screen Patterns, and Architecture Discovery.

---

# Scope

## In Scope

* Solution flows for Must Have MVP features.
* Happy path — the ideal scenario when there are no obstacles.
* One alternate path per flow — the most critical or most frequent scenario.
* References to the relevant UX Principles.

## Out of Scope

* Wireframes or visual layout.
* Technical error handling (HTTP errors, server failures).
* Flows for Should Have and Could Have features.
* Detailed flows per social media platform (Instagram, X, etc.).

---

# How to Read This Document

Each flow has this structure:

* **Goal** — what the actor wants to achieve at the end of the flow.
* **Actor** — who runs the flow.
* **Trigger** — what starts the flow.
* **Module** — the product modules involved.
* **Happy Path** — the steps when all conditions are met.
* **Alternate Path** — the most critical scenario that deviates from the happy path.
* **UX Principles** — the principles that govern decisions in this flow.

---

# User Flow List

| ID | Flow | Main Actor | Module |
| -- | ---- | ---------- | ------ |
| UF-01 | Create and Schedule Content | Raka | Publishing |
| UF-02 | Manage the Content Queue | Raka | Publishing |
| UF-03 | Review the Publishing Calendar | Raka + Maya (observer) | Publishing |
| UF-04 | Triage the Engagement Inbox | Raka | Engagement |
| UF-05 | Connect a Social Account | Raka / Maya | Organization Settings |
| UF-06 | View a Performance Summary | Maya + Raka (secondary) | Analytics |

---

# User Flows

---

## UF-01 — Create and Schedule Content

**Goal:** Raka finishes one piece of content, from writing the caption to having it scheduled to the right social accounts.

**Actor:** Raka (primary)

**Trigger:** Raka starts a daily content work session or receives a new brief.

**Module:** Publishing (Draft Editor, Account Selector, Content Format Selector, Schedule Picker). The user's AI can create drafts and schedule through MCP (ADR-138)

---

### Happy Path

1. Raka opens **Publish → Drafts** and clicks **New Post**.
2. The **Draft Editor** opens — the Caption Editor is active as the main focus.
3. Raka chooses:
   - **Write manually** — Raka types the caption directly in the Caption Editor.
   - **Edit a draft from the user's AI** (optional) — a draft can also be prepared by the user's AI through MCP and then edited by Raka here (ADR-138).
4. Raka attaches media through **Media Attachment** — from a local file or the Media Library.
5. Raka chooses one or more destination accounts through the **channel row** above the editor (Channels popover, then avatar chips); the per-platform Preview appears right away on the right (ADR-155).
6. For each selected account, in the network settings block Raka sets the **Content Format** per platform (ADR-039): IG/FB → Post / Reel / Story; Pinterest → Pin (+ pin fields when needed); TikTok & others → Post.
7. Raka sets the publish time through the **Atur jadwal** popover in the footer (30-day limit, the user's time zone with a default of WIB).
8. The Draft Editor shows a summary: caption preview, destination accounts + their respective formats, and the chosen time; the Preview panel stays visible.
9. Raka presses **Schedule** — the content status changes to `Scheduled`.
10. The post appears in the **Calendar** and **Queue** at the time set.

**Outcome:** The content is scheduled and visible in the Calendar and Queue.

---

### Alternate Path — Draft Saved, Not Yet Scheduled

**Condition:** The caption is not final, the media is not ready, or Raka has not decided on a publish time.

1. Raka writes the caption (partially or fully) in the Caption Editor.
2. Raka clicks **Save as Draft** — the post is saved to **Publish → Drafts** with status `Draft`.
3. The post does not appear in the Calendar or Queue.
4. Raka comes back at any time to complete and schedule it.

**Outcome:** The content is saved as a draft, not yet in the schedule queue.

---

### UX Principles

* **UXP-01** — This flow represents the Production → Scheduling stages in one work cycle without context switching to another tool.
* **UXP-04** — The confirmation summary (caption + account + format + time) before scheduling builds trust that the content will go out to the right place and in the right format.

---

---

## UF-02 — Manage the Content Queue

**Goal:** Raka makes sure the scheduled content queue has healthy coverage — no important gaps and no slots that are too crowded.

**Actor:** Raka (primary)

**Trigger:** Raka wants to check or tidy the weekly schedule before or after creating new content.

**Module:** Publishing (Queue, Draft Editor)

---

### Happy Path

1. Raka opens **Publish → Queue**.
2. The Queue shows posts that are **already scheduled** (status `Scheduled`), grouped by date and then by hour, ordered purely by publish time — with no per-item status badge because the whole content of the Queue has a uniform status (ADR-083 amendment, 2026-08-19). `Failed` items do not appear here — they move to **History** as soon as the publish attempt finishes.
3. Raka scans the coverage: seeing whether there is a day with no posts, or a schedule that is too close together for a given account.
4. If there is a gap to fill, Raka directly creates new content through **New Post** (back to UF-01).
5. The Queue updates automatically via a Supabase Realtime granular client-side patch on the `publishing_posts` table (ADR-094 amendment, 2026-08-28) — no longer manual-refresh-only as in the original ADR-023; see also `rendering-strategy.md`.

**Outcome:** The Queue is organized with healthy coverage for the current period.

---

### Alternate Path — Content Rescheduled Back to Draft

**Condition:** Raka finds content that is not ready but already scheduled — for example the caption is not final or the assets changed.

1. Raka presses the **Cancel Schedule** button (red icon) on the Queue item that needs to be pulled — confirmed through a Tier 2 dialog (ADR-049, T-030). No longer by opening the Draft Editor and changing the status manually.
2. The post goes back to status `Draft` — it appears in **Publish → Drafts**.
3. The publish time that was previously filled becomes empty in the Queue and Calendar.
4. Raka finishes the content and schedules it again through UF-01.

**Outcome:** Content that is not ready does not stay in the queue, and that publish time is safe to be filled again by another post.

---

### UX Principles

* **UXP-01** — The Queue is the visual representation of the continuity of Raka's work cycle; seeing a gap here directly triggers the action of creating new content.
* **UXP-04** — **Amended by ADR-083 (2026-08-19):** Publishing Trust in the Queue is now met through homogeneous coverage (the Queue's content always means "will go out as scheduled", not a mix of statuses) plus 3 explicit actions (Publish Now/Edit/Cancel Schedule) that can be executed right from the list — not through a passive status badge as before. Failed posts (`Failed`) move to History, which must still show a clear status per item per UXP-04/UXP-06.

---

---

## UF-03 — Review the Publishing Calendar

**Goal:** Raka makes sure the current week's content schedule is correct. Maya gets a picture of publishing status without having to ask the team.

**Actor:** Raka (planner), Maya (observer)

**Trigger:** The start of the work week, or whenever Raka/Maya wants to see the content schedule picture.

**Module:** Publishing (Calendar)

---

### Happy Path

1. Raka opens **Publish → Calendar** — default view: weekly view.
2. The Calendar shows all content scheduled in the current week, visually distinguished per account and status — **only 3 of the 6 canonical statuses can appear in the grid: `Scheduled`, `Published`, `Failed`** (KSP-02-F02 amendment, UI polish 2026-08-27). `Draft`, `In Review`, and `Ready to Schedule` never appear in the Calendar because they do not yet have a `scheduledAt`/`publishedAt` to plot onto a date/hour cell — items with those statuses remain visible in **Publish → Drafts**.
3. Raka scans the content distribution: which account has the most / the fewest, which days are empty.
4. Raka clicks an item in the Calendar to open the Draft Editor and edit if needed.
5. Maya (in her own session) opens **Home → Today's Schedule** or goes straight to **Publish → Calendar**.
6. Maya sees the same Calendar — reading this week's publishing status without needing any interaction.
7. Maya gets enough of a picture for a team discussion or a content priority decision.

**Outcome:** Raka has a schedule that has been verified. Maya gets status visibility without an extra meeting.

---

### Alternate Path — Post Shows Status Failed

**Condition:** One or more posts in the Calendar failed to publish because the account connection expired or for another reason.

1. Raka sees an item in the Calendar with status `Failed` — clearly visible without having to look for it.
2. Raka clicks the item to read the failure reason (example: "Akun X tidak terhubung").
3. Raka navigates to **Organization Settings → Connected Accounts** to fix the connection problem (see the UF-05 Alternate Path).
4. After the account is reconnected, Raka goes back to the Calendar and reschedules or retries the post.

**Outcome:** The problem is identified and handled directly from the Calendar context, not through a late notification.

---

### UX Principles

* **UXP-02** — The Calendar is the meeting point between Raka's execution mode and Maya's visibility mode on one and the same screen.
* **UXP-04** — The `Failed` status must be visible proactively in the Calendar, not wait for Raka or Maya to ask the system.
* **UXP-03** — The Calendar defaults to weekly view because that is the most relevant unit of work — not a monthly view that hides daily detail.

---

---

## UF-04 — Triage the Engagement Inbox

**Goal:** Raka reads and replies to important audience comments from all connected accounts without having to open the native app for each platform.

**Actor:** Raka (primary)

**Trigger:** Raka opens an engagement work session, receives an internal notification after a comment sync, or wants to fetch the latest comments through a manual refresh.

**Module:** Engagement (Inbox)

---

### Happy Path

1. Raka opens **Engage → Inbox**.
2. The Inbox shows the last sync time and the list of posts that have comments from all connected accounts. Posts with unreplied comments appear first; comments without a post go into the "Tanpa posting" group (KSP-06, ADR-157).
3. If Raka needs the latest data before the next periodic pull schedule, Raka presses **Refresh** and sees the loading state until the sync finishes.
4. Raka filters by account or status (`Belum dibalas / Dibalas / Selesai / Diabaikan`) if the volume is high; the Filter & Sort panel adds platform, order, and date range, with Reset filters to return to the default. Raka can switch to the List view when wanting to see comments as a flat list.
5. Raka chooses a post — its comments appear in the right panel together with the post preview card as the context of the source post.
6. Raka replies to a comment directly from inside the Inbox — without opening the native app. A reply that is sent marks the comment `Dibalas`.
7. For a comment that does not need a reply or is already done, Raka chooses `Resolve` (`Selesai`) or `Dismiss` (`Diabaikan`); both can be reopened. The comment leaves the unreplied count.
8. Raka moves on to the next comment or post.

**Outcome:** Priority comments are handled in one session in the Inbox, without context switching to native apps.

---

### Alternate Path — Sync Finds Comments While Raka Works in Publish

**Condition:** Raka is in a publishing flow (UF-01 or UF-02) when the 30-minute periodic pull finds new comments.

1. After the internal sync finishes, a notification badge appears on the **Engage** item in the primary navigation.
2. Raka finishes the current action in Publish first — no need to interrupt the flow.
3. Once done, Raka switches to **Engage → Inbox**.
4. Posts with new comments (`Belum dibalas`) appear at the top of the post list.
5. Raka handles those comments → `Reply`, `Resolve`, or `Dismiss`.

**Outcome:** Engagement is handled on time without cutting into the publishing flow in progress.

---

### UX Principles

* **UXP-01** — Engage is the natural stage after Publish in one work cycle — the navigation reflects this order.
* **UXP-03** — A centralized Inbox replaces the need to open multiple native apps; this simplicity is the core solution, not an extra feature. Grouping per post keeps the comment context visible during triage.
* **UXP-07 (I-05)** — Engagement is the product's retention layer; a consolidated Inbox encourages Raka to keep using the product after the publishing phase.

**MVP boundary:** This flow covers only comments and replies. Direct Message, mention, and engagement webhooks are not part of the MVP. Data is updated through a 30-minute periodic pull or manual refresh (ADR-040).

---

---

## UF-05 — Connect a Social Account

**Goal:** A social media account is successfully connected to the workspace and ready to be used for publishing.

**Actor:** Raka or Maya (whoever has access to Organization Settings)

**Trigger:** A new workspace is created and has no connected accounts yet, or Raka wants to add a new platform account.

**Module:** Organization Settings (Connected Accounts), Authentication (OAuth)

---

### Happy Path

1. The actor opens **Organization Settings → Connected Accounts**.
2. The actor clicks **Connect Account**.
3. The system shows the list of available platforms (Instagram, Facebook, X, LinkedIn, TikTok, YouTube, Threads, Pinterest).
4. The actor chooses the destination platform.
5. The system opens the platform's OAuth flow — the actor logs in to their platform account and grants permission.
6. The platform sends confirmation to the system.
7. The system returns to **Connected Accounts** — the new account appears with status `Active`.
8. That account is now available in the **Account Selector** in the Draft Editor.

**Outcome:** The social account is connected and ready to be used for publishing.

---

### Alternate Path — Account Token Expired

**Condition:** An account that was connected before loses access because the OAuth token expired or the permission was revoked on the platform.

1. Raka sees a `Disconnected` indicator on the account in the Calendar, Queue, or the Draft Editor Account Selector.
2. The system shows a brief message: account X lost access, needs to reconnect.
3. Raka opens **Organization Settings → Connected Accounts**.
4. The problem account is shown with status `Disconnected` and a **Reconnect** button.
5. Raka clicks **Reconnect** → the OAuth flow is repeated for that account.
6. After success, the account status goes back to `Active`.
7. Posts scheduled for this account do not fail along with it — they stay in the queue and will be sent at their time.

**Outcome:** The account is active again, the publishing pipeline is not disrupted.

---

### UX Principles

* **UXP-04** — The `Disconnected` status on an account must be visible at critical points (Calendar, Queue, Account Selector) — not only in Settings — so the problem is noticed before a post fails.
* **UXP-03** — The OAuth flow follows the platform standard; there are no unnecessary extra steps between the click on "Connect" and the OAuth page.

---

---

## UF-06 — View a Performance Summary

**Goal:** Maya gets a picture of this week's content performance that is enough for deciding the next content direction — without having to gather data manually from native dashboards.

**Actor:** Maya (primary), Raka (secondary — viewing the performance of content he publishes)

**Trigger:** The end or start of the week — Maya starts the weekly review.

**Module:** Analytics (Dashboard), Home

---

### Happy Path

1. Maya opens **Home** — the **Analytics Snapshot** on the Home screen shows this week's performance highlights: total posts, total reach, overall engagement rate.
2. Maya decides she wants to see more detail — clicks the **Analytics Snapshot** or navigates directly to **Analyze → Dashboard**.
3. The Dashboard shows:
   - **Account Overview** — performance per connected social account.
   - **Post Performance** — metrics per post (reach, engagement, clicks if available).
   - **Engagement Summary** — total interactions in the selected period.
4. Maya filters per account or changes the time range (this week, this month).
5. Maya sees which posts produced the best engagement — shaping the decision on the next content direction.
6. Maya discusses these insights with Raka in the weekly sync — no formal report export is needed in the MVP.

**Outcome:** Maya gets a performance summary that is enough for weekly decisions in a few minutes — without manual compilation.

---

### Alternate Path — No Data Yet (Empty State)

**Condition:** A new workspace or no content has ever been published through the product.

1. Maya or Raka opens **Analyze → Dashboard**.
2. The Dashboard shows an **empty state** with the message: _"Belum ada data. Hubungkan akun sosial dan mulai publish konten untuk melihat performa."_
3. The empty state includes direct links to two actions:
   - **Connect Account** → leads to Organization Settings → Connected Accounts (UF-05).
   - **Create First Post** → leads to Publish → Drafts → New Post (UF-01).
4. No empty numbers or charts without data are shown.

**Outcome:** The empty state is communicative — users know what to do next, there is no dead end.

---

### UX Principles

* **UXP-02** — Analyze is Maya's main work screen in visibility mode; she must be able to read a meaningful summary without layered navigation.
* **UXP-03** — The Analytics Snapshot on Home is the first shortcut — Maya does not have to go into Analyze to get a quick picture.
* **I-05** — Analytics is a retention layer; its value appears after Raka builds a consistent publishing rhythm.

---

---

# Flow Summary

| ID | Flow | Main Trigger | Outcome |
| -- | ---- | ------------ | ------- |
| UF-01 | Create and Schedule Content | Raka creates a new post | Post scheduled in the Calendar and Queue |
| UF-02 | Manage the Content Queue | Raka reviews the weekly queue | The Queue is covered and organized |
| UF-03 | Review the Publishing Calendar | Raka verifies the schedule; Maya needs an overview | Raka confirms the schedule; Maya has visibility |
| UF-04 | Triage the Engagement Inbox | Raka engagement session or incoming notification | Priority interactions handled without native apps |
| UF-05 | Connect a Social Account | New workspace or expired token | Account active and ready for publishing |
| UF-06 | View a Performance Summary | Maya's weekly review | Maya gets a decision on the next content direction |

---

# Relationships Between Flows

```text
UF-05 (Connect Account)
    ↓
UF-01 (Create & Schedule Post)  ←→  UF-02 (Manage Queue)
    ↓                                      ↓
UF-03 (Review Calendar) ←─────────────────┘
    ↓
UF-04 (Triage Inbox)
    ↓
UF-06 (View Performance)  ←── Maya entry point from Home
```

This cycle reflects **UXP-01**: Draft → Schedule → Publish → Engage → Review is one cycle, not a collection of separate features.

---

# Documented UX Decisions

| ID | Decision | Principle | Impact |
| -- | -------- | --------- | ------ |
| UXD-01 | ~~AI Caption is accessed from inside the Caption Editor — not a separate menu or screen~~ — **Removed by ADR-138** (the built-in AI was removed; the user's AI works through MCP) | UXP-06, I-06 | ~~AI does not add new navigation; it speeds up the existing flow~~ |
| UXD-02 | The `Failed` and `Disconnected` statuses are visible in the Calendar and Queue — not only in Settings | UXP-04 | Problems are detected before a publish fails |
| UXD-03 | The Analytics empty state gives two action links, not just an informational message | UXP-03 | Users do not get stuck; dead ends are removed |
| UXD-04 | Maya and Raka share the same Calendar — not separate views | UXP-02 | Visibility without overhead: one Calendar serves two needs |

---

# Evaluated Assumptions

| ID | Assumption | Evaluation |
| -- | ---------- | ---------- |
| A-05 | Publishing is the core job | UF-01 and UF-02 are the longest and most complex flows — supporting this assumption |
| A-07 | AI is useful if it enters the workflow | The user's AI works through MCP outside Postific's writing flow (ADR-138); UF-01 still runs without a built-in AI, and a draft from AI only needs to be edited by Raka in the Caption Editor |
| A-02 | Buyer ≠ daily user | UF-03 and UF-06 are designed so that Maya gets value without having to follow Raka's flow |

---

# Related Documents

* `ux-principles.md`
* `information-architecture.md`
* `navigation-patterns.md` ← next document
* `key-screen-patterns.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-modules.md`
* `../../project-os/DECISIONS.md`
* `../../project-os/PROJECT_STATE.md`
