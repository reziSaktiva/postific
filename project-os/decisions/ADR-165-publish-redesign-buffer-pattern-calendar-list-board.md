## Decision ADR-165

### Title

Publish follows the Buffer Publish pattern: one page with a Calendar · List · Board switcher, an Approvals view of `In Review`, inline video in the post preview, and best-time suggestions for an empty Queue (amends KSP-02, KSP-03, KSP-04, the Publish part of the Information Architecture, and KSP-02-F09 / decision T-032.0 on the per-view timezone)

### Status

**Accepted** (King Rezi's decisions in chat, 2026-11-24, through `AskUserQuestion`; answers recorded in "King Rezi's answers"). The design `ScreenPublishRedesain` was confirmed by King Rezi in the Postific Design Review gallery on 2026-11-24, before this ADR (the same order as ADR-155 and ADR-157).

### Date

2026-11-24

### Context

King Rezi asked for the Publish page to work like Buffer's Publish page (`publish.buffer.com/schedule`). Buffer was observed on 2026-11-24 with REA (page inspection, accessibility tree, scripted clicks, screenshots at 1200, 768 and 390 px; no source code read) and with Claude in Chrome. Findings:

- One Publish page with a view switcher (radio group) **Calendar · List · Board** and "+ New Post".
- **Calendar**: Month and Week, Today, Filter, "No Date" (posts without a date), a timezone picker. Month cells show up to 3 post chips, then "N More"; an empty future day is a button that schedules a post on that date.
- **List**: tabs **Queue · Drafts · Approvals · Sent** with counts; posts grouped by day; an empty Queue offers recommended time slots per channel.
- **Board**: columns **Draft · Approvals · Scheduled · Published · Failed**, "Group by Status".
- **Post preview**: clicking a post opens a popover; **Expand** opens a "View Post details" modal with metrics and "Published via".
- **Video**: Buffer never plays a published video. The preview shows a still thumbnail with a ▶ mark; clicking it does nothing, there is no `<video>` element, and no video file is loaded. Watching means "Go to post" on the network.
- **Tablet (768 px)**: the sidebar becomes an icon rail, month chips become icon-only with "+N". **Phone (390 px)**: a top bar with ☰, a "+" icon for New Post, the Calendar switches to a 3-day view (from 500 px), and the List tabs become a dropdown.

Postific's Publish today follows KSP-02 (Calendar), KSP-03 (Queue), KSP-04 (Drafts) and History: four route tabs under one header (`apps/web/src/app/(app)/publish/`).

Outstand was checked for best-time data on 2026-11-24 through the Outstand MCP (`get_account_metrics`, `get_audience_demographics`, `list_posts`, `get_post_analytics`, documentation search) on the real connected accounts. Outstand has **no** best-time, followers-online or per-hour data: account metrics are period totals plus Instagram new followers per day, demographics are country, city, age and gender only, and the docs say the app decides posting times. Each published post does have its publish time and per-account metrics (reach, likes, comments, shares, engagement rate), and Postific already stores those per post and account in `AnalyticsPostMetric`.

### Decision

1. **One Publish page with a view switcher Calendar · List · Board.** The route tabs Calendar / Queue / Drafts / History are replaced by the switcher; Queue, Drafts, Approvals and History become tabs inside List. The Buffer pattern is imitated (layout and behavior), not its code, assets, branding or text; built from shadcn/ui (ADR-097) and Postific tokens. The confirmed design is `ScreenPublishRedesain` in the Postific artifact (ADR-140).
2. **The published-posts tab keeps the name History** (not Buffer's "Sent").
3. **Approvals is a lightweight view of the existing `In Review` status**, in the List tab and as a Board column, with the transitions that already exist (`In Review` → `Ready to Schedule`, `In Review` → `Draft`). No approvers, no enforcement, no new permission. Anyone can still skip `In Review`. This stays inside `roles-permissions.md` rule 4 (no layered Approval Workflow in MVP).
4. **Board is part of this redesign.** `Ready to Schedule` posts sit in the Draft column with a "Ready to Schedule" badge; there is no separate column. Board grouping is by Status only.
5. **A published video plays inline** in the post preview popover and the expanded modal, with the browser's native video player, unlike Buffer.
6. **The post preview is per account**, matching today's per-target calendar chips; Expand also lists the result of every account of the same post (the History Detail pattern). Buffer's "Add note" is left out (Postific has no notes).
7. **The page timezone picker is view-only.** It changes how times are shown on Publish; the user's Profile timezone (T-147) stays the default and is not changed by it. This reverses the part of KSP-02-F09 that left a per-view timezone "not adopted" (consistent with decision T-032.0 for the Queue); the rest of KSP-02-F09 is unchanged by this point.
8. **"Save current view" is left out** of this redesign. Publish reopens the last view used.
9. **An empty Queue suggests best times calculated by Postific**, per connected account, from that account's own published posts: publish time grouped by weekday and hour in the user's timezone, ranked by engagement from `AnalyticsPostMetric`. No new Outstand capability is used. An account without enough history shows no suggestion. Thresholds and ranking are set in the spec.
10. **Responsive behavior follows the design**: icon rail and icon-only month chips on tablet; top bar, "+" New Post, icon-only switcher, 3-day calendar and dropdown List tabs on phone.
11. **Design first, then code.** Code follows only through tickets of spec S-008 (`AGENTS.md` hard rules 10 and 13).

### King Rezi's answers (2026-11-24)

| #   | Question                                    | Answer                                                                                                      |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Q1  | Approvals in the design                     | Include it; the ADR and spec come after the design is approved                                              |
| Q2  | Board view                                  | Include it                                                                                                  |
| Q3  | Video in the post preview                   | Play inline (unlike Buffer)                                                                                 |
| Q4  | Name of the published tab                   | History                                                                                                     |
| Q5  | How far Approvals goes                      | Lightweight view of `In Review`, existing transitions only                                                  |
| Q6  | Where `Ready to Schedule` goes on the Board | Draft column with a badge                                                                                   |
| Q7  | Empty Queue recommended times               | Research Outstand first (done: no best-time data), then: a Postific best-time calculation, in this redesign |
| Q8  | Page timezone picker                        | View only                                                                                                   |
| Q9  | Save current view                           | Leave it out for now                                                                                        |
| Q10 | Post preview scope                          | Per account, with the results of every account in Expand                                                    |

Design details accepted with the confirmed design, not asked separately: "+N lainnya" opens a popover list of that day's posts; Group by offers Status only; around 1024 px calendar chip thumbnails are hidden to avoid overflow; the week starts on Monday as in today's Calendar.

### Reason

- King Rezi asked for Buffer's Publish experience; the persona Raka already knows Buffer's patterns from the Draft Editor (ADR-155) and Engage (ADR-157).
- One page with three views over the same posts removes the route hopping between Calendar, Queue, Drafts and History.
- `In Review` and `Ready to Schedule` already exist as lightweight statuses, so an Approvals view needs no new data or permission.
- Playing video inline lets the team check a published video without leaving Postific, which Buffer does not offer.
- Outstand has no best-time data, but Postific already stores per-post, per-account metrics and publish times, so suggestions can be calculated without a new vendor capability.

### Alternatives Considered

- **Keep the four route tabs, restyle only:** not chosen; does not give the Buffer experience asked for.
- **Buffer's "Sent" name:** not chosen (Q4).
- **A real approval workflow with approvers and enforcement:** not chosen (Q5); breaks the MVP rule in `roles-permissions.md` and needs data and permission changes.
- **A separate Ready to Schedule column, or Ready posts under Approvals:** not chosen (Q6).
- **Thumbnail only, like Buffer:** not chosen (Q3).
- **A plain empty Queue, or user-set posting slots:** not chosen (Q7). Posting slots remain a possible later feature.
- **A timezone picker that writes the Profile, or no picker:** not chosen (Q8).
- **Named saved views:** deferred (Q9).

### Consequences

- Code changes in `apps/` and `packages/` go through tickets of spec S-008. No code in the session that wrote this ADR.
- KSP-02, KSP-03, KSP-04 and the Publish part of `information-architecture.md` (and `navigation-patterns.md` where it names the Publish tabs) are aligned in an S-008 ticket, not now.
- The best-time calculation reads `AnalyticsPostMetric` and post publish times through the `analytics` domain's public API; the Publish screen does not query analytics tables directly (`AGENTS.md` hard rule 5). It inherits the freshness of the analytics ingestion; it adds no Outstand call.
- Inline video needs a playable media URL for published posts. Where Postific only holds a thumbnail (imported posts keep small thumbnails, ADR-158), the preview shows the thumbnail with "Go to post"; the spec covers this.
- Existing route URLs `/publish/calendar`, `/publish/queue`, `/publish/drafts`, `/publish/history` keep working (redirect or map to the matching view) so links and the MCP surface do not break; the spec sets how.
