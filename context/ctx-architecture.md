# Context — Architecture

Indeks **apa & mengapa sistem** dibangun: layer, integrasi, jobs, auth architecture, realtime, DB strategy.  
Bukan tempat config env, script DX, atau gaya kode.

---

## Baca dulu

| Dokumen                                                                                            | Topik                                                             |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`../project-manager/ARCHITECTURE_OVERVIEW.md`](../project-manager/ARCHITECTURE_OVERVIEW.md)       | Orientasi high-level                                              |
| [`../product-discovery/05-architecture/README.md`](../product-discovery/05-architecture/README.md) | Indeks Architecture Baseline v1.0 (ADR-025)                       |
| [`application-layer.md`](../product-discovery/05-architecture/application-layer.md)                | 4-layer stack, entry points, services, repository, error handling |
| [`domain-model.md`](../product-discovery/05-architecture/domain-model.md)                          | BC & boundary (detail juga di `ctx-domain.md`)                    |
| [`database-strategy.md`](../product-discovery/05-architecture/database-strategy.md)                | Multi-tenancy RLS, tabel, storage, soft delete                    |
| [`integration-layer.md`](../product-discovery/05-architecture/integration-layer.md)                | Outstand ACL, OAuth, publish, media upload, webhook, comment sync |
| [`background-jobs.md`](../product-discovery/05-architecture/background-jobs.md)                    | Job queue Postgres, Railway Cron, job types                       |
| [`realtime-strategy.md`](../product-discovery/05-architecture/realtime-strategy.md)                | Supabase Realtime untuk notifikasi                                |
| [`auth-architecture.md`](../product-discovery/05-architecture/auth-architecture.md)                | Session, workspace context via cookie, RBAC di service, RLS       |

---

## Layer stack (ingat cepat)

```text
Entry Points (RSC / Server Actions / Route Handlers / Middleware)
    → Application Service (satu per BC)
        → Domain Logic (pure)
            → Repository (interface di domain; impl Prisma)
                → Infrastructure (Postgres, Storage, Better Auth, Outstand via ACL)
```

---

## Aturan operasional

1. Hard rules entry point (tanpa business logic) & Supabase JS (hanya
   Realtime+Storage, CRUD lewat Prisma) — lihat **`../AGENTS.md` rules 5, 9**,
   tidak diulang di sini. Detail engineering Supabase: `ctx-technical-context.md`.
2. Integrasi sosial **hanya** lewat Anti-Corruption Layer (OutstandAdapter) — bukan SDK network langsung.
3. RBAC dievaluasi di Application Service; RLS = defense-in-depth.
4. Cross-domain lewat public API — lihat `application-layer.md` + `ctx-domain.md`.
5. Jangan ubah Architecture Baseline tanpa ADR baru.
6. Kontrak Outstand MVP mengikuti **ADR-040**:
   - webhook hanya `post.published`, `post.error`, dan `account.token_expired`;
   - verifikasi HMAC raw body → receipt idempoten durable di
     `outstand_webhook_events` → ACK `2xx` → pemrosesan/retry internal;
   - Engagement hanya komentar/reply melalui sync 30 menit + manual refresh;
     tidak ada DM, mention, atau webhook engagement;
   - original media di Supabase Storage; publishing memakai working copy hasil
     upload + confirm melalui Outstand Media API;
   - X BYOK dikonfigurasi manual oleh Project Owner di dashboard Outstand;
     aplikasi tidak menerima/menyimpan Client ID atau Client Secret X.
7. Jangan memakai nama event vendor sebagai tipe domain. `OutstandAdapter`
   menerjemahkan `post.error` → status `failed` dan
   `account.token_expired` → status akun `error` + reconnect.

---

## Mapping task → dokumen

| Task                         | Baca                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| Fitur / use-case             | BC di `domain-model` + service di `application-layer` + UX di `ctx-design` |
| Schema / migrasi             | `database-strategy` (+ engineering ORM di `ctx-technical-context`)         |
| Auth / session               | `auth-architecture` (+ `auth-strategy` di technical)                       |
| Outstand / webhook / publish | `integration-layer` + ADR-040                                              |
| Engagement komentar/reply    | `integration-layer` + `background-jobs` + ADR-040                          |
| Media untuk publishing       | `integration-layer` + `database-strategy` + ADR-040                        |
| Jobs / cron                  | `background-jobs`                                                          |
| Notifikasi realtime          | `realtime-strategy`                                                        |

---

## Related context

- BC & shared types → `ctx-domain.md`
- Stack / env / Prisma config → `ctx-technical-context.md`
- Pola kode di repo → `ctx-implementation.md`
