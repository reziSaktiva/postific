# Key Screen Patterns

This document defines the **critical-function patterns on the key screens** of the **Postific** product.

Key Screen Patterns are built on top of the Information Architecture, User Flows, and Navigation Patterns already set. This document does not define visual layout, wireframes, or code — it explains **what functions must exist**, **how the functional zones are arranged**, **what states must be handled**, and **what behavior patterns apply** on each critical screen.

---

# Overview

This document covers 8 critical screens that form the core of user interaction:

| ID | Screen | Primary User |
| -- | ------ | ------------ |
| KSP-01 | Home | Maya |
| KSP-02 | Publish — Calendar | Raka + Maya |
| KSP-03 | Publish — Queue | Raka |
| KSP-04 | Publish — Drafts | Raka |
| KSP-05 | Publish — Draft Editor | Raka |
| KSP-06 | Engage — Inbox | Raka |
| KSP-07 | Analyze — Dashboard | Maya + Raka |
| KSP-08 | Settings — Organization — Connected Accounts | Raka / Maya |

Screens not listed (History, Start Page, Settings → Account) are not daily critical screens — their patterns are simpler and do not need in-depth documentation in this phase.

**v0.5 addition (MCP, ADR-138, ADR-139):** two new screens (KSP-09 OAuth Consent, KSP-10 Settings → Account → Klien AI) and one cross-screen pattern (MCP Source Badge and Filter) are recorded in the *MCP Screens and Patterns* section after KSP-08. The list of 8 critical screens above does not change.

---

# How to Read This Document

Each screen has this structure:

* **Identity** — the screen path, primary user, entry points, and relevant UX Principles.
* **Goal** — what the user must be able to do successfully after using this screen.
* **Critical Functions** — functions that must exist; identified with a unique ID.
* **Functional Zones** — logical grouping of areas in the screen (not visual layout).
* **State Handling** — screen conditions that must be handled: default, loading, empty, error.
* **Decision Log per Screen** — design decisions specific to this screen.

---

# Key Screen Patterns

---

## KSP-01 — Home

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Home` |
| Primary User | Maya (visibility mode) |
| Secondary User | Raka (initial orientation) |
| Entry Points | Login → Home; Sidebar → Home |
| UX Principles | UXP-02, UXP-03, UXP-07 |

### Goal

Home is an orientation screen — Maya can scan publishing, engagement, and performance status on one screen without needing to enter a work section. Raka can see the day's condition before going into Publish.

Home is **not** a work screen. No heavy action is completed from here.

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-01-F01 | Today's Schedule | List of content scheduled for today, per account, with status | UXP-02, UXP-04 |
| KSP-01-F02 | Recent Activity | History of the latest actions: posts successfully published, failed posts, disconnected accounts | UXP-04, UXP-06 |
| KSP-01-F03 | Engagement Snapshot | Number of unread comments (last 12 months, the same as the Engage default Date Range, ADR-157) from the last sync — nudges Raka toward Engage | UXP-07 |
| KSP-01-F04 | Analytics Snapshot | This week's performance highlights: total posts, total reach, engagement rate | UXP-02, UXP-07 |
| KSP-01-F05 | Deep Link to Section | Every item/snapshot can be clicked and takes the user to the relevant screen | UXP-01 |

---

### Functional Zones

Home is divided into four zones arranged vertically:

```
┌──────────────────────────────────────────────┐
│  TODAY'S SCHEDULE                            │
│  content scheduled today per account + status│
├──────────────────────────────────────────────┤
│  RECENT ACTIVITY                             │
│  latest actions: publish success / failed    │
├──────────────────────────────────────────────┤
│  ENGAGEMENT SNAPSHOT    │  ANALYTICS SNAPSHOT│
│  unread comments        │  total posts, reach│
└──────────────────────────────────────────────┘
```

**Zone order:** Today's Schedule is placed on top because it is the most time-sensitive. Analytics Snapshot is below — it is the "retention layer" viewed after operational needs are met (UXP-07).

---

### State Handling

| State | Display |
| ----- | ------- |
| Default (has data) | All zones filled with actual data |
| No schedule today | Today's Schedule: _"Tidak ada jadwal untuk hari ini"_ + CTA to Publish → Calendar |
| No recent activity | Recent Activity: hidden empty or a short message |
| Empty inbox | Engagement Snapshot: _"0 komentar unread"_ — still shown, not hidden |
| No analytics data yet | Analytics Snapshot: _"Belum ada data"_ + CTA to Analyze |
| There is a failed post today | Recent Activity shows the Failed item with a visual highlight that sets it apart |

---

### Pattern: Deep Link from Home

Every clickable element on Home takes the user to a specific screen:

```
Today's Schedule → item clicked → Publish → Calendar → Draft Editor (item)
Recent Activity  → Failed item  → Publish → Calendar (Failed item highlighted)
Engagement Snapshot → click      → Engage → Inbox
Analytics Snapshot  → click      → Analyze → Dashboard
```

Users do not finish work on Home — they are directed to the right work screen.

---

---

## KSP-02 — Publish — Calendar

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Publish → Calendar` |
| Primary User | Raka (schedule verification, quick edits) |
| Secondary User | Maya (schedule visibility without interaction) |
| Entry Points | Sidebar → Publish (default tab); Home → Today's Schedule |
| UX Principles | UXP-02, UXP-03, UXP-04, UXP-06 |

### Goal

The Calendar is the **default view** when users enter Publish. This screen gives a visual picture of the content schedule for the current period and is the meeting point between Raka's execution needs and Maya's visibility needs.

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-02-F01 | Weekly View Default | The Calendar shows all scheduled content in the current week's range | UXP-02, UXP-03 |
| KSP-02-F02 | Visual Status per Item | **Updated (UI polish, 2026-08-27) — only 3 of the 6 statuses can appear in the grid**: Scheduled, Published, Failed. Draft/In Review/Ready to Schedule items never appear in the Calendar because they do not yet have a `scheduledAt`/`publishedAt` to plot onto a date/hour cell (consistent since T-033.1) — so it does not "show the status" of those other 3, they simply never have a row to show. The status filter dropdown (KSP-02-F09) still shows all 6 options for consistency with the Queue, even though choosing Draft/In Review/Ready to Schedule always yields an empty grid. Visual representation: `Badge` on screens >768px, `StatusDot` (a colored dot, no text label — detail via tap→Popover KSP-02-F08) on screens ≤768px because `Badge` has no size control and overflows in narrow columns | UXP-04, UXP-06 |
| KSP-02-F03 | Account Identity per Item | Each item shows the identity of the destination account (platform + account name) | UXP-04 |
| KSP-02-F10 | Content Type Indicator | **New (UI polish, 2026-08-27).** Each item shows a content type indicator — Post/Reel/Story/Pin — from the `contentFormat` field that already exists in the domain model (`CalendarItemTargetRecord`, not a new field). Representation: `Badge` on screens >768px, a compact icon on screens ≤768px (same breakpoint pattern as KSP-02-F02) | UXP-04 |
| KSP-02-F04 | Click Item → Popover → Draft Editor | ~~Clicking an item opens the Draft Editor directly~~ — **Amended by ADR-090, component corrected by ADR-091**: clicking an item opens a `Popover` (KSP-02-F08) first; a CTA inside the Popover opens the Draft Editor. Applies to the Calendar only — Queue and Drafts remain click → straight to the Draft Editor (unchanged) | UXP-01 |
| KSP-02-F05 | Change Period | Users move to another week/month through the Today button, ‹ › (prev/next) navigation, and the Week/Month view toggle. The period label adjusts (e.g. "14–20 Jul" for a week within 1 month, "28 Jul – 3 Ags" when the week spans 2 months; "Agustus 2026" for the month view). The period state (`view=week\|month`, `date=<timestamp>`) is carried through query params on the single route `/publish/calendar` (adds no new route, consistent with ADR-046) | UXP-03 |
| KSP-02-F06 | Prominent Failed Status | Items with status Failed are shown with a different visual and cannot be ignored | UXP-04 |
| KSP-02-F07 | Disconnected Account Warning | If the account in an item has status Disconnected, a warning indicator is shown on that item | UXP-04, UXP-06 |
| KSP-02-F08 | Post Summary Popover | **New (ADR-090, component corrected by ADR-091: Popover, not HoverCard — click trigger, has a controlled `isOpen`, the CTA is safe inside it).** Clicking a Calendar item opens a `Popover` (anatomy: Header + Body + Trigger) containing: avatar + account name, platform, caption snippet, media thumbnail (if any), status chip (reuse KSP-02-F02). For posts that are already Published, add a metrics section (Views→`impressions`, Reach→`reach`, Replies→`comments`, Eng. Rate→`engagementRate` — existing `PostMetrics` fields, no new fields) + a "Go to post" link. The CTA inside the Popover opens the Draft Editor (modal, ADR-052) for that item | UXP-01, UXP-04 |
| KSP-02-F09 | Status & Channel Filter | A post status filter dropdown ("All Posts" / per status) and an account filter (Channels) above the grid. The Tags and per-view Timezone filters from the Buffer reference are **not adopted** (there is no Tag concept in the domain model; Timezone is not a per-view setting in the backlog — consistent with decision T-032.0 for the Queue) | UXP-03 |

