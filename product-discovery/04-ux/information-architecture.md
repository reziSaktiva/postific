# Information Architecture

This document defines the **navigation structure, screen hierarchy, and feature grouping** of the **Postific** product.

The IA is designed based on the UX Principles already set — specifically UXP-01 (one work cycle), UXP-02 (two work modes), and UXP-03 (simplicity as a quality bar). Every structural decision here must be traceable to those principles.

---

# Overview

Information Architecture defines two main things:

1. **Navigation structure** — how users move between parts of the application.
2. **Screen hierarchy** — what is inside each part.

The IA does not define visual layout, interaction, or code. This document is the structural blueprint that serves as a reference for User Flows, Navigation Patterns, and Key Screen Patterns.

---

# IA Principles

This IA is built on three main principles.

## P-IA-01 — Navigation Reflects the Work Cycle, Not Feature Categories

**Derived from:** UXP-01

The primary navigation is not arranged as a list of modules (Publishing, Analytics, Engagement). It is arranged as the stages of a sequential, natural work cycle:

```
Publish → Engage → Analyze
```

Users must feel they are following one flow, not moving between separate applications.

---

## P-IA-02 — Two Entry Points: Execution and Overview

**Derived from:** UXP-02

Raka needs to go straight into work. Maya needs to see the status picture quickly.

The IA provides:

- **Home** — an entry point with a status summary for Maya's visibility needs.
- **Publish** — an entry point straight into work for Raka's execution needs.

Both are first-class entry points in the navigation.

---

## P-IA-03 — Two Levels Deep, No More

**Derived from:** UXP-03

Navigation is at most two levels: **primary section → sub-screen**. There is no nested navigation that forces users to dig three levels down to reach a core feature.

---

# Navigation Structure

## Primary Navigation

Primary navigation is the main navigation that is always visible and can be accessed at any time.

| # | Label | Description |
| - | ----- | ----------- |
| 1 | Home | Status summary and latest activity |
| 2 | Publish | The whole content publishing work area |
| 3 | Engage | Audience comments inbox |
| 4 | Analyze | Performance dashboard |
| 5 | Start Page | Public page management |

The navigation order is not alphabetical — the order reflects the **product value flow** from I-05:
Publishing reliability → Engagement triage → Analytics snapshot.

---

## Secondary Navigation

Secondary navigation is accessed through fixed elements outside the primary nav — it does not use a slot in the primary nav.

| Label | Accessed Via | Contents |
| ----- | ------------ | -------- |
| Settings | Avatar / user menu | The **Organization** group (team members, connected accounts, permissions, branding, billing) and the **Account** group (user workspaces + switch/create workspace, user profile, notifications, preferences, AI clients (MCP) — ADR-088, ADR-139). Once inside, the primary nav (workspace sidebar) is **replaced entirely** by a dedicated Settings sidebar in the same slot — not shown side by side — with a back-navigation header above it (ADR-077) |
| Notifications | Notification icon | In-app notifications |

---

## What Is Not in the Navigation

Based on UXP-05 and UXP-03, several elements are deliberately **not** navigation items:

- **AI Assistant** — removed (ADR-138); there is no built-in AI and no AI menu or control in the Draft Editor. The user's AI works through MCP. MCP entry points in the UI: the OAuth consent screen (shown after logging in through an AI client, outside the app shell), the list and revocation of clients in **Settings → Account → Klien AI**, and the MCP source badge and filter in History, Drafts, and Queue (ADR-139, decision 2026-10-23).
- **Media Library** — accessed from inside the Draft Editor, not from the primary nav (Should Have, not a primary entry point).
- **Approval Workflow** — none; replaced by status visibility (UXP-06).

---

# Screen Hierarchy

## 1. Home

An entry point that gives a status summary across domains.

