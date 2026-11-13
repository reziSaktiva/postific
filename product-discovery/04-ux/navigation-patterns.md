# Navigation Patterns

This document defines the **navigation model and screen-transition patterns** of the **Postific** product.

Navigation Patterns are built on top of the Information Architecture already set. This document does not define visual layout or UI components — it explains the logic of how users move between parts, how context is preserved, and when a screen transition happens.

---

# Overview

Navigation Patterns defines three main things:

1. **Navigation model** — the structural pattern used (persistent sidebar, sub-nav, etc.).
2. **Screen-transition patterns** — how the transition happens from one screen to another.
3. **Contextual navigation patterns** — navigation that appears in response to user actions.

This document serves as a reference for Key Screen Patterns and Architecture Discovery.

---

# Navigation Patterns Principles

Navigation Patterns in this product are built on the three IA principles already set.

## NP-P01 — Navigation Is Always Accessible

**Derived from:** UXP-01, P-IA-01

Primary navigation is always visible and can be accessed from any position in the application. Users are never "trapped" in a screen with no path back to other parts.

---

## NP-P02 — Context Switches Must Be Explicit

**Derived from:** UXP-04, UXP-03

When a user is about to move from one section to another (for example from the Draft Editor to Settings), that move must feel like a conscious decision — not an unexpected consequence of another action.

The work context being worked on must not be lost suddenly because of unintended navigation.

---

## NP-P03 — Two Levels Deep, No More

**Derived from:** P-IA-03, UXP-03

Navigation is at most two levels: **primary section → sub-screen**. There is no nested navigation that forces users to dig more than two levels to reach a core feature.

---

# Main Navigation Model

The product uses a **Persistent Sidebar Navigation** model for web.

```
┌─────────────────────────────────────────────────────┐
│  [Sidebar]          │  [Main Content Area]           │
│  [+ New Post]       │                                │
│  • Home             │  Active screen content         │
│  • Publish          │  changes according to          │
│  • Engage  [badge]  │  the selected navigation       │
│  • Analyze          │                                │
│  • Start Page       │                                │
├─────────────────────┤                                │
│  Channels           │                                │
│  (quick-glance)      │                                │
├─────────────────────┤                                │
│  Notifications      │                                │
│  User Avatar        │                                │
└─────────────────────────────────────────────────────┘
```

**Characteristics of this model:**

- The sidebar is always visible — users do not need to go back to the start page to switch sections.
- The Main Content Area shows the active screen's content — it changes according to the item selected in the sidebar.
- There is no full-page reload when switching sections (client-side navigation).
- The sidebar does not hide itself automatically; the user controls whether the sidebar is collapsed or not (Should Have for a wider experience).

---

# Primary Navigation Pattern

## Sidebar Structure

Primary navigation consists of four vertical zones:

```
┌──────────────────────┐
│  [+ New Post]        │  ← CTA, pinned at the top of the sidebar
├──────────────────────┤
│  Home                │
│  Publish             │  ← navigation items
│  Engage   [badge]    │
│  Analyze             │
│  Start Page          │
├──────────────────────┤
│  📷 @kopiselasar  8  │  ← Channels, quick-glance
│  📘 Kopi Selasar  3  │     (independently scrollable)
│  🐦 @kopiselasar  0  │
├──────────────────────┤
│  Notifications       │  ← utilities
│  User Avatar         │  ← always at the bottom
└──────────────────────┘
```

**CTA zone:** The "+ New Post" button (primary, full-width) — pinned at the top of the sidebar, above the navigation items. Available from any section (Home, Publish, Engage, Analyze, Settings), not only when the user is in Publish (NP-D12). It complements, and does not replace, the New Post CTA that already sits directly on the Calendar/Queue/Drafts screens (NP-D09) — both open the same Draft Editor.

**Middle zone:** 5 navigation items — Home, Publish, Engage, Analyze, Start Page. The order reflects the product value flow (UXP-07): Publishing reliability → Engagement triage → Analytics snapshot.