---

### Functional Zones

```
┌──────────────────────────────────────────────────────────┐
│  [Tab: Calendar] [Queue] [Drafts] [History]               │
├──────────────────────────────────────────────────────────┤
│  [Today] [‹ ›] Agustus 2026        [Channels▾][Status▾] [Minggu/Bulan▾] │
├────────┬──────┬──────┬──────┬──────┬──────┬──────────────┤
│  Sen   │ Sel  │ Rab  │ Kam  │ Jum  │ Sab  │ Ming         │
│        │      │      │      │      │      │              │
│ [item] │      │[item]│      │[item]│      │              │
│        │      │[item]│      │      │      │              │
├────────┴──────┴──────┴──────┴──────┴──────┴──────────────┤
│  [+ New Post]                                             │
└──────────────────────────────────────────────────────────┘
  Week view: grid per day × hour (time rows, e.g. 12 AM/2 AM/.../10 PM).
  Month view: grid per day × full dates of 1 month; cells with >3 items
  use an "N More" badge (expand, no silent overflow); today's date
  is marked with a round badge (not an underline as in the Week view).
```

**Tab bar zone:** The Calendar, Queue, Drafts, History tabs are always visible at the top.

**Period control zone:** The Today button, ‹ › (prev/next) navigation, period label, Channels + Status filters, Week/Month toggle. Default: the current week (KSP-02-F01), state in query params (KSP-02-F05).

**Grid zone:** Week view = a grid of days × hour slots. Month view = a grid of days × the full dates of the month with "N More" for crowded cells. Each item shows the account thumbnail and status (KSP-02-F02); content type indicator (KSP-02-F10). **Caption snippet only in the Week view** — the Month view (UI polish, 2026-08-27) deliberately does not show the caption because 1 cell can hold many items at once, with space prioritized for avatar+name+time+status. Clicking an item opens the Popover (KSP-02-F08). The grid also has vertical divider lines between day columns (a color matching the Card border, softer than the horizontal lines between rows/slots) — UI polish, 2026-08-27.

**New Post zone:** The CTA stays available to create new content right away.

---

### State Handling

| State | Display |
| ----- | ------- |
| Has scheduled content | The grid is filled with items per time slot (Week) or date (Month) |
| No content this week/month | **Updated (UI polish, 2026-08-27)** — the grid, day headers, and date/hour labels **are still shown in full as usual**, NOT replaced by any message/placeholder. Cells with no items simply show the date number/empty hour label (this behavior already applied to individual empty cells, and now applies the same way when the ENTIRE period is empty) — reversing the earlier T-033.6 decision that had added an `EmptyState` here |
| Failed item | The item is shown with a different visual (a special color or icon) — not hidden |
| Disconnected account | A warning indicator on the affected item + a link to Settings |
| Item loading | A skeleton per item while data is loading |
| Month view cell >3 items | Show at most the number of items per the final design + an "N More" badge to expand — must not silently truncate without an indicator |
| Click item | The Popover opens (KSP-02-F08); metrics only shown for Published posts |

---

---

## KSP-03 — Publish — Queue

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Publish → Queue` |
| Primary User | Raka |
| Entry Points | Queue tab within Publish |
| UX Principles | UXP-01, UXP-04, UXP-05, UXP-06 |

### Goal

The Queue shows content that is **already scheduled** (status `Scheduled`), grouped by date and then by hour, ordered purely by publish time — Raka scans forward schedule coverage and identifies gaps quickly. Items that failed to publish (`Failed`) are no longer shown here — as soon as the publish attempt finishes, the item moves to **History** (a KSP outside the 8 critical screens, T-034), which still shows heterogeneous status per item.

**Amendment 2026-08-19 (ADR-083):** the scope of this screen was deliberately narrowed from the original design — the Queue is now purely a "linear queue by publish time" (uniform Scheduled status), not a mixed list of various statuses with manual ordering ability. This change was made after King Rezi asked for alignment with the Buffer pattern (`publish.buffer.com/schedule`).

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-03-F01 | Ordered Content List | All scheduled posts are shown ordered by publish time, grouped by date and then by hour | UXP-01 |
| KSP-03-F02 | ~~Status per Item~~ — **Overridden by F07 (ADR-083, 2026-08-19)**. Original reason: a screen of mixed statuses (Scheduled/Failed/Draft/etc.) needed a badge so each item could be told apart. It was decided to narrow the Queue's scope to only `Scheduled` (uniform) — a badge becomes unnecessary. `Failed` moves to History (T-034), `Draft`/`Ready to Schedule` stay in Drafts (T-022, which already shows heterogeneous status there) | UXP-04, UXP-06 (met through homogeneous coverage + explicit actions F07, not a status badge) |
| KSP-03-F03 | Filter per Account | Users can filter the view to one specific account — a small control, right-aligned, on a row separate from the page title | UXP-03 |
| KSP-03-F04 | Click Item → Draft Editor | Clicking a card opens the Draft Editor (Edit mode) for that item | UXP-01 |
| KSP-03-F05 | ~~Reorder Item~~ — **Overridden by F01 (ADR-083, 2026-08-19)**, with no new replacement ID. Original reason: the order was thought to need manual arrangement, independent of time. It was decided that a pure `scheduledAt` ascending order (F01) is enough; moving a schedule means editing `scheduledAt` through the Draft Editor (F04), not rearranging the display order | — |
| KSP-03-F06 | New Post from Queue | The New Post CTA is available directly from the Queue — aligned with the page title (`justify-between` with title/subtitle), not on the filter row | UXP-01 |
| KSP-03-F07 | Explicit actions per item (ADR-083) | 3 icon buttons per card: **Publish Now** (reuse KSP-05-F12), **Edit** (open the Draft Editor, same as F04), **Cancel Schedule** (red icon, Tier 2 confirmation dialog — T-030, ADR-049) — replacing the combination of status badge + generic click | UXP-01, UXP-04 |
| KSP-03-F08 | MCP Source Filter and Badge | A source filter (Semua / Dibuat manual / Lewat MCP, default Semua) beside the account filter; items created through MCP show an AI client name badge on the meta row. Details: *Pattern: MCP Source Badge and Filter* | UXP-04, UXP-05, UXP-06 |

---

### Functional Zones

```
┌──────────────────────────────────────────────────┐
│  Publish                              [+ New Post]│
│  Antrean linear berdasarkan waktu publish          │
├──────────────────────────────────────────────────┤
│  [Tab: Calendar] [Queue] [Drafts] [History]       │
├──────────────────────────────────────────────────┤
│                                [Semua Akun ▼]     │
├──────────────────────────────────────────────────┤
│  Senin, 14 Juli                                    │
│  ┌────────────────────────────────────────────┐  │
│  │ 10:00 · Instagram   Caption preview...       │  │
│  │                        [Publish][Edit][✕]    │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  Selasa, 15 Juli                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ 09:00 · Facebook    Caption preview...       │  │
│  │                        [Publish][Edit][✕]    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Title zone:** Title + the subtitle "Antrean linear berdasarkan waktu publish" on the left, New Post on the right (`justify-between`).

**Filter zone:** A separate row below the tabs, a small right-aligned account filter (followed by the MCP source filter, F08) — not merged with the New Post CTA.

**List zone:** Grouped by date (heading), then by hour within it. Each item = its own `Card` (not one card covering the whole list), containing the time, platform + account name, caption snippet, and 3 action buttons (F07). No status badge.

---

### State Handling

| State | Display |
| ----- | ------- |
| Has scheduled content | A card per item, grouped by date |
| Empty queue | _"Tidak ada konten terjadwal"_ + New Post CTA |
| Active filter — no items | _"Tidak ada konten untuk akun ini"_ |
| Source filter "Lewat MCP" — no items | _"Belum ada konten dari klien AI"_ + a Tampilkan Semua button |

`Failed` items **do not appear** in any state on this screen (ADR-083 amendment) — see History (T-034) for the publish failure state.

---

---

