# Context — Business (+ Product + User)

An index of **why the product exists**, **what is built in the MVP**, and **who the users are**.  
Option A: Product + User are combined in this file (not separate `ctx-*` files).

---

## Read first

### Business — `01-business/`

| Document                                                                                   | Summary                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [`../product-discovery/01-business/README.md`](../product-discovery/01-business/README.md) | Business Baseline v1.0 index (ADR-007)                 |
| [`product-vision.md`](../product-discovery/01-business/product-vision.md)                  | Product vision                                         |
| [`problem-statement.md`](../product-discovery/01-business/problem-statement.md)            | The problem being solved                               |
| [`target-market.md`](../product-discovery/01-business/target-market.md)                    | Marketing Team (primary); Startup & Agency (secondary) |

### Product — `02-product/`

| Document                                                                                 | Summary                                                                       |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`../product-discovery/02-product/README.md`](../product-discovery/02-product/README.md) | Product Baseline v1.0 index (ADR-008)                                         |
| [`mvp-definition.md`](../product-discovery/02-product/mvp-definition.md)                 | MVP boundary                                                                  |
| [`product-scope.md`](../product-discovery/02-product/product-scope.md)                   | Scope / non-scope                                                             |
| [`feature-modules.md`](../product-discovery/02-product/feature-modules.md)               | Feature modules                                                               |
| [`feature-priority.md`](../product-discovery/02-product/feature-priority.md)             | Priority                                                                      |
| [`roles-permissions.md`](../product-discovery/02-product/roles-permissions.md)           | Account Owner / Admin / Creator + canonical content status (ADR-012, ADR-074) |

### User — `03-user/`

| Document                                                                           | Summary                                      |
| ---------------------------------------------------------------------------------- | -------------------------------------------- |
| [`../product-discovery/03-user/README.md`](../product-discovery/03-user/README.md) | User Discovery Baseline v1.0 index (ADR-009) |
| [`user-personas.md`](../product-discovery/03-user/user-personas.md)                | Canonical personas                           |
| [`jobs-to-be-done.md`](../product-discovery/03-user/jobs-to-be-done.md)            | JTBD                                         |
| [`user-scenarios.md`](../product-discovery/03-user/user-scenarios.md)              | Main scenarios                               |

---

## Operating rules

1. **Canonical personas** (do not rename): Raka, Maya, Sinta, Dimas, Lara.
2. Canonical roles (ADR-074): Account Owner, Admin, Creator — detail & content status transitions come only from `roles-permissions.md`.
3. Do not add features outside the MVP/scope without an ADR + a Product Baseline update.
4. Canonical content status (Draft → … → Published/Failed) must be consistent with `roles-permissions.md` and UX.
5. Pricing / competitor / business metrics discussion → read `01-business/`; do not invent new numbers or positioning in code.
6. The MVP Engagement scope follows ADR-040: comments + replies through a 30-minute
   sync and manual refresh. Direct Messages, mentions, and engagement webhooks
   are not MVP.

---

## MVP (quick recall)

Core modules: Workspace, Publishing, Analytics, Engagement, MCP Access (ADR-138), Start Page (+ Identity, Media, Notification as supporting).

Billing (BC-10) = **Post-MVP**.

Module/BC detail → `ctx-domain.md`. Screen flows → `ctx-design.md` (UX).

---

## Related context

- Domain / BC → `ctx-domain.md`
- UX & visual → `ctx-design.md`
- Project governance → `ctx-project.md`