```
Home
├── Today's Schedule          — content scheduled for today
├── Recent Activity           — latest publishing activity (success / failure)
├── Engagement Snapshot       — number of unread comments (last 12 months) from the last sync
└── Analytics Snapshot        — this week's performance highlights
```

**Primary user:** Maya (visibility mode).
**Secondary user:** Raka (initial orientation before going into Publish).

Home does not replace the work screens. Home is an orientation screen.

---

## 2. Publish

The main daily work area. This is the biggest section in the product.

```
Publish
├── Calendar                  — view of content schedule per day / week / month
│   └── Draft Item            — open an item from the calendar → goes into the Draft Editor
├── Queue                     — queue of scheduled posts, ordered purely by publish time (ADR-083; a per-account filter is available as a separate control, not the main grouping structure)
│   └── Draft Item            — open an item from the queue → goes into the Draft Editor
├── Drafts                    — all drafts not yet scheduled
│   └── Draft Editor          — create / edit content
│       ├── Caption Editor    — caption writing area
│       ├── Media Attachment  — attach images / video
│       ├── Account Selector  — choose destination accounts through the channel row: Channels popover, account chips (ADR-155)
│       ├── Content Format    — Post / Reel / Story / Pin per account (ADR-039)
│       ├── Per-Network Block — accordion containing the format, platform fields, and inline validation (ADR-155)
│       ├── Live Preview      — per-platform preview in the right panel (ADR-155)
│       ├── Schedule Picker   — set the publish time
│       ├── Publish Now       — publish immediately without a schedule, all roles (Account Owner/Admin/Creator, ADR-047/ADR-074)
│       └── Status Indicator  — draft / in review / ready to schedule / scheduled / published / failed
└── History                   — history of content that has been published
    └── Post Detail           — post detail + basic performance
```

**Primary user:** Raka (daily publishing execution).
**Note:** There is no built-in AI (ADR-138); the user's AI creates drafts through MCP. The Content Format Selector follows the platform matrix (IG/FB: Post·Reel·Story; Pinterest: Pin; TikTok & others: Post). Publish Now is available alongside the Schedule Picker for all roles — Account Owner, Admin, and Creator (ADR-047, ADR-074, `roles-permissions.md`).

---

## 3. Engage

The area for handling incoming audience interactions.

```
Engage
└── Inbox
    ├── Sync Status + Manual Refresh
    ├── View options          — By post (default) / List
    ├── Main filters          — by account, by status
    ├── Filter & Sort         — platform, sort, date range, Reset filters
    ├── Post List             — posts with comments + a "Tanpa posting" group
    ├── Post Comments         — post card (context) + comment list
    │   └── Reply Action      — reply to a comment
    └── Comment status        — unread / replied / resolved / dismissed (Resolve, Dismiss, Buka kembali)
```

**Primary user:** Raka / Community Manager.
**Note:** The structure was amended by ADR-157 (Engage per post; details in KSP-06). The Inbox fetches comments through a periodic pull every 30 minutes and provides a manual refresh. Direct Message, mention, and engagement webhooks are not part of the MVP (ADR-040).

---

## 4. Analyze

The area for reviewing content performance.

```
Analyze
└── Dashboard
    ├── Account Overview      — performance per social account
    ├── Post Performance      — metrics per post
    └── Engagement Summary    — summary of interactions in the period
```

**Primary user:** Maya (weekly review).
**Secondary user:** Raka (understanding the performance of published content).

---

## 5. Start Page

The area for managing the public page (link-in-bio).

```
Start Page
├── Page Editor               — arrange the look of the public page
│   ├── Profile               — title, slug, bio, photo (https URL), Simpan button
│   ├── Link List             — add / edit (Dialog) / delete / reorder links
│   └── Theme Selector        — ToggleGroup of 3 presets: Default, Dark, Aksen
├── Preview                   — see how the page looks per the draft before saving
└── Share                     — copy the public page URL + Publish/Unpublish
```