## KSP-04 — Publish — Drafts

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Publish → Drafts` |
| Primary User | Raka |
| Entry Points | Drafts tab within Publish; Empty state in Queue/Calendar (New Post CTA) |
| UX Principles | UXP-01, UXP-03, UXP-05, UXP-06 |

### Goal

Drafts is where Raka stores and accesses content that is not yet scheduled — both newly created content and content deliberately pulled back from the Queue.

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-04-F01 | Draft List | All drafts not yet scheduled, ordered by last edited time | UXP-06 |
| KSP-04-F02 | Status per Item | The status of each item: Draft, In Review, Ready to Schedule | UXP-06 |
| KSP-04-F03 | Click Item → Draft Editor | Clicking an item opens the Draft Editor to continue working | UXP-01 |
| KSP-04-F04 | New Post | A CTA to create a new draft, directly opening an empty Draft Editor | UXP-01 |
| KSP-04-F05 | Filter / Sort | Users can filter or sort drafts (optional for MVP) | UXP-03 |
| KSP-04-F06 | MCP Source Filter and Badge | A source filter (Semua / Dibuat manual / Lewat MCP, default Semua) above the list — the first filter control on this screen; drafts created through MCP show an AI client name badge on the meta row. Details: *Pattern: MCP Source Badge and Filter* | UXP-04, UXP-05, UXP-06 |

---

### Functional Zones

```
┌──────────────────────────────────────────────────┐
│  [Tab: Calendar] [Queue] [Drafts] [History]       │
├──────────────────────────────────────────────────┤
│                                    [+ New Post]  │
├──────────────────────────────────────────────────┤
│  Caption preview...                      Draft   │
│  Diedit 2 jam lalu                           [>] │
├──────────────────────────────────────────────────┤
│  Caption preview...              Ready to Schedule│
│  Diedit kemarin                              [>] │
├──────────────────────────────────────────────────┤
│  Caption preview...                      Draft   │
│  Diedit 3 hari lalu                          [>] │
└──────────────────────────────────────────────────┘
```

**CTA zone:** New Post on top — the fastest access to create new content.

**List zone:** Each item shows a caption snippet, last edited time, and status.

---

### State Handling

| State | Display |
| ----- | ------- |
| Has drafts | A list of items ordered by edit time |
| No drafts | _"Belum ada draft"_ + New Post CTA |
| Source filter "Lewat MCP" — no items | _"Belum ada konten dari klien AI"_ + a Tampilkan Semua button |

---

---

## KSP-05 — Publish — Draft Editor

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Publish → Drafts → Draft Editor` (opened as a modal, not a separate route — ADR-052). The final Dialog variant since ADR-065 (Standard default, Fullscreen via toggle) — see the Note below |
| Primary User | Raka |
| Entry Points | New Post; Click an item from Calendar / Queue / Drafts; Quick Compose from the Channels sidebar (account automatically pre-selected, NP-D14) |
| UX Principles | UXP-01, UXP-03, UXP-04, UXP-06 |

### Goal

The Draft Editor is the **most important work screen** in the product. Raka writes, completes, and schedules content from this screen. Everything needed to finish one piece of content is available here without switching screens.

**Note (ADR-052):** The Draft Editor is now opened as a modal on top of whichever Publish sub-screen is active — not a full panel/screen with its own route (overriding NP-D02, see NP-D11 in `navigation-patterns.md`). Applies to New Post and Edit Draft.

**Dialog variant — final since ADR-065.** The toggle in the modal header (aligned with the status chip, to the left of the Close button) stays as an official product feature, with these defaults:
- **`standard` (default, ADR-065):** a large floating card with a dark backdrop — the screen behind (including the sidebar) stays visible, dimmed.
- **`fullscreen` (alternative via toggle):** covers the whole viewport — the navigation sidebar & Calendar/Queue/Drafts are fully covered while the modal is open. It has no visible dark backdrop (there is nothing behind to darken).

Not persisted between sessions (session-only), the same as the Light/Dark Mode Toggle pattern (ADR-055).

**Redesign Stage 1 — final since ADR-155 (design confirmed by King Rezi, 2026-11-03):** the layout follows the Buffer Create Post modal pattern (pattern and behavior, not a copy), built from shadcn/ui components and Postific tokens. The channel row moves above the editor, the per-platform live Preview is in the right zone, per-network settings take the form of accordion blocks, and the schedule and actions are in the footer. The `standard` card width rises from 960px to 1120px. One caption and one set of media are shared by all networks (per-network caption and media are outside Stage 1). Visual design: the Postific Design Review gallery, entry "Draft Editor: redesain pola Buffer (ADR-155)".

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-05-F01 | Caption Editor | The main writing area for the content caption — becomes the focus when the screen opens | UXP-01, UXP-03 |
| KSP-05-F02 | ~~AI Caption Assist~~ — **Removed by ADR-138**. Postific's built-in AI was removed; the user's AI creates drafts through MCP, not through a trigger in the Caption Editor. The ID is not reused | — |
| KSP-05-F03 | Media Attachment | Attach images or video from a local device or the Media Library | UXP-01 |
| KSP-05-F04 | Account Selector | The channel row above the editor (ADR-155): the Channels button opens a popover (search, "Pilih semua", a checkbox list with avatars, platform badges, and connection status, a "Hubungkan akun" link), plus the shortcuts "Terakhir dipakai" and "Semua". Once chosen, the row collapses into avatar chips (a remove action per chip) and an "Tambah akun" button. Disconnected accounts are still shown with a warning and a Reconnect action, and are not blocked in the UI | UXP-04 |
| KSP-05-F05 | Schedule Picker | The "Atur jadwal" button in the footer opens a popover: a calendar (past days and days more than 30 days ahead are disabled, ADR-154), a time input, and the user's time zone label (default WIB, ADR-146); once filled, the button shows the chosen schedule. There is no "Next Available" in Stage 1 (ADR-155) | UXP-04 |
| KSP-05-F06 | Confirmation Summary | A summary: caption preview, destination accounts, **format per account**, time — shown before Schedule is executed. The Preview panel stays visible while the summary shows (ADR-155) | UXP-04 |
| KSP-05-F07 | Status Indicator | The current draft status: Draft, In Review, Ready to Schedule, Scheduled, Published, Failed — always visible | UXP-06 |
| KSP-05-F08 | Save as Draft | Save progress without scheduling. Once saved, the modal closes and the user is directed to **Publish → Drafts** — regardless of which section the modal was opened from (ADR-054) | UXP-01 |
| KSP-05-F09 | Schedule Action | Execute the scheduling after the user confirms (Confirmation Summary, KSP-05-F06). After success, the modal closes and the user is directed to **Publish → Queue** — regardless of which section the modal was opened from (ADR-054) | UXP-04 |
| KSP-05-F10 | Close Modal | The Close button in the modal header closes the Draft Editor, returning to the source sub-screen (Calendar / Queue / Drafts) without URL navigation. For **New Post**, unsaved form state persists via localStorage (see KSP-05-F13). For **Edit Draft**, there is no resume mechanism — unsaved changes are lost when the modal is closed (ADR-052) | UXP-03 |
| KSP-05-F11 | Content Format Selector | Choose the publishing format **per selected account** according to the platform (ADR-039) inside the network settings block: IG/FB → Post / Reel / Story; Pinterest → Pin (+ pin fields); TikTok & others → Post (without a Reel/Story radio). Options that are not valid for the media are disabled: Reel is disabled when the media is not video (ADR-155, amending ADR-154) | UXP-01, UXP-03 |
| KSP-05-F12 | Publish Now Action | Execute an immediate publish without a schedule (skipping the Schedule Picker) — available alongside the Schedule Action in the action bar, for all roles: Account Owner, Admin, Creator (ADR-047, ADR-074). After success, the modal closes and the user is directed to **Publish → History** — because History is not yet a documented screen (KSP-D10), the temporary destination is **Publish → Calendar** until that screen is built (ADR-054) | UXP-04, UXP-06 |
| KSP-05-F13 | Resume Unfinished Post (New Post only) | When the **New Post** modal is opened and unsaved state is found in localStorage from a previous session, show a confirmation dialog "Resume unfinished post?" with two choices: **Resume** (continue the form contents from the saved state) or **Mulai Baru** (discard the old state, empty form). **Does not apply to Edit Draft** — an existing draft is always opened with data from the server, with no localStorage check (ADR-052) | UXP-03, UXP-04 |
| KSP-05-F14 | Live Preview | The right panel shows a per-platform preview that updates while typing and when choosing accounts or blocks: Facebook, Instagram, TikTok, and Pinterest imitate the platform's look (assembled from Postific components and tokens, ADR-155), other platforms use a generic card. Platform icons (in the picker, chips, list, avatar badges) use the official brand-kit logo when the size meets the brand minimum (Facebook 16 px wide, LinkedIn 21 px tall), otherwise the old glyph; Instagram monochrome, no profile link; X, Pinterest, TikTok stay the old glyph until the official assets exist (T-209.3, gallery design "Ikon platform resmi", confirmed by King Rezi 2026-11-12). The "Simpan" pill on the Pinterest pin card uses a neutral primary color, not Pinterest's brand red (T-209.4, 2026-11-12). With more than one account selected, the per-account Preview picker is a dropdown (shadcn `Select`, ADR-156) with a platform icon and handle in each option, not tabs; the panel title shows the platform and format of the active account. The Preview toggle in the header shows or hides the panel; there is an empty state when no account is selected yet; with an account that has no content, the card shows with a caption placeholder | UXP-04 |
| KSP-05-F15 | Per-Network Settings Block | Each selected account has an accordion-shaped block (one block open, the others collapse into a summary row containing the platform icon, caption snippet, and media thumbnail). Block contents: format (F11), the platform-specific fields already supported (Pinterest: board, title, link), and the validation banner (F16). When only one account is selected, the block is always open without an accordion. The caption and media stay one and shared for all networks | UXP-01, UXP-03 |
| KSP-05-F16 | Inline Validation | Validation banners appear near the source of the problem: per-network validation (media required, Pinterest board, Reel needs video) inside the network block; cross-network validation (Story + caption mix, more than one Pinterest account) above the editor; schedule validation (outside the 30-day limit) in the footer near the schedule control. Schedule and Publish Now are disabled until valid (ADR-107, ADR-121, ADR-154, ADR-155). All Draft Editor banners use a warning icon to the left of the text: all validation violations block Schedule and Publish Now; color is a design choice, not a marker of blocking: Reel is not a video, Pinterest board not yet chosen, cross-network messages, the schedule limit message in the footer, action-result errors, and errors in the Confirmation Summary are destructive-colored; "no media" (still blocking) and a disconnected account are warning-colored (yellow), design T-250 (confirmed by King Rezi 2026-11-12) | UXP-04 |