**Channels zone:** The list of connected social media accounts (quick-glance), below the navigation items and above the utilities zone (NP-D14). See the "Channels (Sidebar)" section below for full details.

**Bottom zone:** The Notifications icon and User Avatar — access to secondary navigation. Always available without scrolling — the Channels above scroll independently so this zone is never pushed off screen even when many accounts are connected.

---

## Active State and Visual Feedback

- The active navigation item is marked visually (highlight / indicator) — users always know their position.
- **Engage** has a notification badge showing the number of `unread` comments in the last 12 months (unreplied; `replied`, `resolved`, `dismissed` are not counted) — visible from any section (supports the UF-04 Alternate Path).
- No loading state blocks the sidebar — the sidebar stays interactive while content loads.

---

## Channels (Sidebar)

The list of connected social media accounts, shown as a quick-glance list — not a replacement for `Settings → Organization → Connected Accounts` (KSP-08), which remains the only place for Connect/Disconnect/Reconnect (IA-D05 does not change).

```
Default (not hovered):
  (●IG) @kopiselasar          8     ← round avatar + brand logo badge overlay; 8 = scheduled posts count
                             Active

Hover:
  ⠿  (●IG) @kopiselasar   [+]       ← drag handle appears on the left (outside the avatar); the whole row content shifts right
                             Active
```

**Contents of each row:** a round avatar (initial placeholder, same treatment as `.ws-avatar`) with a small platform brand logo badge (`react-icons` fa6, brand color unchanged) overlaid at the bottom-right corner of the avatar (story-ring badge convention) — no longer a plain platform logo (flat square icon) — + the account name/handle (`@kopiselasar` or a page name such as `Kopi Selasar`, following the KSP-08 convention) + a status badge (Active/Disconnected — the same Badge as KSP-08, no new status colors).

**Default state:** the number badge shows the count of **scheduled** posts (not yet live) for that account.

**Hover state:** the badge count is replaced by a quick-compose "+" button (opens an empty Draft Editor/KSP-05 with this account automatically pre-selected in the Account Selector); the drag handle appears at the far left of the row (outside the avatar) for reordering. This reorder is **personal per user** — the display order can differ between team members, it is not a shared workspace order.

**Shift-on-hover for the drag handle (ADR-058 revision, addendum):** the drag handle appears outside the avatar space, so on hover **the whole row content (avatar+badge+name) shifts right** (animated `margin-left`) to make room — this replaces the initial "no-shift" decision (space reserved permanently). The change was made at King Rezi's explicit request after seeing a reference screenshot of another application.

**The count ↔ "+" button swap stays no-shift:** unlike the drag handle above, the count/"+" button slot on the right side of the row stays a **fixed slot** — it never shifts content, only its contents swap (count → "+") on hover. This does not change from the initial decision.

**Clicking a Disconnected/Expired channel:** deep-link to `Settings → Organization → Connected Accounts` — extending the "Status Indicator → Settings" pattern (see Contextual Navigation Pattern below), not a new pattern.

**Independent scroll:** this list scrolls on its own (does not scroll the whole sidebar) so the bottom zone (Notifications/User Avatar) always stays visible even when many accounts are connected.

See NP-D14 in the Decision Log for the full decision (ADR-058, including the shift-on-hover addendum).

---

# Secondary Navigation Pattern

Secondary navigation is accessed through elements in the bottom zone of the sidebar — it does not use a primary nav slot.

## Notifications

```
Notifications icon → Notifications Panel (overlay / drawer)
├── In-app notification list ordered by time
├── Mark as read
└── Link to the related item (post, account, etc.)
```

The Notifications Panel appears as an overlay or drawer — it does not replace the Main Content Area. Users can close it and return to the work they were doing.

---

## Settings

```
User Avatar → User Menu (dropdown)
├── Settings → Organization  (General, Connected Accounts, Members, Roles & Permissions, Billing)
├── Settings → Account       (Workspaces, Profile, Notifications, Preferences, Klien AI)
└── Logout
```

