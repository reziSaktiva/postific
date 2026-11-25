## Decision ADR-166

### Title

Lists that can grow without bound load 20 items at a time with infinite scroll and cursor-based queries (Publish List and Board, Engage list and comments, Draft Editor media picker, Notifications panel); the fixed caps on those lists are removed (amends KSP-03, KSP-04, KSP-06, the KSP-05 media picker, the Notifications panel, and the S-008 Board column cap)

### Status

**Accepted** (King Rezi's decision in chat, 2026-11-25). The visual states (loading, end of list, error with retry) still need a design confirmed by King Rezi in the Postific Design Review gallery before code (`AGENTS.md` rule 10).

### Date

2026-11-25

### Context

On 2026-11-24 the Publish Board in the Cook It Real Good workspace went black: 100+ cards made the page about 18 000 px tall. The S-008 wave fixed the page height by scrolling each column on its own, and King Rezi asked for infinite scroll wherever a list can grow without bound, in the next wave (T-298). An audit of every page on Cook It Real Good found:

| Section                                       | Today                                      |
| --------------------------------------------- | ------------------------------------------ |
| Publish · List · History                      | 503 cards at once, no limit                |
| Publish · Board columns                       | hard cap of 100, shown as "100+"           |
| Publish · List · Drafts, Approvals, Queue     | no limit                                   |
| Engage · List view                            | cap of 200 inbox items, older ones missing |
| Engage · comments of one post                 | up to 1 000 at once                        |
| Draft Editor · media picker                   | whole media library, no limit              |
| Notifications panel                           | cap of 50, older ones unreachable          |
| Calendar, Home, Analyze, Start Page, Settings | bounded by a date range or small           |

Unbounded lists make the page slow and heavy on a large workspace; capped lists hide older items with no way to reach them.

### Decision

1. **Infinite scroll on the sections in the table above**, except Calendar, Home, Analyze, Start Page and Settings, which stay as they are. Each Board column scrolls and loads on its own.
2. **Page size is 20 items** (King Rezi, 2026-11-24), the same for every section. The next page loads automatically as the user nears the end of the list; there is no "Load more" button as the main control.
3. **Cursor-based queries** with a stable order (the list's sort time plus the id as tie-breaker). No offset paging, so new items arriving while the user scrolls do not shift or repeat pages.
4. **Counts stay true.** Tab counts and Board column counts come from a count query, not from the length of the loaded page. The "100+" Board label goes away.
5. **Realtime updates and filters keep working** with paged data: a filter change starts again from the first page; a realtime insert or status change updates the loaded items and the counts.
6. **One pattern for every list** (King Rezi, 2026-11-25): while the next page loads, 2 to 3 shadcn `Skeleton` rows shaped like that list's items appear at the bottom; at the end of the list a short muted line says the user has reached the end; a failed page shows an inline `Alert` with Retry. The exact look is set by the design confirmed in the gallery.
7. **Database indexes** that the cursor queries need may be added as additive composite-index migrations (King Rezi's pre-approval, 2026-11-25). Any other schema change needs its own permission.
8. **MCP read tools keep their current behavior.** Where an MCP tool uses a list query that changes, the old query stays until a separate decision.
9. **Delivery:** spec S-009 (tickets T-301 to T-305). Design first, then code (`AGENTS.md` rules 10 and 13).

### King Rezi's answers

| #   | Question                      | Answer                                                                    |
| --- | ----------------------------- | ------------------------------------------------------------------------- |
| Q1  | Where infinite scroll applies | Every list that can grow without bound, per the audit (2026-11-24, T-298) |
| Q2  | Page size                     | 20 items (2026-11-24)                                                     |
| Q3  | Wave shape                    | Design gate, then code in the same wave (2026-11-25)                      |
| Q4  | Planning unit                 | Its own spec S-009 with tickets (2026-11-25)                              |
| Q5  | Index migrations              | Pre-approved, additive composite indexes only (2026-11-25)                |
| Q6  | Loading pattern               | Skeleton rows, end-of-list line, inline Alert with Retry (2026-11-25)     |
| Q7  | E2E data                      | Cook It Real Good, the real test account (2026-11-25)                     |

### Addendum 2026-11-25 (design gate, King Rezi's answers in chat)

1. **The Draft Editor media picker is dropped from this decision and from S-009.** The picker does not exist yet ("pick from Media Library" is a Coming soon tooltip in the Draft Editor), so there is no list to page. When the Media Library picker is built, it follows this pattern from the start.
2. **Notifications panel copy is in English**, matching its header ("You've reached the oldest notification.", "Couldn't load more notifications", "Retry"). The other surfaces follow their screens' Indonesian copy.
3. **Retry is a small outline button** inside the destructive Alert.
4. **Each Publish List tab has its own end-of-list line** (Queue, Drafts, Approvals, History); the wording is in the confirmed design.
5. **The next page loads through a GET Route Handler, not a Server Action** (King Rezi, 2026-11-25, after the T-301 architecture review). This follows RS-D01 and ADR-095 (Server Actions only for mutations); it is not an exception to them. The first page is still rendered on the server. Each list has a small GET endpoint that only calls its Application Service (hard rule 3); it validates the cursor from the browser and answers an invalid one with an error. The existing read-only actions `listInboxAction` and `getHistoryPostAction` are pre-existing drift; a section ticket replaces one only where it touches it.

### Consequences

- The UX baseline (`product-discovery/04-ux/key-screen-patterns.md`) gains a cross-screen "Long lists" pattern once this ADR is Accepted (T-301).
- Repository queries for the listed sections change shape (cursor in, page plus next cursor out) and get integration tests.
- E2E runs on Cook It Real Good; a section with fewer than 21 items there cannot prove a second page and is recorded as not yet proven.

### Alternatives considered

- **Numbered pages:** rejected; it breaks the Board columns and the day-grouped List, and is not the Buffer pattern the S-008 redesign follows.
- **A "Load more" button only:** rejected as the main control (King Rezi asked for infinite scroll); Retry on error is still a button.
- **Raising the caps:** rejected; it only moves the problem.