---

### Functional Zones

The Draft Editor is divided into two main zones, left (Channel + Editor + Network Blocks) and right (Preview), with an action footer below them (ADR-155):

The layout below is rendered inside the modal (ADR-052, default `variant="standard"` 1120px wide since ADR-065 and ADR-155, alternative `variant="fullscreen"` via toggle — see the Note in Identity) — not its own route page. The modal header shows the title, status chip, Preview toggle, variant toggle, and Close button, not "← Kembali".

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Draft Editor  [Status ▼]         [Pratinjau]  [⤢ Fullscreen]  [✕ Close] │
├───────────────────────────────────────────┬─────────────────────────────┤
│  CHANNEL ROW                              │  PREVIEW                    │
│  [+ Channels] [Terakhir dipakai] [Semua]  │  (live per platform)        │
│  once chosen: (IG) (FB) [+ Tambah]        │                             │
│                                           │  Facebook                   │
│  EDITOR                                   │  ┌───────────────────────┐  │
│  [Tulis caption di sini...]               │  │ avatar  nama          │  │
│  [thumbnail media] [+ dropzone]           │  │ caption               │  │
│                                           │  │ media                 │  │
│  BLOCK PER NETWORK (accordion)            │  └───────────────────────┘  │
│  ▼ Instagram   ○ Post ○ Reel ○ Story      │  Instagram                  │
│    ⚠ Validation banner                    │  ┌───────────────────────┐  │
│  ▶ Facebook    "caption…"  [thumb]        │  │ ...                   │  │
│  ▶ Pinterest   board / judul / link       │  └───────────────────────┘  │
├───────────────────────────────────────────┴─────────────────────────────┤
│  [Save as Draft]            [Atur jadwal ▼]  [Publish Now]  [Schedule]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Left zone — Channel Row:** Above the editor. The Channels button opens an account selection popover with connection status; the shortcuts "Terakhir dipakai" and "Semua" speed up selection; chosen accounts show as avatar chips (F04).

**Left zone — Caption Editor:** The main area that becomes the focus when the screen opens. One caption shared by all networks. Large, can expand.

**Left zone — Media Attachment:** Below the Caption Editor. Thumbnails of attached media and a dropzone that stays available to add media. Media requirements adjust to the format chosen per network (e.g. Story/Reel needs vertical media, Reel needs video). Media is shared by all networks.

**Left zone — Per-Network Settings Block:** Below the media. One block per selected account in accordion form (F15): the Post / Reel / Story format (F11), Pinterest fields (board, title, link), and the validation banner (F16). Meta accounts (IG/FB) have a Post / Reel / Story selector; Pinterest shows Pin fields; TikTok & other platforms have no Reel/Story radio. A Disconnected account shows a warning.

**Right zone — Preview:** A live per-platform preview panel (F14). Choosing a block or account chip switches the preview to that platform.

**Footer — Actions:** Save as Draft (secondary action), the "Atur jadwal" schedule control (F05), Publish Now, and Schedule. Schedule is the primary action; Save as Draft is the secondary action.

**Narrow screen (below 640px):** The modal fills the screen with an "Editor | Pratinjau" tab below the header, the footer stacked, and the Fullscreen/Standard and Preview toggles in the header hidden (ADR-155).

---

Note (ADR-052/ADR-065): users can switch between the two variants through the official toggle in the modal header (a product feature, no longer a temporary comparison tool). In the `standard` variant (**default since ADR-065**), the sidebar and the screen behind stay visible, dimmed behind the backdrop. In the `fullscreen` variant (alternative, chosen via the toggle), the navigation sidebar is **fully covered** while the modal is open (a conscious trade-off, see NP-D11) — different from the earlier version where the sidebar stayed visible. The toggle choice is not persisted — it resets to Standard each time the modal is reopened. The `standard` card width is 1120px (ADR-155).

---

### Pattern: Account Selector with Status

```
The Account Selector shows all connected accounts:

  ✅ Instagram @brandname      (Active)
  ✅ X @brandname              (Active)
  ⚠️  LinkedIn @brandname      (Disconnected) → [Reconnect]
  ✅ Facebook @brandname       (Active)
```

Disconnected accounts are still shown — not hidden. Users see the problem at the critical point (when choosing an account), not after it has been scheduled. (UXP-04)

Clicking the **Reconnect** link takes the user to KSP-08.

In the ADR-155 layout this list appears in the Channels popover (a checkbox list with connection status). A Disconnected account can still be checked with a warning and a Reconnect action, and Schedule/Publish Now are not blocked in the UI (following current behavior).

---

### Pattern: Confirmation Summary before Schedule / Publish Now

Before the Schedule button **or Publish Now** (KSP-05-F12, ADR-047) is executed, users see a confirmation summary:

```
Konfirmasi Jadwal:
  Caption: "Selamat pagi! Hari ini kami..."
  Akun:
    · Instagram @brandname — Reel
    · Facebook @brandname — Post
    · X @brandname — Post
  Waktu: Senin, 14 Jul 2025 — 10:00 WIB
  
  [Batal]   [Konfirmasi & Jadwalkan]
```

For Publish Now, the "Waktu" row changes to "Sekarang" and the button becomes "Konfirmasi & Publish" — the summary structure stays the same, only emphasizing that this action goes live immediately without a correction window like `cancelSchedule` on Schedule.

This Confirmation Summary is the **most complete** confirmation pattern documented in the product — used specifically for the two actions that publish content: Schedule and Publish Now (UXP-04). Disconnect Account has its own, more compact confirmation pattern (KSP-08-F07, ADR-048) because it is not a publish action. Other actions (Save as Draft, Remove Member, Transfer Ownership, Delete Workspace, etc.) still have no confirmation specification at all. The format per account must be visible so a Story/Reel is not scheduled wrongly. In the ADR-155 layout the Preview panel stays visible while the summary shows.

---

### State Handling

| State | Display |
| ----- | ------- |
| New draft (empty) | The Caption Editor is focused; the Account Selector has nothing chosen; Content Format is not relevant until an account is chosen; the Schedule Picker is empty |
| Draft has content | Caption filled, media attached (if any), accounts + format per account, and time filled |
| Unsaved New Post found in localStorage when the modal opens | Before the form renders, show the "Resume unfinished post?" dialog (KSP-05-F13) — Resume fills the form from the saved state, Mulai Baru deletes the state and opens an empty form. New Post only, does not apply to Edit Draft (ADR-052) |
| Edit Draft opened | The form is filled from server data without a localStorage check. The Account Selector (account, format, and saved Pinterest options) is filled too (KI-060, ADR-125). The Schedule Picker stays empty — the date/time is not yet persisted on Save Draft |
| Format not valid for the platform | The selector rejects the option; Schedule is blocked until the format/media/`platformOptions` are valid (ADR-039) |
| Status Scheduled | The Status Indicator shows "Scheduled"; actions change: Edit Schedule / Unschedule |
| Status Published | The Status Indicator shows "Published"; the screen is read-only with an option to view on the platform |
| Status Failed | The Status Indicator shows "Failed" + a reason message; actions: Retry or Edit |
| Disconnected account | A warning (yellow, warning icon) on the Account Selector and in the network block + a Reconnect action |
| Validation failed (media required, Pinterest board, Reel not video, schedule outside 30 days) | An inline banner near its source (network block, above the editor, or the footer, see F16); Schedule and Publish Now are disabled until valid (ADR-155) |
| One account selected | The network block is always open without an accordion (ADR-155) |
| Narrow screen (below 640px) | A full modal with an Editor / Preview tab below the header; footer stacked; the Fullscreen/Standard and Preview toggles in the header hidden (ADR-155) |

---

---

## KSP-06 — Engage — Inbox