The User Menu appears as a small dropdown — the only entry point to the Settings pages (the Organization and Account groups), done from here. This is not a daily work screen so it does not need a slot in the primary nav.

**Layout after entering (Buffer pattern, ADR-077):** once inside Settings, the persistent sidebar (workspace switcher, nav items, Channels) is **replaced entirely** by a single dedicated Settings sidebar in the same slot — not shown side by side as a secondary nav. This dedicated sidebar has a back-navigation header ("← Settings") above the two groups Organization/Account, linking back to Home. The group taxonomy does not change.

**Logout must go through a confirmation dialog (Tier 2)** — see the Safety Check / Double Confirmation policy in `key-screen-patterns.md` (ADR-049).

---

# In-Section Navigation Pattern

Some sections have sub-navigation inside the Main Content Area to move users between sub-screens.

## Publish — Tab Navigation

Publish is the largest section with four sub-screens:

```
Publish
├── [Calendar]  [Queue]  [Drafts]  [History]  ← tab bar above the main content
│
└── Main Content Area shows the active sub-screen's content
```

**Pattern:** A horizontal tab bar right below the section header. The active tab is clearly visible. Switching tabs does not reset state (filters, scroll position) between tabs unless necessary.

**Default tab:** Calendar — per IA-D04. Raka enters Publish and immediately sees the current week's schedule overview.

---

## Engage — Single Screen

Engage has only one screen: Inbox. There is no tab navigation inside Engage. The **By post / List** toggle in the Inbox header is a view option within the same screen (not tab navigation and not a new screen); By post is the default (ADR-157).

```
Engage
└── Inbox  ← shown directly with no extra sub-navigation
    └── [By post | List]  ← view option, not a tab
```

---

## Analyze — Single Screen

Analyze has only one screen: Dashboard. There is no tab navigation; internal navigation uses inline filters (per account, per period).

```
Analyze
└── Dashboard  ← shown directly; filters are accessed inline inside the dashboard
```

---

## Start Page — Single Screen

Start Page has no sub-navigation; the Page Editor, Preview, and Share are elements within one and the same screen.

The screen contents (Profile, Link List, theme selector, basic analytics) are detailed in `information-architecture.md` § Start Page (ADR-144).

---

# Contextual Navigation Pattern

Contextual navigation happens when a user clicks an element in a screen that takes them to another screen with context carried over.

## Pattern: Item → Editor

Happens in Publish. Clicking an item opens the Draft Editor for that item.

```
Publish → Calendar  → [click item]  → Popover (summary) → [CTA Edit] → Draft Editor (item X)
Publish → Queue     → [click item]  → Draft Editor (item X)
Publish → Drafts    → [click item]  → Draft Editor (item X)
Publish → Drafts    → [New Post]   → Draft Editor (new item)
```

**Calendar specifically (ADR-090):** clicking an item does not open the Draft
Editor directly — it opens a `Popover` (post summary + metrics for those
already Published) first; the Draft Editor is opened through a CTA inside the Popover.
Queue and Drafts **do not change** — still click → straight to the Draft Editor.

**Transition:** The Draft Editor is shown as a **modal overlay** on top of Publish — no longer a separate full panel/screen within the Publish section (ADR-052, overriding the original NP-D02). The default modal display is the **Standard** variant (floating card + dimmed backdrop over Calendar/Queue/Drafts, ADR-065); users can switch to the **Fullscreen** variant (covering everything including the sidebar) through the official toggle in the modal header — see NP-D11.

**Back:** The "Close" button in the modal header closes the modal and returns the view to the source sub-screen (Calendar / Queue / Drafts) without URL navigation — no longer "Back" to a separate route, because the Draft Editor no longer has its own route.

---

## Pattern: New Post CTA from Calendar and Queue

Happens when users are looking at the Calendar or Queue and want to create new content right away without first moving to the Drafts tab.

```
Publish → Calendar  → [New Post]  → Draft Editor (new item)
Publish → Queue     → [New Post]  → Draft Editor (new item)
```

