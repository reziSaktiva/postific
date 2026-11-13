# Architecture Overview — High-Level Architecture

## Metadata

| Field        | Value                                               |
| ------------ | --------------------------------------------------- |
| Version      | 1.1.0                                               |
| Status       | Active                                              |
| Last Updated | 2026-10-26                                          |
| Audience     | Visual blueprint (Figma) + architecture orientation |

---

# Purpose

This document is a **high-level architecture summary** for the Postific product. Its goals:

- To be a **visual blueprint** that is easy to redraw in Figma (multi-frame).
- To give a one-screen picture of **who interacts with what** (context) and **how the system is organized inside** (layers + domains).
- To be the entry point before reading the details in `../product-discovery/05-architecture/`.

**It is not the architecture Source of Truth.** Details of domain, database, integration, jobs, realtime, and auth stay in `product-discovery/05-architecture/` (Baseline v1.0, ADR-025) and engineering decisions in `product-discovery/06-engineering/` (Baseline v1.0, ADR-036).

---

# How to Use in Figma

Create **2 separate frames** (one concept = one frame):

| Frame | Suggested name                               | Contents                                        |
| ----- | -------------------------------------------- | ----------------------------------------------- |
| 1     | `Architecture — System Context & Containers` | Actors, external systems, deployable containers |
| 2     | `Architecture — Internal Layers & Domains`   | Modular Monolith layer stack + bounded contexts |

**Suggested visual conventions:**

| Element                    | Shape in Figma               | Example label              |
| -------------------------- | ---------------------------- | -------------------------- |
| Actor (person)             | Circle / user icon           | Marketing Team, Manager    |
| Software system (external) | Thick box, solid border      | Outstand API, Google OAuth |
| Container (ours)           | Box with technology subtitle | `web` · Next.js / Bun      |
| Data store                 | Cylinder or box with DB icon | PostgreSQL, Storage        |
| Domain module              | Box inside the Domain layer  | BC-03 Publishing           |
| Sync flow                  | Solid arrow                  | Request / Response         |
| Async flow                 | Dashed arrow                 | Webhook, Cron, Job         |

Do not put progress status (% / checklist) on the Figma canvas — live status belongs only in `PROJECT_STATE.md`.

---

# Frame 1 — System Context & Containers

## 1.1 System Context (C4 Level 1)

Answers: _who uses the system, and which systems border it?_

```text
                    ┌─────────────────────┐
                    │  Marketing Team     │
                    │  (Primary User)     │
                    │  Account Owner /    │
                    │  Admin / Creator    │
                    └──────────┬──────────┘
                               │
                               │ HTTPS (browser)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                      Postific Platform                       │
│                                                              │
│  Web platform for draft, schedule, publish, engagement,      │
│  analytics, MCP access for the user's own AI, and Start Page │
│  — one workspace.                                            │
│                                                              │
└──────────┬────────────────────────┬────────────────┬─────────┘
           │                        │                │
           │ API / Webhook          │ OAuth          │ Data / Realtime
           ▼                        ▼                ▼
┌────────────────────┐   ┌─────────────────┐   ┌──────────────────┐
│  Outstand API      │   │  Google OAuth   │   │  Supabase Cloud  │
│  Social integration│   │  Login provider │   │  PostgreSQL      │
│  Publish · Comments│   │                 │   │  Storage         │
│  Analytics · Accts │   │                 │   │  Realtime        │
└─────────┬──────────┘   └─────────────────┘   └──────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│  Instagram · Facebook · X/Twitter · LinkedIn · TikTok ·      │
│  YouTube · Threads · Pinterest                               │
│  (via Outstand — not a direct integration from our app)      │
└──────────────────────────────────────────────────────────────┘
```

### Summary of Frame 1.1 relations

| From           | To           | Relation                                                                                  |
| -------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Marketing Team | Platform     | Manages content & team collaboration in one dashboard                                     |
| Platform       | Outstand API | Publish, upload media working copy, sync comments/analytics, OAuth for connected accounts |
| Outstand API   | Platform     | Webhooks `post.published`, `post.error`, `account.token_expired`                          |
| Platform       | Google OAuth | Social login (besides email/password)                                                     |
| Platform       | Supabase     | Data persistence, original media, in-app notification channel                             |

MVP engagement covers only **comments and replies**, through a 30-minute
sync plus manual refresh. There is no comment/DM webhook and Direct Message
is not part of the MVP (ADR-040).

---

## 1.2 Container Diagram (C4 Level 2)

Answers: _which containers do we deploy, and how do they talk to each other?_