> **Amended by ADR-157 (2026-11-05, T-221):** the main unit of Engage is the post (not the inbox item), comment status becomes `unread` / `replied` / `resolved` / `dismissed`, the filters are split into main filters in the header and a Filter & Sort panel, and there is a By post / List view option. Visual design: the `ScreenEngagePerPosting` card in the Postific artifact and the entry "Engage: per posting" in the Postific Design Review gallery (T-216, confirmed by King Rezi 2026-11-05). The Mentions and DM tabs are deferred (T-223, ADR-040).

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Engage → Inbox` |
| Primary User | Raka |
| Entry Points | Sidebar → Engage; Notification badge; Deep link from Home |
| UX Principles | UXP-01, UXP-03, UXP-06 |

### Goal

The Inbox is the comment triage center — Raka reads and replies to comments from all accounts in one place, without having to open the native app for each platform. Comments are grouped per post because triage naturally follows the post that triggered the comments. Data is updated through a periodic pull every 30 minutes or a manual refresh.

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-06-F01 | Post List | A list of posts that have comments. The card contains the platform icon, account name, caption excerpt, thumbnail if any, a badge with the number of unreplied comments, and a progress bar of the ratio of comments already handled. Comments without a `postId` go into one "Tanpa posting" group at the bottom of the list. Posts without comments are hidden; one toggle shows them | UXP-06 |
| KSP-06-F02 | Filter and Sort | Main filters in the header: Account and Status (a checkmarked single-select dropdown: Semua, Belum dibalas, Dibalas, Selesai, Diabaikan). One icon button opens the Filter & Sort panel: Platform, Sort By (unreplied first = default, newest, oldest), Date Range (7 days, 30 days, 6 months, 12 months = default), and Reset filters (returns all filters to the default) | UXP-03 |
| KSP-06-F03 | Selected Post Comments | Selecting a post opens its comments in the right panel — it does not open a new screen. The panel contains the post preview card (source post context), a summary "x dibalas / y total komentar" (x = status Dibalas only) with small text "n dari y ditangani", and the comment list | UXP-03 |
| KSP-06-F04 | Source Post Context | A post preview card (platform, account, date, media, truncated caption) above the comment list | UXP-01 |
| KSP-06-F05 | Reply Action | Reply to a comment from the Inbox. The composer is docked at the bottom of the right panel in the By post view; inline below the comment in the List view. A reply that is sent marks the comment `Dibalas` if it was previously `Belum dibalas` | UXP-01 |
| KSP-06-F06 | Comment Status | Actions per comment (appear on hover; always shown on narrow screens): Resolve (→ `Selesai`), Dismiss (→ `Diabaikan`), and Buka kembali (→ `Belum dibalas`) for `Selesai` or `Diabaikan` comments. Reply is available in all statuses, except for the "Tanpa posting" group: Outstand only replies per post (ADR-113), so the composer is disabled with a clear message; Resolve and Dismiss stay available in that group. These actions are reversible and low-stakes | UXP-06 |
| KSP-06-F07 | Sync Status | Shows the last sync time and the sync state | UXP-03, UXP-06 |
| KSP-06-F08 | Manual Refresh | Fetches the latest comments without waiting for the next 30-minute periodic pull | UXP-03 |
| KSP-06-F09 | View Option | A By post (default) / List toggle in the header. List shows comments as a flat list across posts with a context row "Pada posting: …" that takes the user to the By post view; sort, filter, and status actions are the same as By post. The List view contents are a design proposal (the Buffer List mode has not been observed) | UXP-03 |

### Comment Status

| Status | Meaning | Entered from | Exits to |
| ------ | ------- | ------------ | -------- |
| `unread` (Belum dibalas) | A new comment from the sync, not yet handled | Sync; Buka kembali from `resolved` / `dismissed` | `replied`, `resolved`, `dismissed` |
| `replied` (Dibalas) | A reply was successfully sent from the Inbox | `unread`, automatically when a reply is sent | `resolved`, `dismissed` |
| `resolved` (Selesai) | Already handled | `unread`, `replied` | `unread` (Buka kembali) |
| `dismissed` (Diabaikan) | Does not need follow-up | `unread`, `replied` | `unread` (Buka kembali) |

A sent reply does not demote `resolved` or `dismissed`. Old rows with status `done` are migrated to `resolved` (T-217.4). The sidebar badge and the Engagement Snapshot on Home still count `unread` only.

---

### Functional Zones

The Inbox in the By post view uses a **two-panel** pattern: the post list on the left (collapsible), the selected post's comments on the right.

```
┌────────────────────────────────────────────────────────────────────┐
│  Engage   Diperbarui 10:30 [Refresh]      [By post | List]         │
│  [Semua Akun ▼] [Semua Status ▼]                    [⚙ Filter&Sort]│
├──────────────────────────┬─────────────────────────────────────────┤
│  POST LIST          [⊟]  │  POST PREVIEW CARD                      │
│                          │  9 dibalas / 21 total komentar          │
│  [▣] @akun — caption…  6 │                                         │
│      Instagram  ▬▬▬▬░░   │  @user1: Komentar…          [Belum dibalas]
│                          │      [Reply] [Resolve] [Dismiss]  (hover)│
│  [▣] Fan page — …      1 │  @user2: Komentar…              [Dibalas]│
│                          │                                         │
│  Tanpa posting         2 │  [Balas…]  (docked composer)            │
└──────────────────────────┴─────────────────────────────────────────┘
```

**Header zone:** The sync zone, the By post / List toggle, the main filters (Account, Status), and the Filter & Sort button.

**Post List zone:** Each card shows the platform, account, caption excerpt, thumbnail, unreplied badge, and handled progress bar. Posts with unreplied comments show first (default sort); the "Tanpa posting" group stays at the bottom and is not part of the sort.

**Comments zone:** Appears when a post is selected. Shows the source post context, the comment list with status badges, hover actions, and the reply area. A dismissible informational banner may appear above this panel (the exact text is set by the design).

**Narrow screen (375px):** the post list and comments are separated (push navigation: list → comments with a back button), status actions are always shown.

---

### State Handling

| State | Display |
| ----- | ------- |
| Has unreplied comments | The post list is filled; posts with unreplied comments on top, the badge shows the count |
| All comments handled | The post card shows a done marker instead of a badge; the `Belum dibalas` filter produces an empty list |
| Empty inbox (no interactions) | _"Belum ada interaksi"_ + the message _"Mulai publish konten untuk melihat engagement"_ + a Buka Publish CTA |
| Active filter — no results | _"Tidak ada interaksi untuk filter ini"_ + a Reset filters action |
| Post selected | Comments show in the right panel; the post list stays visible (or collapsed) |
| List panel collapsed | The right panel uses full width; the collapse button opens it again |
| "Tanpa posting" group selected | Comments without a `postId` show without a post preview card; the reply composer is disabled with a message that this comment is not tied to a post so it cannot be replied to from Postific; Resolve and Dismiss stay available |
| Manual refresh running | The Refresh button is loading; existing data stays visible |
| Refresh failed | A brief message _"Komentar terbaru belum dapat diambil"_ + a Coba Lagi action; the last sync data stays visible |
| Reply sent | A status row in the composer: _"Balasan terkirim. Komentar ditandai Dibalas."_; badge and counts updated |

---

### Pattern: Notification Badge → Inbox

The badge on Engage in the sidebar:

```
Badge appears → Raka finishes the current work (no interrupt)
              → Raka clicks Engage in the sidebar
              → The Inbox opens with posts that have unreplied comments on top
              → Raka handles them one by one → Reply / Resolve / Dismiss
              → The badge disappears when there are no more unreplied comments
```

The badge does not force Raka to interrupt the flow in progress. The badge counts `unread` comments only (`replied`, `resolved`, `dismissed` are not counted) received in the last 12 months, the same as the default Date Range of the post list (decision by King Rezi 2026-11-06), and is updated after a periodic pull or manual refresh finishes; it is not a real-time webhook indicator. The badge is a signal, not a command. (UXP-01, UXP-03)

**MVP boundary:** KSP-06 only shows comments and replies. There is no tab or state for Direct Message, mention (including Instagram story mention, T-223), or engagement webhook (ADR-040). The List view is a design proposal that does not yet have an observed counterpart in Buffer.

---

---

## KSP-07 — Analyze — Dashboard

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Analyze → Dashboard` |
| Primary User | Maya (weekly review) |
| Secondary User | Raka (understanding content performance) |
| Entry Points | Sidebar → Analyze; Home → Analytics Snapshot |
| UX Principles | UXP-02, UXP-03, UXP-07 |

### Goal

The Dashboard gives Maya a picture of content performance that is enough for weekly decisions — without layered navigation and without manual export. Numbers must be readable at a glance.

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-07-F01 | Summary Row | Highlights of the main metrics for the active period: total posts, total reach, total engagement | UXP-02, UXP-03 |
| KSP-07-F02 | Account Overview | Performance per connected social account — makes comparison between accounts easy | UXP-02 |
| KSP-07-F03 | Post Performance | A list of posts with individual metrics: reach, engagement, clicks | UXP-02 |
| KSP-07-F04 | Engagement Summary | Total interactions (comments, likes) in the selected period | UXP-02 |
| KSP-07-F05 | Period Filter | Filter by time range: this week, this month | UXP-03 |
| KSP-07-F06 | Account Filter | Filter the view to one specific account | UXP-03 |

---

### Functional Zones