**Trigger:** The "New Post" CTA is available directly on the Calendar and Queue screens — not only in Drafts.

**Usage context:**
- Raka looks at the Calendar and finds a schedule gap on a given day → clicks New Post straight from the Calendar to fill that gap.
- Raka scans the Queue and wants to add content to the queue without switching tabs.

**Transition:** Identical to New Post from Drafts — an empty Draft Editor (modal overlay, default variant Standard, ADR-065) opens on top of whichever sub-screen is active. The source sub-screen (Calendar, Queue, or Drafts) stays the same once the modal is closed — there is no URL navigation to track.

**Back:** The "Close" button in the modal header closes the Draft Editor; the view returns to the Calendar or Queue (per the source sub-screen) without a route change.

---

## Pattern: Quick Compose from the Channels Sidebar

Happens when users hover over a channel in the sidebar "Channels" list (NP-D14) and want to create content for that account right away without opening the Account Selector manually.

```
[Any section] → Sidebar → Channels → hover channel → [+]  → Draft Editor (new item, this account pre-selected)
```

**Trigger:** The "+" button appears when the channel is hovered (replacing the count badge), available from any section because Channels is always visible in the sidebar.

**Difference from the "+ New Post" CTA (NP-D09/NP-D12):** the sidebar/Calendar/Queue CTA opens an empty Draft Editor with no account selected — Quick Compose from Channels opens the Draft Editor with the **Account Selector already automatically choosing the clicked channel**, speeding up the "I want to post to Instagram now" flow without a manual account-pick step.

**Transition:** The Draft Editor (modal overlay, default variant Standard — ADR-052/ADR-065) opens on top of whichever sub-screen is active — same as New Post from the sidebar (NP-D12).

**Back:** The "Close" button returns the view to the source section/sub-screen without URL navigation.

---

## Pattern: Redirect after a Draft Editor Terminal Action

Happens when users finish one of the three terminal actions in the Draft Editor (Save as Draft, Schedule, Publish Now). The sidebar CTA "+ New Post" (NP-D12) means the Draft Editor can now be opened from any section — Home, Engage, Analyze, Settings — not only from inside Publish. These three actions do **not** follow the "Back to the source sub-screen" pattern of the Close button (KSP-05-F10) — each one directs the user to the **destination** sub-screen, where the content that was just processed now lives:

```
[Any section] → Draft Editor → [Save as Draft]  → Publish → Drafts
[Any section] → Draft Editor → [Schedule]        → Publish → Queue
[Any section] → Draft Editor → [Publish Now]     → Publish → History
                                                          (temporary: Calendar,
                                                           until History is built — KSP-D10)
```

**Reason:** Users must immediately see the result of their action in the relevant place — not be left in the source section (for example Home or Analyze) that is no longer related to the content just created. This complements UXP-04 (Publishing Trust): trust comes from seeing directly that the action succeeded and knowing where to check its status.

**Relationship with NP-D05:** NP-D05 ("no automatic redirect after cross-section navigation") applies to the case of error-status link → Settings, not to form terminal actions that create/change content. This pattern is defined separately (NP-D13) and does not change NP-D05.

---

## Pattern: Selected Post Comments (Thread Expansion)

Happens in Engage. Selecting a post opens its comments inside the Inbox — it does not open a new screen.

```
Engage → Inbox → [select post]  → Post comments appear in the right panel
                                    (sidebar stays visible, post list stays visible on the left)
```

On a narrow screen (375px) the post list and comments are separated with push navigation (list → comments, back button). In the List view there is no right panel; the reply composer is shown inline.

**Reason:** The comment triage volume can be high — users need to move quickly between posts without full-page navigation each time.

---

## Pattern: Status Indicator → Settings

Happens when users find a problem status on a work screen and need to go to Settings to fix it.

```
Calendar / Queue / Account Selector / Sidebar Channels → status "Disconnected" or "Failed"
    → [click indicator / error message / channel row]
    → Settings → Organization → Connected Accounts
```