```text
┌─ ACTORS ─────────────────────────────────────────────────────┐
│  Browser (Marketing Team)                                    │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─ RAILWAY · Southeast Asia (Singapore) ───────────────────────┐
│                                                              │
│  ┌──────────────────────────┐   ┌─────────────────────────┐  │
│  │  Container: web          │   │  Container: cron        │  │
│  │  Next.js + Bun           │◄──│  Railway Cron           │  │
│  │                          │   │  Scheduled trigger      │  │
│  │  · UI (RSC)              │   │                         │  │
│  │  · Server Actions        │   │  POST /api/jobs/run     │  │
│  │  · Route Handlers        │   │  (holds no              │  │
│  │  · Middleware            │   │   business logic)       │  │
│  │  · Domain modules        │   └─────────────────────────┘  │
│  │  · OutstandAdapter (ACL) │                                │
│  │  · Better Auth           │                                │
│  │  · Prisma Client         │                                │
│  └────────────┬─────────────┘                                │
└───────────────┼──────────────────────────────────────────────┘
                │
    ┌───────────┼────────────────────────┐
    │           │                        │
    ▼           ▼                        ▼
┌────────┐ ┌──────────┐          ┌──────────────┐
│Supabase│ │Supabase  │          │ Outstand API │
│Postgres│ │Storage   │          │ (external)   │
│+ RLS   │ │original  │          │Media API     │
│+ jobs  │ │media     │          │webhook → web │
└───┬────┘ └──────────┘          └──────┬───────┘
    │                                   │
    │ Realtime                          │ HTTPS
    ▼                                   ▼
┌────────┐                      Social networks
│Browser │◄── notify ── Realtime     (via Outstand)
└────────┘
```

### Container responsibilities

| Container / System  | Responsibility                                                                               | Technology                          |
| ------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| `web`               | UI, API routes, domain logic, auth, ACL to Outstand                                          | Next.js, Bun, Better Auth, Prisma   |
| `cron`              | Trigger for internal retries, 30-minute engagement sync, analytics sync, other internal jobs | Railway Cron → `POST /api/jobs/run` |
| Supabase PostgreSQL | Business data + job queue + multi-tenant RLS (`workspace_id`)                                | Cloud · `ap-southeast-1`            |
| Supabase Storage    | The application's original media                                                             | Supabase Storage                    |
| Supabase Realtime   | In-app notification channel                                                                  | Supabase Realtime                   |
| Outstand API        | Social integration, media working copy, publish, comments/replies, analytics                 | External SaaS                       |
| Google OAuth        | Optional identity provider                                                                   | External                            |

For X/Twitter, the Project Owner configures the BYOK credentials manually in
the Outstand dashboard. The application does not receive or store the X Client ID/Client
Secret (ADR-040).

### Environment topology (optional in the same frame / annotation)

| Environment | Deploy branch     | Supabase                              |
| ----------- | ----------------- | ------------------------------------- |
| Production  | `main`            | Separate project                      |
| Staging     | `staging`         | Separate project                      |
| Local       | developer machine | Same as the Staging project (ADR-081) |

Two Railway services (`web` + `cron`) exist in **production and staging**.

---

# Frame 2 — Internal Layers & Domains

## 2.1 Layer Stack (Modular Monolith)

Answers: _through which path does a request enter, and which layer may touch what?_

```text
┌─────────────────────────────────────────────────────────────┐
│  ENTRY POINTS                                               │
│  Next.js App Router                                         │
│  Server Components · Server Actions · Route Handlers · MW   │
└────────────────────────────┬────────────────────────────────┘
                             │ only calls the Application Service
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION SERVICE LAYER                                  │
│  One service per Bounded Context                            │
│  Orchestration · Authorization (RBAC) · Use-case coord.     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN LOGIC LAYER                                         │
│  Entities · Value Objects · Domain Rules                    │
│  Pure business logic — no infrastructure dependencies       │
└────────────────────────────┬────────────────────────────────┘
                             │ via Repository interface
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  REPOSITORY LAYER                                           │
│  Interface in the domain module · Prisma implementation     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE                                             │
│  Prisma → Supabase PostgreSQL                               │
│  Supabase client → Realtime + Storage                       │
│  Better Auth · OutstandAdapter (ACL) · Job runner           │
└─────────────────────────────────────────────────────────────┘
```

### Layer rules (for labels in Figma)

The full text of the 5 layer rules (Entry Points without business logic, Domain Logic
without importing Prisma/Supabase/Outstand, cross-domain through the public API, shared
types only in `packages/shared`) is in **`../AGENTS.md` rules 3-6** — not
copied here. For Figma diagram labels, just use the layer names from the
Frame 2.1 diagram above (Entry Points / Application Service / Domain Logic /
Repository / Infrastructure).

---

## 2.2 Domain Modules (Bounded Contexts)

Answers: _which business modules live inside the monolith?_

Lay them out as a grid inside the Domain Logic / Application Service area (one card per BC).

