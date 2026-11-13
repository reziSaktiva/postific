# Context — Architecture

An index of **what & why the system** is built the way it is: layer, integration, jobs, auth architecture, realtime, DB strategy.  
Not the place for env config, DX scripts, or code style.

---

## Read first

| Document                                                                                           | Topic                                                             |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`../project-os/ARCHITECTURE_OVERVIEW.md`](../project-os/ARCHITECTURE_OVERVIEW.md)                 | High-level orientation                                            |
| [`../product-discovery/05-architecture/README.md`](../product-discovery/05-architecture/README.md) | Architecture Baseline v1.0 index (ADR-025)                        |
| [`application-layer.md`](../product-discovery/05-architecture/application-layer.md)                | 4-layer stack, entry points, services, repository, error handling |
| [`domain-model.md`](../product-discovery/05-architecture/domain-model.md)                          | BC & boundary (detail also in `ctx-domain.md`)                    |
| [`database-strategy.md`](../product-discovery/05-architecture/database-strategy.md)                | Multi-tenancy RLS, tables, storage, soft delete                   |
| [`integration-layer.md`](../product-discovery/05-architecture/integration-layer.md)                | Outstand ACL, OAuth, publish, media upload, webhook, comment sync |
| [`background-jobs.md`](../product-discovery/05-architecture/background-jobs.md)                    | Postgres job queue, Railway Cron, job types                       |
| [`realtime-strategy.md`](../product-discovery/05-architecture/realtime-strategy.md)                | Supabase Realtime for notifications                               |
| [`auth-architecture.md`](../product-discovery/05-architecture/auth-architecture.md)                | Session, workspace context via cookie, RBAC in service, RLS       |

---

## Layer stack (quick recall)

```text
Entry Points (RSC / Server Actions / Route Handlers / Middleware)
    → Application Service (one per BC)
        → Domain Logic (pure)
            → Repository (interface in domain; Prisma impl)
                → Infrastructure (Postgres, Storage, Better Auth, Outstand via ACL)
```

---

## Operating rules

1. Hard rules for entry points (no business logic) & Supabase JS (Realtime+Storage
   only, CRUD through Prisma) — see **`../AGENTS.md` rules 5, 9**, not repeated
   here. Supabase engineering detail: `ctx-technical-context.md`.
2. Social integration **only** through the Anti-Corruption Layer (OutstandAdapter) — not a direct network SDK.
3. RBAC is evaluated in the Application Service; RLS = defense-in-depth.
4. Cross-domain through the public API — see `application-layer.md` + `ctx-domain.md`.
5. Do not change the Architecture Baseline without a new ADR.
6. The MVP Outstand contract follows **ADR-040**:
   - webhooks are only `post.published`, `post.error`, and `account.token_expired`;
   - HMAC verification of the raw body → durable idempotent receipt in
     `outstand_webhook_events` → ACK `2xx` → internal processing/retry;
   - Engagement is only comments/replies through a 30-minute sync + manual refresh;
     no DMs, mentions, or engagement webhooks;
   - original media in Supabase Storage; publishing uses a working copy produced
     by upload + confirm through the Outstand Media API;
   - X BYOK is configured manually by the Project Owner in the Outstand dashboard;
     the application does not receive/store the X Client ID or Client Secret.
7. Do not use vendor event names as domain types. `OutstandAdapter`
   translates `post.error` → status `failed` and
   `account.token_expired` → account status `error` + reconnect.

---

## Task → document mapping

| Task                         | Read                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| Feature / use-case           | BC in `domain-model` + service in `application-layer` + UX in `ctx-design` |
| Schema / migration           | `database-strategy` (+ ORM engineering in `ctx-technical-context`)         |
| Auth / session               | `auth-architecture` (+ `auth-strategy` in technical)                       |
| Outstand / webhook / publish | `integration-layer` + ADR-040                                              |
| Comment/reply engagement     | `integration-layer` + `background-jobs` + ADR-040                          |
| Media for publishing         | `integration-layer` + `database-strategy` + ADR-040                        |
| Jobs / cron                  | `background-jobs`                                                          |
| Realtime notifications       | `realtime-strategy`                                                        |

---

## Related context

- BC & shared types → `ctx-domain.md`
- Stack / env / Prisma config → `ctx-technical-context.md`
- Code patterns in the repo → `ctx-implementation.md`