**Transition:** Direct navigation to Settings — not the manual sidebar. The error message includes an action link ("Reconnect") that takes users straight to the right page.

**Back:** After the reconnect finishes, users can go back to the Calendar/Queue manually through the sidebar — there is no automatic redirect because the Calendar state may have changed.

---

## Pattern: Empty State → Onboarding Action

Happens on screens that have no data yet.

```
Analyze → Dashboard (empty)
    → "Connect Account" → Settings → Organization → Connected Accounts (UF-05)
    → "Create First Post" → Publish → Drafts → New Post (UF-01)

Engage → Inbox (empty)
    → "Start publishing to see engagement" → Publish → Drafts

Publish → History (empty)
    → "You haven't published anything yet" → Publish → Drafts → New Post
```

**Consistent pattern:** Every empty state includes one or two action links — there is no dead end. Users always know the next step (UXD-03).

---

# Notification Badge Pattern

The notification badge on the Engage item in the sidebar informs users that the 30-minute periodic pull or a manual refresh found unread comments — without disturbing the work flow in progress.

```
Badge behavior:
├── Appears: after a sync finds new unread comments in the Inbox
├── Number: shows the count of unread in the last 12 months, i.e. unreplied comments (capped at 99+; the 12-month limit is the same as the Inbox's default Date Range)
├── Disappears: when there are no more unread comments (all replied, Resolve, or Dismiss)
└── Stays visible from any section (persistent sidebar)
```

The badge is not a webhook or real-time indicator. The Inbox provides the last sync time and a Manual Refresh button so users can request the latest data without waiting for the next cycle (ADR-040).

**Principle:** The badge exists only on Engage — in line with the product's focus on the work cycle. There is no badge on Analytics or Publish because those two sections are not an "inbox" that demands an immediate response.

---

# Cross-Section Navigation Pattern

Some user flows involve moving between sections triggered by a link or action — not manual sidebar navigation.

## Deep Link to a Sub-Screen

Some actions take users straight to a specific sub-screen, bypassing the default tab.

```
Home → Analytics Snapshot → [click]  → Analyze → Dashboard
Home → Today's Schedule   → [click item]  → Publish → Calendar → Draft Editor (item)
Empty State Analytics     → [Create First Post]  → Publish → Drafts → Draft Editor (new)
```

**Principle:** Deep links are used only for meaningful actions — not as navigation replacing the sidebar. Users must still be able to reach the same destination through the sidebar manually.

---

## Back Navigation after Cross-Section

When users arrive in a new section through cross-section navigation (for example from a Calendar error → Settings), there is no automatic "back" button that returns to the previous position.

**Reason:** Too complex to handle at the navigation level without a clear history stack. Users use the sidebar to navigate back.

**Exception:** The Draft Editor (modal overlay, ADR-052/ADR-065) always has a Close button that returns the view to the source sub-screen inside the Publish section — because the modal is opened on top of the same sub-screen, not a cross-route drill-down. **Settings** is also an exception since ADR-077: because the persistent sidebar is replaced entirely by the dedicated Settings sidebar (not an ordinary drill-down inside the Main Content Area), that sidebar itself has a permanent back button ("← Settings") to Home — not a history-based back to the previous position, just one fixed destination.

---

# Decision Log

Navigation decisions made in this document.