```
┌────────────────────────────────────────────────────────┐
│  Filter: [Minggu Ini ▼]  [Semua Akun ▼]               │
├────────────────────────────────────────────────────────┤
│  SUMMARY ROW                                           │
│  12 Posts    4,320 Reach    6.5% Engagement            │
├────────────────────────────────────────────────────────┤
│  ACCOUNT OVERVIEW                                      │
│  Instagram @brand: 5 posts, 2,100 reach                │
│  X @brand: 4 posts, 1,400 reach                        │
│  LinkedIn @brand: 3 posts, 820 reach                   │
├────────────────────────────────────────────────────────┤
│  POST PERFORMANCE                        ENGAGEMENT    │
│  [Post 1] caption...  1,200 reach        SUMMARY       │
│  [Post 2] caption...    900 reach        48 komentar   │
│  [Post 3] caption...    750 reach        128 likes     │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

**Summary Row:** Aggregate numbers on top — Maya reads these first. Made large and clear.

**Account Overview:** A breakdown per account. Maya sees which account performs best.

**Post Performance:** A list of individual posts with metrics. Can be sorted by reach or engagement.

**Engagement Summary:** A summary of total interactions — complements Post Performance.

---

### State Handling

| State | Display |
| ----- | ------- |
| Has data | The dashboard is fully filled with actual numbers |
| No data yet (new workspace) | Empty state: _"Belum ada data analytics."_ + Connect Account CTA + Create First Post CTA |
| Filter produces empty data | _"Tidak ada data untuk filter ini"_ — no empty numbers or charts without data |
| New account with no data yet | Account Overview: the account shows without numbers, with the message _"Belum ada data untuk akun ini"_ |

---

### Pattern: Analytics Empty State

```
Analyze → Dashboard (no data yet)
  ↓
Show:
  "Belum ada data analytics."
  "Hubungkan akun sosial untuk mulai melacak performa konten."

  [Connect Account]    →  Settings → Organization → Connected Accounts
  [Create First Post]  →  Publish → Drafts → New Post
```

No zero numbers or empty charts are shown — a communicative empty state is better than misleading data. (UXD-03)

---

---

## KSP-08 — Settings — Organization — Connected Accounts

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Settings → Organization → Connected Accounts` |
| Primary User | Raka or Maya (whoever has Settings access) |
| Entry Points | User Avatar → user menu → Settings → Organization; Error indicator / Reconnect link from Calendar, Queue, Account Selector; click a Disconnected/Expired channel in the Channels sidebar (NP-D14) |
| UX Principles | UXP-03, UXP-04 |

### Goal

This screen is the only place where users manage social media account connections — adding a new account, checking the status of existing connections, and handling disconnected accounts.

**Note (NP-D14):** the "Channels" list in the sidebar shows a quick-glance status + a compose shortcut per account from any section, but it is **not a replacement** for this screen — Connect/Disconnect/Reconnect stay exclusive here.

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-08-F01 | Connected Account List | All accounts already connected are shown with their connection status | UXP-04, UXP-06 |
| KSP-08-F02 | Connection Status per Account | The status of each account: Active, Disconnected, Expired | UXP-04 |
| KSP-08-F03 | Connect Account | A CTA to add a new account — starts the platform selection and OAuth flow | UXP-04 |
| KSP-08-F04 | Reconnect | A Reconnect button on accounts with status Disconnected — restarts the OAuth flow for that account | UXP-04 |
| KSP-08-F05 | Disconnect / Remove | Users can release the connection of an account that is not needed — must go through Disconnect Confirmation (KSP-08-F07, ADR-048) before execution | UXP-03, UXP-04 |
| KSP-08-F06 | Platform Selector | The list of available platforms when adding a new account | UXP-03 |
| KSP-08-F07 | Disconnect Confirmation | A confirmation dialog before an account is actually disconnected — shows a warning that scheduled posts for this account stay in the queue (KSP-D09), not automatically cancelled (ADR-048) | UXP-04 |

---

### Functional Zones

```
┌────────────────────────────────────────────────────────┐
│  Connected Accounts                    [+ Connect Account] │
├────────────────────────────────────────────────────────┤
│  Instagram                                    Active ✅ │
│  @brandname · Terhubung sejak 2 Jan          [Disconnect]│
├────────────────────────────────────────────────────────┤
│  X (Twitter)                            Disconnected ⚠️ │
│  @brandname · Token kadaluarsa          [Reconnect]     │
├────────────────────────────────────────────────────────┤
│  LinkedIn                                     Active ✅ │
│  Company Page · Terhubung sejak 10 Mar        [Disconnect]│
└────────────────────────────────────────────────────────┘
```

**Account list zone:** Each account shows the platform, username/page name, connection status, and connected date. Actions are available according to status.

**Connect CTA zone:** Above the list — available at any time, no scrolling needed.

---

### Pattern: Connect Account Flow

```
[+ Connect Account]
    ↓
Show the platform list: Instagram, Facebook, X, LinkedIn, TikTok, YouTube, Threads, Pinterest.
    ↓
The user chooses a platform
    ↓
Open the platform's OAuth flow (opened in a new tab/popup or redirect)
    ↓
The user logs in to the platform account + grants permission
    ↓
Return to Connected Accounts
    ↓
The new account appears with status Active
```

The steps between clicking "Connect" and the platform's OAuth page must be as few as possible — no unnecessary extra forms. (UXP-03)

---

### Pattern: Disconnect Flow (ADR-048)

```
[Disconnect] clicked
    ↓
Disconnect Confirmation dialog:

  Putuskan koneksi Instagram @brandname?

  Post yang sudah terjadwal untuk akun ini akan tetap di antrean —
  tidak otomatis dibatalkan. Post baru tidak bisa dijadwalkan ke akun
  ini sampai disambungkan kembali.

  [Batal]   [Putuskan Koneksi]
    ↓
Click "Putuskan Koneksi" → the account changes to status Disconnected
```

Disconnect is only available to the Owner/Admin role (`roles-permissions.md`
— "Tambah/hapus connected accounts"). This dialog does **not** use the
Confirmation Summary pattern (KSP-05-F06) — a brief warning + two
buttons is enough, because this action does not publish content and does not
need a multi-field summary.

---

### Pattern: Reconnect Flow

```
Account with status Disconnected
    ↓
[Reconnect] clicked
    ↓
The OAuth flow is repeated for that account
    ↓
After success → status returns to Active
    ↓
Scheduled posts for this account stay in the queue
```

Scheduled posts are **not automatically cancelled** when an account is disconnected. They stay in the Queue and will be sent once the account is Active again. (UF-05 Alternate Path)

---

### State Handling

| State | Display |
| ----- | ------- |
| Has active accounts | The account list with status Active |
| Has disconnected accounts | A Disconnected account is shown with a different visual + a Reconnect button |
| No accounts at all | Empty state: _"Belum ada akun terhubung"_ + a prominent Connect Account CTA |
| OAuth running | A loading indicator on the account that is in the connect process |
| OAuth failed | An error message + an option to try again |

---

---

# MCP Screens and Patterns (ADR-138, ADR-139)

Added 2026-10-23 after the design in the Postific design artifact was made (ADR-140). The visual design is in the Postific artifact: `project/components/ScreenOauthConsent/preview.html` (KSP-09), `project/components/ScreenSettingsAiClients/preview.html` (KSP-10), `project/components/McpSourceBadge/preview.html` (badge and filter pattern). Not part of the 8 daily critical screens; users touch them occasionally.

---

## KSP-09 — AI Client OAuth Consent

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | Outside the app shell (no sidebar), a standalone page: Choose Workspace → Scope Consent |
| Primary User | Raka or Maya |
| Entry Points | Redirect from an AI client after the user logs in to Postific (OAuth flow ADR-139) |
| UX Principles | UXP-03, UXP-04, UXP-05 |

### Goal

The user consciously decides which AI client may work in one workspace, with what permissions. One consent produces one grant: user + client + workspace + scope.

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-09-F01 | Step 1 — Choose Workspace | A single-choice radio list, only workspaces where the user is an active member; shows the role and the number of connected accounts. "Lanjut" and "Batal" buttons | UXP-03 |
| KSP-09-F02 | Step 2 — Scope Consent | The chosen workspace shows at the top (with an "Ubah" link), then the scope list and the "Izinkan" and "Tolak" buttons | UXP-04 |
| KSP-09-F03 | Client Identity | The client name and its origin host are always shown, with a note that the client registers itself and its name is given by that client itself (dynamic client registration) | UXP-04 |
| KSP-09-F04 | Scopes and Their Impact | `read` and `draft` are checked by default; `schedule` is empty, given an "Berdampak" marker, and must be checked deliberately. Each scope comes with an impact explanation. `publish` and `reply` are not shown (deferred, ADR-138) | UXP-04 |
| KSP-09-F05 | ~~Role-Limited Scopes~~ — **Not applicable in the MVP** | ~~Scopes that the user's role in the chosen workspace may not use are shown disabled along with the reason~~ In the MVP there is no scope restriction by role: all roles (Account Owner, Admin, Creator) are equal for `read`, `draft`, and `schedule`, aligned with the Schedule right in `roles-permissions.md`. All scopes are always shown enabled; the only limiter is the user's choice in F04 | UXP-04 |

---

### State Handling