```text
┌─ CORE DOMAINS (MVP) ────────────────────────────────────────┐
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────────┐ │
│  │ BC-01    │  │ BC-02    │  │ BC-03 Publishing           │ │
│  │ Identity │  │Workspace │  │ Post · Queue · Target      │ │
│  │Better Auth│ │ Members  │  │ Draft · Format · Schedule  │ │
│  └──────────┘  │ Accounts │  └────────────────────────────┘ │
│                │ Brand    │                                 │
│                └──────────┘                                 │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ BC-04    │  │ BC-05    │  │ BC-06    │  │ BC-07      │ │
│  │ MCP      │  │Engage-   │  │Analytics │  │ Start Page │ │
│  │ Access   │  │ ment     │  │ Snapshot │  │ Links      │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─ SUPPORTING DOMAINS ────────────────────────────────────────┐
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │ BC-08    │  │ BC-09      │  │ BC-10 Billing            │ │
│  │ Media    │  │Notification│  │ (modeled; Post-MVP)      │ │
│  └──────────┘  └────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─ CROSS-CUTTING (not a BC of its own) ───────────────────────┐
│  OutstandAdapter (ACL) · Background Jobs · Webhooks · Audit │
│  packages/shared (types only)                               │
└─────────────────────────────────────────────────────────────┘
```

### Brief mapping BC → Application Service

| BC                 | Service                                            |
| ------------------ | -------------------------------------------------- |
| BC-01 Identity     | `IdentityService`                                  |
| BC-02 Workspace    | `WorkspaceService`                                 |
| BC-03 Publishing   | `PublishingService`                                |
| BC-04 MCP Access   | `McpAccessService`                                 |
| BC-05 Engagement   | `EngagementService`                                |
| BC-06 Analytics    | `AnalyticsService`                                 |
| BC-07 Start Page   | `StartPageService`                                 |
| BC-08 Media        | `MediaService`                                     |
| BC-09 Notification | `NotificationService`                              |
| BC-10 Billing      | Post-MVP — not yet bootstrapped as a domain folder |

---

## 2.3 Key Runtime Flows (optional as annotation / mini-frame)

The four most important flows to draw as thin arrows in Frame 2 or a small separate frame:

### A. Scheduled publish

```text
UI → Server Action → PublishingService → DB
                         ↓
Supabase original media → Outstand Media API upload + confirm
                         ↓
       Outstand working-copy URL → create/schedule post
                         ↓
       post.published / post.error webhook
                         ↓
 durable receipt → ACK 2xx → internal job → update PostTarget
```

### B. Inbound webhook

```text
Outstand → Route Handler /api/webhooks/outstand
        → verify HMAC over the raw body
        → store idempotent receipt in outstand_webhook_events
        → ACK 2xx
        → internal job/retry
        → Application Service (Publishing / Workspace)
        → DB (+ Notification)
```

The MVP events are only `post.published`, `post.error`, and
`account.token_expired`. Vendor event names are translated by
`OutstandAdapter`; there is no comment or DM webhook.

### C. In-app notification

```text
Domain event / job → NotificationService → insert notifications
                  → Supabase Realtime → Browser subscription (RLS)
```

### D. Comment/reply engagement

```text
Railway Cron (30 minutes) / Manual Refresh
  → EngagementService → OutstandAdapter
  → pull comments → store/update internally
  → user reply via OutstandAdapter
  → NotificationService (engagement_new from the sync result)
```

---

# Tech Stack Snapshot

Summary for the legend / sidebar in Figma (aligned with `PROJECT_OVERVIEW.md`):

| Layer                         | Choice                                          |
| ----------------------------- | ----------------------------------------------- |
| Repo                          | Hybrid Monorepo — `apps/web`, `packages/shared` |
| Runtime                       | Bun                                             |
| Framework                     | Next.js (App Router)                            |
| Architecture                  | Modular Monolith + DDD                          |
| Auth                          | Better Auth (email/password + Google)           |
| ORM                           | Prisma                                          |
| Database / Storage / Realtime | Supabase Cloud                                  |
| Jobs                          | PostgreSQL job queue + Railway Cron             |
| Social integration            | Outstand API (via ACL)                          |
| Deploy                        | Railway (SEA) — `web` + `cron`                  |
| CI                            | GitHub Actions                                  |

---

# Source of Truth (Detail)

| Topic              | Document                                                            |
| ------------------ | ------------------------------------------------------------------- |
| Domain & BC        | `../product-discovery/05-architecture/domain-model.md`              |
| Database & RLS     | `../product-discovery/05-architecture/database-strategy.md`         |
| Layer & services   | `../product-discovery/05-architecture/application-layer.md`         |
| Outstand / webhook | `../product-discovery/05-architecture/integration-layer.md`         |
| Jobs               | `../product-discovery/05-architecture/background-jobs.md`           |
| Realtime           | `../product-discovery/05-architecture/realtime-strategy.md`         |
| Auth architecture  | `../product-discovery/05-architecture/auth-architecture.md`         |
| Monorepo layout    | `../product-discovery/06-engineering/monorepo-setup.md`             |
| Deploy topology    | `../product-discovery/06-engineering/deployment-infrastructure.md`  |
| Decisions          | `DECISIONS.md` (full index, see the file for the current ADR range) |

If a Figma diagram conflicts with the documents above, **the product-discovery documents + ADRs win** — update the overview / Figma afterward.

---

# Related Documents

- `PROJECT_OVERVIEW.md`
- `PROJECT_STATE.md`
- `DECISIONS.md`
- `../product-discovery/05-architecture/README.md`
- `../product-discovery/06-engineering/README.md`