| ID | Decision | Reason | Principle |
| -- | -------- | ------ | --------- |
| NP-D01 | Navigation model: Persistent Sidebar | Web app; the sidebar gives quick access between sections without losing context | UXP-01, NP-P01 |
| NP-D02 | ~~The Draft Editor is shown as a full panel/screen within Publish, not a modal overlay~~ — **Overridden by NP-D11 (ADR-052)** | Original reason: a modal covers the Calendar/Queue, users lose the schedule context while editing. This trade-off was later recognized & accepted for the sake of work-flow speed — see NP-D11 | NP-P02, UXP-04 |
| NP-D03 | Inbox comments per post: inline expansion, not a new screen (amended by ADR-157; previously "Thread Inbox") | High triage volume; users need to switch posts quickly without full-page nav | UXP-03, NP-P03 |
| NP-D04 | The notification badge is only on Engage | Only Engage needs an immediate response; badges in every section add noise | UXP-03, UXP-07 |
| NP-D05 | No automatic redirect after cross-section navigation | The source screen's state may have changed; an automatic redirect creates confusion | NP-P02 |
| NP-D06 | Publish defaults to the Calendar tab | The Calendar gives the best schedule overview for Raka and Maya (IA-D04) | UXP-02, P-IA-02 |
| NP-D07 | The User Avatar (user menu) is the only entry point to Settings (the Organization + Account groups). Since ADR-077, once inside, the persistent sidebar is replaced entirely by the dedicated Settings sidebar (Buffer pattern) with a back-navigation header — not shown side by side as a secondary nav | Settings is not daily access; it does not need a slot in the primary nav (IA-D05); one entry point is simpler than two separate entry points; a single sidebar with a back button is more compact than two sidebars side by side (ADR-077) | UXP-03 |
| NP-D08 | The Notifications Panel is an overlay, not a replacement for the Main Content Area | Users must be able to close the panel and return to work without losing state | NP-P02 |
| NP-D09 | The New Post CTA is available directly from the Calendar and Queue, not only from Drafts. Since NP-D12, the same CTA is also available in the Sidebar — the two complement, not replace, each other | Raka often finds schedule gaps while looking at the Calendar or Queue — forcing him to move to the Drafts tab first adds unnecessary friction. A CTA directly at the point where the need is found fits the work cycle flow (UXP-01) | UXP-01, UXP-03 |
| NP-D10 | Logout must go through a confirmation dialog (Tier 2) | Protects against interrupting unsaved work, even though the Logout action itself is reversible — part of the cross-product Safety Check/Double Confirmation policy (ADR-049, `key-screen-patterns.md`) | UXP-04 |
| NP-D11 | The Draft Editor (New Post & Edit Draft) becomes a **modal overlay**, overriding NP-D02. Two official display variants — **Standard** (default, ADR-065: a floating card 1120px wide since ADR-155 + dimmed backdrop, Calendar/Queue context stays visible) and **Fullscreen** (covers the whole viewport including the sidebar) — chosen through the official toggle in the modal header, not persisted between sessions | Wanted New Post/Edit Draft to feel faster/lighter without changing pages, consistent with the patterns of other tools — the trade-off of losing the visual context of the Calendar/Queue (the original reason for NP-D02) is accepted consciously for the sake of work-flow speed when the Fullscreen variant is chosen; the Standard default (ADR-065) keeps the context visible without forcing that trade-off up front. The old route was removed entirely (modal-only, no URL deep-link). Resume of unsaved state (localStorage) only for New Post, not for Edit Draft (ADR-052) | NP-P02, UXP-04 |
| NP-D12 | The Sidebar gets a "+ New Post" CTA pinned at the top of the sidebar (above the nav items), available from any section | Previously the New Post CTA existed only on the Calendar/Queue/Drafts screens (NP-D09) — users on Home/Engage/Analyze had to move to Publish first to create a new post. A common pattern in similar tools (primary CTA at the top of the sidebar) removes this extra step (ADR-053) | UXP-01, NP-P01 |
| NP-D13 | After a Draft Editor terminal action (Save as Draft / Schedule / Publish Now), users are directed to the **destination** sub-screen (Drafts / Queue / History-temporarily-Calendar) — not back to the source sub-screen like the Close button | The sidebar CTA (NP-D12) lets the Draft Editor be opened from any section; users need to see the result of their action right away in the relevant Publish section, not be left in the source section that is no longer related to the content just processed (ADR-054). Does not change NP-D05 (a different case: error-status link → Settings) | UXP-04 |
| NP-D14 | The Sidebar gets a "Channels" section — a quick-glance list of connected accounts (round avatar + brand logo badge overlay + account name + status), between the navigation items and the bottom zone, independently scrolling. Default: scheduled-posts count. Hover: a drag handle appears on the left of the row (personal reorder per user, **shift-on-hover** — the whole row content shifts, ADR-058 addendum overrides the initial "no-shift" decision) + a quick-compose "+" button (opens the Draft Editor, account pre-selected — **still no-shift/fixed-slot**, unchanged). Clicking a problem channel → Settings (an extension of an existing pattern) | King Rezi wanted channel-status visibility + a compose shortcut per account without leaving the work screen; positioning outside the 5 nav items keeps the sidebar based on the work flow, not an entity list (P-IA-01); shift-on-hover for the drag handle was re-chosen following another application's reference screenshot at King Rezi's explicit request (ADR-058) | UXP-01, UXP-04, NP-P01 |
| NP-D15 | Clicking an item in the Calendar opens a `Popover` (post summary + metrics for those already Published) first, not straight to the Draft Editor — a CTA inside the Popover opens the Draft Editor. Calendar only; Queue and Drafts do not change | King Rezi wanted the Buffer pattern: quick verification of a post's content/metrics without opening the full editor on every click. Limited to the Calendar only following the scope of the request, not extended to Queue/Drafts as a side effect (ADR-090, component corrected by ADR-091) | UXP-01, UXP-04 |