| State | Display |
| ----- | ------- |
| Step 1 normal | The workspace list, one selected, "Lanjut" enabled |
| User without a workspace | Empty state: not yet a member of any workspace + a "Buat Workspace" CTA; "Lanjut" disabled |
| Step 1 loading | Card skeleton |
| Step 2 normal | Client identity, chosen workspace, scope list, "Tolak" and "Izinkan" |
| ~~Role-limited scope~~ | ~~The related scope is disabled with a reason (F05)~~ — **Not applicable in the MVP**: there is no scope restriction by role |
| Client without a name or an unusual host (e.g. localhost) | A strong warning; "Tolak" becomes the primary button and "Izinkan" is labeled "Saya paham, izinkan" |
| Save error | An error banner, no access granted, a "Coba Lagi" button; workspace and scope choices stay |
| Saving | All controls locked, the "Izinkan" button shows a spinner "Menyimpan…" |

---

## KSP-10 — Settings — Account — Klien AI

### Identity

| Field | Value |
| ----- | ----- |
| IA Path | `Settings → Account → Klien AI` |
| Primary User | Raka or Maya |
| Entry Points | User Avatar → user menu → Settings → Account → Klien AI |
| UX Principles | UXP-03, UXP-04, UXP-05 |

### Goal

The user sees which AI clients are connected on their behalf and can revoke their access at any time. Revocation takes effect instantly: every MCP call checks the grant in the database (result of the T-148 spike).

---

### Critical Functions

| ID | Function | Description | Principle |
| -- | -------- | ----------- | --------- |
| KSP-10-F01 | Own Connection List | One row per grant (client + workspace): client name, workspace, scopes as chips, connected date, last used (or "Belum pernah dipakai"). No owner column; Owner/Admin do not see other members' connections (IA-D09) | UXP-03, UXP-06 |
| KSP-10-F02 | Revoke | A "Cabut" button per row opens a Tier 2 confirmation dialog (AlertDialog, ADR-049) that names the client and workspace, that the client immediately can no longer access data, and that drafts or posts already created or scheduled stay | UXP-04 |
| KSP-10-F03 | How to Connect | There is no Connect button on this screen; the connection starts from the AI client. The empty state explains the steps and shows the MCP URL with a "Salin" button | UXP-03 |

---

### Pattern: Revoke Access

```
[Cabut] clicked
    ↓
Tier 2 dialog:

  Cabut akses <klien>?

  <Klien> tidak bisa lagi membaca atau mengubah data workspace <workspace>.
  Draft dan post yang sudah dibuat atau dijadwalkan lewat klien ini tetap ada.
  Anda bisa menyambungkan lagi kapan saja.

  [Batal]   [Cabut Akses]
    ↓
The grant is marked revoked; the row disappears from the list
```

---

### State Handling

| State | Display |
| ----- | ------- |
| Has connections | A list of rows in a `rounded-xl border` container (KSP-08 pattern, no column headers) |
| No connections | Empty state: the connecting steps + the MCP URL with a "Salin" button |

---

## Pattern: MCP Source Badge and Filter

Applies to **History, Drafts, and Queue** (KSP-03, KSP-04, and the History list). **The Calendar gets no badge.**

* **Badge:** a small outline-style component (not fill, so it does not compete with the status chip) containing an icon and the AI client name, placed on the **meta row** below the title so the status and action columns on the right do not shift. The name is truncated with an ellipsis; if the client has been revoked or deleted, the badge still shows with the last stored name. Items created manually show no badge and look exactly as before.
* **Source filter:** a single choice of three — Semua / Dibuat manual / Lewat MCP — using the same `select` control as the existing filters. **The default is always Semua.** In History it is added as a third select beside Status and Account; in Queue beside the Account filter; in Drafts it becomes the first filter control above the list.
* **Does not change the default display:** with no filter active, each screen looks as it did before this feature existed, apart from the badge on MCP items (`.claude/skills/claude-design-scope-discipline/SKILL.md`).
* **Empty filter state:** "Belum ada konten dari klien AI" + a Tampilkan Semua button.

---

# Cross-Screen Pattern — Safety Check / Double Confirmation (ADR-049)

This policy applies across the product, not tied to one specific KSP. It was drawn up from a thorough audit (2026-07-29) of every action in the baseline — triggered by the discussions on Publish Now (ADR-047) and Disconnect Account (ADR-048) — to determine which actions must go through a confirmation dialog before execution.

## Criteria

An action **must** go through Safety Check / Double Confirmation if it meets either of these:

1. **Irreversible or costly to undo** — there is no reasonable "undo" path for the user.
2. **Large blast radius** — its impact goes beyond the user's own data (affecting the team, the workspace, or content already promised to the public).

Actions that are reversible, low-stakes, or high-frequency (part of the daily core work flow) are **deliberately not** given extra confirmation — adding it would be friction that violates UXP-03 (Simplicity Is a Quality Bar).

## Tiers

| Tier | UI Pattern | When Used |
| --- | --- | --- |
| **Tier 1** | Reinforced confirmation (e.g. type the workspace name/keyword to confirm) | Catastrophic actions: destroying a whole workspace or handing over full control, no way back unilaterally |
| **Tier 2** | A standard confirmation dialog (a brief warning + Cancel/Confirm buttons) — the same pattern as Disconnect Confirmation (KSP-08-F07, ADR-048) | Destructive/costly-to-undo actions, but with less impact than Tier 1 |
| **Not required** | No extra dialog | Reversible, low-stakes, or high frequency — confirmation becomes friction with no benefit |

## Complete Classification

| Action | Tier | Reason |
| --- | --- | --- |
| Transfer Ownership | Tier 1 | Hands over full control of the workspace; the old Owner cannot undo it unilaterally |
| Delete Workspace | Tier 1 | Destroys all the workspace's data at once — the most catastrophic in the product |
| Schedule | Tier 2 (already exists) | Confirmation Summary — KSP-05-F06/F09 |
| Publish Now | Tier 2 (already exists) | Confirmation Summary variant — KSP-05-F12 (ADR-047) |
| Disconnect Account | Tier 2 (already exists) | Disconnect Confirmation — KSP-08-F07 (ADR-048) |
| Delete Post | Tier 2 | Feels permanent to the user even though it is a soft delete in the DB (`database-strategy.md` DB-D03) |
| Delete Media | Tier 2 | A true hard delete (no `deleted_at`); media can be reused across drafts |
| Remove Member | Tier 2 | Removes a colleague from the workspace; needs re-inviting if done by mistake |
| Update Member Role | Tier 2 | Especially when lowering access — directly affects what other people can do |
| Cancel Schedule | Tier 2 | Symmetry argument with Schedule (UXP-04) — cancels a publish commitment that was confirmed earlier |
| **Logout** | **Tier 2** | Product decision (2026-07-29): protects against interrupting unsaved work, even though this action itself is reversible (different from the initial recommendation — see Alternatives in ADR-049) |
| Save as Draft | Not required | Reversible, low-stakes |
| Send to Review (Creator) | Not required | Reversible — can go back to Draft |
| Resolve / Dismiss comment (Engage) | Not required | Reversible (Buka kembali), low-stakes (ADR-157) |
| Reply/Send comment (Engage) | Not required | High frequency — part of the daily core work flow (UXP-03) |
| Connect Account | Not required | OAuth consent from the provider already exists |
| Reconnect | Not required | OAuth consent from the provider already exists |
| Remove Link (Start Page) | Tier 2 | The link's click count is also lost and cannot be recovered; the dialog "Hapus link?" (ADR-049, ADR-144) |

## Implementation Notes

* Schedule, Publish Now, and Disconnect Account already have official screens and have been implemented as their own KSP function IDs.
* Delete Post, Delete Media, and Cancel Schedule have a screen to live in (Draft Editor/Media Library) but the UI entry point for these specific actions has **not yet been designed** — the tier classification above applies as soon as the entry point is made, it is not a decision still waiting.
* Remove Member, Update Member Role, Transfer Ownership, and Delete Workspace **do not have a screen at all yet** (Settings → Organization → Members/General outside the 8 KSPs) — the tier classification above becomes the mandatory reference once those screens are designed.
* Logout already has an entry point (the User Menu dropdown, `navigation-patterns.md`) — implementing its confirmation dialog is a separate task.

---

# Decision Log

Design decisions made in this document.