Basic analytics (total visits in the page-head, clicks per link in the Link List) only appear in the Page Editor, not on the public page. Full numbers (id-ID) below 10,000, abbreviated from 10,000; with no data, `0` + a hint is shown. UI choices and access rights: ADR-144; source of the numbers: ADR-143.

**Public page unavailable:** an address `/u/<slug>` whose slug does not exist **or** whose page has not been published shows a single custom 404 screen (T-166). The screen stands alone outside the app shell, anonymous with no app navigation: a search icon, the title "Halaman tidak ditemukan", a short description, and the same "Powered by Postific" badge footer as the public page. The copy is deliberately identical for both cases so that draft status does not leak, and with no link or button to the home page. Visual form: the `ScreenStartPageNotFound` screen in the Postific artifact (confirmed by King Rezi, 2026-10-29).

**Primary user:** Raka / anyone who manages the brand's public profile.

---

## 6. Settings

Accessed via the avatar / user menu — not a daily work screen. It consists of two groups: **Organization** (workspace management, only for authorized roles) and **Account** (the user's personal preferences, including switch/create workspace — ADR-088). Once inside, the primary nav (workspace sidebar) is replaced entirely by a single dedicated Settings sidebar in the same slot — the Buffer pattern, not two sidebars side by side — with a back-navigation header ("← Settings") above it that links back to the app's main page (ADR-077).

```
Settings
├── Organization
│   ├── General                   — organization name, timezone, brand settings
│   ├── Connected Accounts        — manage connected social media accounts
│   ├── Members                   — invite, manage team members
│   ├── Roles & Permissions       — set access rights per role
│   └── Billing                   — subscription and payment
└── Account
    ├── Workspaces                — the user's workspace list, switch the active workspace, create a new workspace (ADR-088)
    ├── Profile                   — name, photo, email, time zone (per user, ADR-146)
    ├── Notifications             — email and in-app notification preferences
    ├── Preferences               — personal display settings
    └── Klien AI                  — the user's own connected AI clients (MCP), plus a revoke button (ADR-139)
```

**Klien AI** is in the **Account** group because each connection is a grant owned by one user (user + client + workspace + scope). Users only see and revoke their own connections; Owner/Admin do not see other members' connections.

---

# Feature to Screen Mapping

The table below maps MVP (Must Have) features to specific screens in the IA.

| Feature (MVP Must Have) | Screen |
| ----------------------- | ------ |
| Workspace Management | Settings → Organization → General |
| Workspace Switch & Create (ADR-088) | Settings → Account → Workspaces |
| Team Members | Settings → Organization → Members |
| Roles & Permissions | Settings → Organization → Roles & Permissions |
| Social Account Connection | Settings → Organization → Connected Accounts |
| AI client connection (MCP, ADR-139) | Consent: a two-step OAuth screen outside the app shell (Choose Workspace → Scope Consent); manage and revoke: Settings → Account → Klien AI |
| MCP source marker (ADR-138) | Publish → History, Drafts, Queue (source badge and filter); Calendar gets no badge |
| Content Draft | Publish → Drafts → Draft Editor |
| Content Format Selection (ADR-039) | Publish → Draft Editor → Content Format per account |
| Schedule Post | Publish → Draft Editor → Schedule Picker |
| Publish Now (ADR-047) | Publish → Draft Editor → Publish Now Action |
| Calendar View | Publish → Calendar |
| Queue Management | Publish → Queue |
| Publishing History | Publish → History |
| Comments (view + reply) | Engage → Inbox → Post Comments |
| Inbox | Engage → Inbox |
| Analytics Dashboard | Analyze → Dashboard |
| Basic Performance Metrics | Analyze → Dashboard → Post Performance |
| Engagement Summary | Analyze → Dashboard → Engagement Summary |
| Link Management | Start Page → Page Editor → Link List |
| Public Page | Start Page → Preview + Share |
| Public page unavailable (slug missing / draft) | Public 404 outside the app shell (IA-D12, T-166) |

---

# Entry Points per Persona

## Raka (Daily User — Execution)

```
Login → Publish → Calendar / Queue / Drafts → Draft Editor → Schedule → Done
                                                           ↘ History (verification)
       → Engage → Inbox → Reply
```

Raka does not need to pass through Home to start work. Publish is the direct entry point.

---

## Maya (Buyer — Visibility)

```
Login → Home → status summary
              ↘ Analyze → Dashboard → weekly review
              ↘ Publish → Calendar → check the active schedule
```

Maya does not need to go into the Draft Editor to get the information she needs.

---

# Decision Log

Structural decisions made in this document.

| ID | Decision | Reason | Principle |
| -- | -------- | ------ | --------- |
| IA-D01 | Primary navigation: Home, Publish, Engage, Analyze, Start Page | Reflects the product value cycle, not a feature list | UXP-01, UXP-07 |
| IA-D02 | AI is not a navigation item | The built-in AI was removed (ADR-138); there is no AI menu or navigation item. The user's AI comes in through MCP (Settings → Account → Klien AI, IA-D08) | UXP-05 |
| IA-D03 | Home as an orientation screen, not a work dashboard | Serves Maya without disrupting Raka's flow | UXP-02 |
| IA-D04 | Calendar as the default view in Publish | Calendar gives the best overview of content status | UXP-02, UXP-04 |
| IA-D05 | Settings (Organization + Account groups) outside the primary nav, accessed via the avatar/user menu | Not daily access — do not fill the main navigation slots | UXP-03 |
| IA-D06 | Navigation depth is at most two levels | More than two levels adds cognitive load without value | UXP-03 |
| IA-D07 | Media Library is not in the primary nav | Accessed from the Draft Editor (Should Have) — not a primary entry point | UXP-03 |
| IA-D08 | AI clients (MCP) live in Settings → Account → Klien AI, not in Organization (ADR-139) | A grant is personal: one user, one client, one workspace, one set of scopes. The menu already exists and adds no navigation slot | UXP-03 |
| IA-D09 | Users only see and revoke their own AI client connections; Owner/Admin do not see other members' connections | Keeps the screen simple (no owner column) and fits the personal nature of the grant; decision by King Rezi 2026-10-23 | UXP-03 |
| IA-D10 | The OAuth consent screen stands outside the app shell and runs in two steps: choose a workspace, then scope consent (ADR-139) | The workspace must be fixed before consent (result of the T-148 spike); this screen appears from an external AI client, not from the application navigation | UXP-04 |
| IA-D11 | The MCP source badge and filter appear in History, Drafts, and Queue; Calendar gets no badge | Those three list screens are what users use to review AI work; the already-locked Calendar is not touched (decision by King Rezi 2026-10-23) | UXP-04, UXP-06 |
| IA-D12 | A missing slug and an unpublished page use the same single public 404 screen, with identical copy and no link to the home page | Draft status must not leak to anonymous visitors; the screen stays minimal and does not steer visitors to the product. Decision by King Rezi 2026-10-29 (design `ScreenStartPageNotFound`, T-166) | UXP-03 |

---

# Expected Output

Once this document is complete, the project must have:

* A clear navigation structure with primary and secondary nav defined.
* A complete screen hierarchy for all MVP domains.
* A mapping of MVP features to specific screens.
* Documented entry points per persona.
* A decision log traceable to the UX Principles.

---

# Exit Criteria

Information Architecture is considered complete when:

* Primary navigation has been defined and aligns with the product's work cycle.
* The screen hierarchy covers all Must Have MVP features.
* Every structural decision can be traced to the UX Principles.
* No Must Have feature lacks a screen in the IA.
* No navigation conflicts with Product Baseline v1.0.

---

# Related Documents

* `README.md`
* `ux-principles.md`
* `user-flows.md`
* `navigation-patterns.md`
* `key-screen-patterns.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