---

# Pattern Summary

| Context | Pattern | Transition |
| ------- | ------- | ---------- |
| Switch section (Home, Publish, etc.) | Click a sidebar item | Replace the Main Content Area content |
| Switch sub-screen within Publish | Click a tab (Calendar / Queue / Drafts / History) | Replace the content within the Publish section |
| Open an item from Calendar / Queue / Drafts | Click the item | Open the Draft Editor as a modal overlay, default variant Standard (ADR-052/NP-D11/ADR-065) |
| Create a new post from Calendar or Queue | Click the "New Post" CTA | Open an empty Draft Editor (modal); Close closes the modal back to the source sub-screen without URL navigation |
| Create a new post from any section | Click the "+ New Post" CTA in the Sidebar | Open an empty Draft Editor (modal), same as the CTA on Calendar/Queue/Drafts (NP-D12) |
| Finish a terminal action in the Draft Editor | Click Save as Draft / Schedule / Publish Now | The modal closes, redirect to Publish → Drafts / Queue / History-temporarily-Calendar (NP-D13) |
| Open post comments from the Inbox | Select a post | Comments shown inline in the right panel within the Inbox |
| Access Settings | Click User Avatar → dropdown | Navigate to Settings (Organization / Account); the persistent sidebar is replaced by the dedicated Settings sidebar + back button (ADR-077) |
| Open Notifications | Click the Notifications icon | Open the Notifications Panel (overlay) |
| Error status → Settings | Click the error indicator / action link | Navigate to Settings → Organization → Connected Accounts |
| Problem channel in the Channels sidebar → click | Click the channel row (Disconnected/Expired) | Navigate to Settings → Organization → Connected Accounts |
| Channel in the Channels sidebar → hover then click "+" | Click the quick-compose button | Open an empty Draft Editor (modal), this account automatically pre-selected |
| Empty state → first action | Click the CTA in the empty state | Navigate to the related section / sub-screen |

---

# Expected Output

Once this document is complete, the project must have:

* A defined main navigation model (Persistent Sidebar Navigation).
* Consistent primary, secondary, and in-section navigation patterns.
* Contextual navigation patterns for all critical drill-downs (Item → Editor, Thread, Error → Settings).
* Clear notification badge behavior.
* Documented cross-section navigation.
* A decision log traceable to the UX Principles and IA Decisions.

---

# Exit Criteria

Navigation Patterns are considered complete when:

* The main navigation model has been defined and aligns with the IA.
* Every critical screen-transition pattern has been documented.
* No navigation requires more than two levels.
* Every navigation decision can be traced to the UX Principles.
* No user flow (UF-01 through UF-06) requires a navigation pattern not documented here.

---

# Related Documents

* `README.md`
* `ux-principles.md`
* `information-architecture.md`
* `user-flows.md`
* `key-screen-patterns.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