| ID | Decision | Reason | Principle |
| -- | -------- | ------ | --------- |
| KSP-D01 | Home is an orientation screen, not a work dashboard — no heavy action is completed here | Home serves Maya's visibility needs without forcing Raka to pass through it (IA-D03) | UXP-02, UXP-03 |
| KSP-D02 | ~~The Draft Editor has two zones: left (Caption + Media) and right (Account, Schedule, Actions)~~ — **Amended by ADR-155**: two zones, left (Channel Row + Caption + Media + Per-Network Blocks) and right (live Preview), with an action footer (Save as Draft, Atur jadwal, Publish Now, Schedule); the per-account Preview picker is a `Select`, not tabs (ADR-156) | This separation lets Raka focus on writing on the left while configuring publishing on the right — a linear left-to-right flow | UXP-01, UXP-03 |
| KSP-D03 | ~~AI Assist shows as a trigger inside the Caption Editor, not a separate panel opened deliberately~~ — **Removed by ADR-138**. The built-in AI was removed; there is no AI trigger in the Caption Editor | ~~AI is most useful when it appears right at the moment of writing, not as a navigation destination (UXP-05, I-06)~~ | UXP-05 |
| KSP-D04 | The Account Selector shows Disconnected accounts — not hidden | Users must see the problem at the decision point, not after a post fails | UXP-04 |
| KSP-D05 | A confirmation summary appears before the Schedule button **or Publish Now** is executed (ADR-047) | Builds trust that the content will go out to the right account and time (UXP-04) | UXP-04 |
| KSP-D06 | The Engage Inbox groups comments per post in two panels (post list on the left, selected post's comments on the right), with a By post / List toggle (amended by ADR-157) | Comment triage follows the post that triggered it; high volume, users need to move between posts without full-page navigation (NP-D03) | UXP-03 |
| KSP-D07 | The Analytics Dashboard shows the Summary Row as the top zone | Maya reads the aggregate numbers first — not a detail table that requires long scanning | UXP-02, UXP-03 |
| KSP-D08 | The Analytics empty state shows two CTAs, not zero numbers or an empty chart | Zero numbers or a chart without data are misleading and unhelpful; the CTAs lead to meaningful actions (UXD-03) | UXP-03 |
| KSP-D09 | Scheduled posts are not automatically cancelled when an account is disconnected | Automatic cancellation is more damaging than leaving posts in the queue and waiting for a reconnect | UXP-04 |
| KSP-D10 | Publish History is not in the list of 8 critical screens | History is a passive review screen — its pattern is simple (list + detail) and does not need in-depth documentation in this phase | UXP-03 |
| KSP-D11 | Start Page is not in the list of 8 critical screens | Start Page is not part of the daily work cycle (UXP-01: Draft → Schedule → Publish → Engage → Review). Start Page is a configuration feature accessed occasionally — not every work session. Its pattern is simple: a settings form + public preview. There is no team coordination pattern or multi-step flow that needs in-depth documentation in this phase. The Page Editor screen contents (link Dialog, Simpan button, theme selector, basic analytics) are detailed in `information-architecture.md` § Start Page (ADR-144). | UXP-01, UXP-03 |
| KSP-D12 | A per-account Content Format Selector in the Draft Editor (not one global toggle) | Format depends on the platform (IG/FB vs TikTok vs Pinterest); multi-account posting needs an independent format per `PostTarget` (ADR-039) | UXP-01, UXP-03 |
| KSP-D13 | The Engage Inbox only holds comments/replies and shows last sync + Manual Refresh | The official Outstand contract supports comment pull/reply, not unified DM/mention or engagement webhooks; the 30-minute periodic pull needs a visible freshness expectation (ADR-040) | UXP-03, UXP-06 |
| KSP-D14 | Disconnect Account must go through a brief confirmation dialog (not the KSP-05-F06 Confirmation Summary), not direct execution (ADR-048) | It was found during the documentation audit that Disconnect had no confirmation specification at all although it has impact (scheduled posts keep running without an active account); the confirmation level is just a warning + two buttons because it is not a content publish action | UXP-04 |
| KSP-D15 | After Save as Draft / Schedule / Publish Now, the modal closes and the user is directed to the **destination** sub-screen (Drafts / Queue / History-temporarily-Calendar) — not back to the source sub-screen like the Close button (KSP-05-F10) (ADR-054) | The sidebar now has a New Post CTA that can be opened from any section (ADR-053) — users need to see the result of their action right away in the relevant Publish section, not be left in the source section that is no longer related to the content just created | UXP-04 |
| KSP-D16 | A two-step OAuth consent screen (choose a workspace, then scope), not a single screen (KSP-09, ADR-139) | Result of the T-148 spike: the workspace must be fixed before consent; two steps follow the two backend pages and make the workspace choice visible at the scope step | UXP-04 |
| KSP-D17 | ~~Scopes that the role does not allow are shown disabled along with the reason, not hidden (KSP-09-F05)~~ — **Not applicable in the MVP**: there is no role limit on MCP scopes; all roles may `read`/`draft`/`schedule` | ~~Users need to know why `schedule` cannot be chosen; server rejection still applies as a second layer~~ | UXP-04 |
| KSP-D18 | The client name and host are always shown on the consent screen, with a note that the name is given by the client itself (KSP-09-F03) | All clients register themselves without verification (dynamic client registration); users must be able to judge the client's origin | UXP-04 |
| KSP-D19 | AI clients are managed in Settings → Account, only one's own connections, and revocation through a Tier 2 dialog (KSP-10) | A grant is personal; revocation cuts access instantly so it needs confirmation (ADR-049) | UXP-03, UXP-04 |
| KSP-D20 | The MCP source badge and filter in History, Drafts, Queue; the default filter is Semua; the Calendar gets no badge | Gives a trace of AI work without changing the already-approved default display (ADR-052 scope discipline) | UXP-04, UXP-05, UXP-06 |
| KSP-D21 | Account selection is in the channel row above the editor (popover, chips, "Terakhir dipakai", "Semua"), not an account list in the right zone (ADR-155) | Choosing the destination before writing makes the Preview and format rules immediately relevant, following the Buffer Create Post pattern chosen by King Rezi | UXP-01, UXP-04 |
| KSP-D22 | A live per-platform Preview and inline validation near its source (network block, above the editor, footer) replace scattered Alerts (ADR-155) | Users see results and problems at the decision point, not after pressing Schedule; aligned with KSP-D04 | UXP-04 |
| KSP-D23 | Scheduling through the "Atur jadwal" popover in the footer without "Next Available"; "Create Another" is not part of Stage 1 (conflicts with the KSP-D15 redirect) (ADR-155) | Postific does not yet have a queue slot concept; Create Another would keep the modal open and goes against ADR-054 | UXP-01, UXP-04 |

---

# Pattern Summary per Screen

| Screen | Main Pattern | Critical States |
| ------ | ------------ | --------------- |
| KSP-01 Home | 4 informative zones + deep link | Failed post in Recent Activity |
| KSP-02 Calendar | Grid per day × time + click → Editor | Failed item, Disconnected warning |
| KSP-03 Queue | A linear ordered list (grouped by date) + 1 card per item + filter | Empty queue, filter with no results (Failed items move to History) |
| KSP-04 Drafts | Draft list + New Post CTA | Empty Drafts |
| KSP-05 Draft Editor | Two zones (Channel Row + Editor + Per-Network Blocks / Preview) + action footer + Confirmation Summary | Disconnected account, Failed status |
| KSP-06 Inbox | Two panels per post (By post / List) + main filters + Filter & Sort panel + sync status + Manual Refresh | Badge after sync, refresh failed, empty Inbox, filter with no results |
| KSP-07 Dashboard | Summary Row + Account Overview + Post Performance | Empty state (no data yet) |
| KSP-08 Connected Accounts | Account list + status + contextual actions | Disconnected → Reconnect |
| KSP-09 OAuth Consent | Two steps (workspace, scope) outside the app shell | No workspace, nameless client, error, saving |
| KSP-10 Klien AI | List of own grants + Revoke (Tier 2) | No connections (steps + MCP URL) |

---

# Traceability to UX Principles

| Principle | Screens That Apply It |
| --------- | --------------------- |
| UXP-01 — One Cycle | KSP-02, KSP-03, KSP-04, KSP-05, KSP-06 |
| UXP-02 — Two Work Modes | KSP-01, KSP-02, KSP-07 |
| UXP-03 — Simplicity Quality Bar | KSP-01, KSP-03, KSP-04, KSP-05, KSP-06, KSP-07, KSP-08 |
| UXP-04 — Publishing Trust | KSP-02, KSP-03, KSP-05, KSP-08, KSP-09, KSP-10 |
| UXP-05 — AI Attaches to the Work | KSP-03, KSP-04, KSP-09, KSP-10 |
| UXP-06 — Clear Status, Light Process | KSP-02, KSP-03, KSP-04, KSP-05, KSP-06, KSP-08 |
| UXP-07 — Value Grows with the Cycle | KSP-01, KSP-07 |

---

# Expected Output

Once this document is complete, the project must have:

* Critical-function patterns for the 8 main screens of the product.
* Required functions per screen documented with IDs.
* Functional zones per screen that can serve as a reference for architecture and development.
* State handling documented for critical conditions.
* A decision log traceable to the UX Principles.
* Input ready for Architecture Discovery (M5).

---

# Exit Criteria

Key Screen Patterns are considered complete when:

* All critical screens (8 screens) have been documented.
* Each screen has Critical Functions identified with IDs.
* Each screen has defined functional zones.
* Critical states (empty, error, disconnected) are documented for each screen.
* Every design decision can be traced to the UX Principles.
* No decision conflicts with Product Baseline v1.0 or Navigation Patterns.

---

# Related Documents

* `README.md`
* `ux-principles.md`
* `information-architecture.md`
* `user-flows.md`
* `navigation-patterns.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
