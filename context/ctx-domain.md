# Context — Domain

An index of **Bounded Contexts, shared types, and domain boundary rules**.  
Primary source: Architecture Baseline — domain model.

---

## Read first

| Document                                                                                                       | When                                               |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`../product-discovery/05-architecture/domain-model.md`](../product-discovery/05-architecture/domain-model.md) | Required before working in a domain / shared types |
| [`../product-discovery/05-architecture/README.md`](../product-discovery/05-architecture/README.md)             | Architecture Baseline v1.0 index (ADR-025)         |
| [`../packages/shared/`](../packages/shared/)                                                                   | Cross-BC ID, enum, value object implementation     |

---

## Bounded Contexts (quick recall)

| ID    | Context      | MVP      |
| ----- | ------------ | -------- |
| BC-01 | Identity     | Yes      |
| BC-02 | Workspace    | Yes      |
| BC-03 | Publishing   | Yes      |
| BC-04 | MCP Access   | Yes      |
| BC-05 | Engagement   | Yes      |
| BC-06 | Analytics    | Yes      |
| BC-07 | Start Page   | Yes      |
| BC-08 | Media        | Yes      |
| BC-09 | Notification | Yes      |
| BC-10 | Billing      | Post-MVP |

Code module: `apps/web/src/domains/<domain-name>/` (see `ctx-implementation.md`).

---

## Operating rules (domain)

1. Hard rules for shared types / cross-domain / domain-without-Prisma — see
   **`../AGENTS.md` rules 4, 5**, not repeated here.
2. Pass only **IDs** between domains where possible; do not share full aggregates across BCs.
3. Entity/table naming follows `domain-model.md` + ADR amendments (e.g. ADR-027 for the table naming exception).
4. Do not add a new BC or change a boundary without an ADR.
5. Publishing format: enum `ContentFormat` in `packages/shared`; the live value is in `PostTarget` (+ `platformOptions` JSON). Platform matrix & business defaults → `domain-model.md` / **ADR-039**. Outstand overrides only in the ACL.
6. MVP Engagement (**ADR-040**) is only comments and replies. Direct Messages,
   mentions, and engagement webhooks are not an MVP domain contract; new data comes
   from the internal 30-minute sync or manual refresh.
7. Outstand event names are not a domain enum/status. The ACL maps
   `post.published`, `post.error`, and `account.token_expired` to domain language.

Full boundary rules (BR-01 etc.) → `domain-model.md`.

---

## Related context

- Layers & service communication → `ctx-architecture.md`
- Folder & code patterns → `ctx-implementation.md`
- Product / roles → `ctx-business.md`
