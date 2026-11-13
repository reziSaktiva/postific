# 05 — Architecture

The documentation in this folder focuses on the **System Architecture** for the **Postific** product, covering the domain model, database strategy, application layer, external integrations, background jobs, and system security.

All documentation in this folder must refer to the agreed **Business Baseline v1.0**, **Product Baseline v1.0**, **User Discovery Baseline v1.0**, and **UX Planning Baseline v1.0**. System Architecture translates product and UX decisions into technical decisions that can serve as a reference for implementation.

---

# Purpose

* Define the domain model and bounded contexts based on the Product Baseline.
* Set the database strategy and data isolation between workspaces.
* Define how the application layer interacts with domain logic.
* Design the external integration architecture (Outstand API and webhooks).
* Set the background job and content scheduling strategy.
* Define the security and authentication architecture.
* Produce technical decisions that are ready to serve as input to Engineering Planning.

---

# Scope

This folder covers only **System Architecture** — structural system decisions, not code implementation.

Topics in scope:

* Domain Model — bounded contexts, main entities, and relations between domains.
* Database Strategy — database choice, multi-tenancy, and workspace data isolation.
* Application Layer — how the Next.js App Router interacts with domain logic.
* Integration Layer — Outstand API architecture, webhook handling, and connected accounts.
* Background Jobs — scheduling architecture, job queue, and retry strategy.
* Real-time Strategy — approach to notifications and status synchronization.
* Auth Architecture — authentication, sessions, and role-based authorization.

The following topics are **not covered** in this folder:

* Code implementation
* ORM and database access layer (covered in Engineering Planning)
* CI/CD and deployment pipeline (covered in Engineering Planning)
* UI/UX Design

---

# Pre-Architecture Decisions Already Made

The following decisions were agreed before this documentation began and are the foundation of every document in this folder:

| Topic | Decision |
| ----- | --------- |
| Framework | Next.js (ADR-003) |
| Runtime | Bun (ADR-002) |
| Repository | Hybrid Monorepo (ADR-001) |
| Architecture Pattern | Modular Monolith + DDD (ADR-004) |
| Social Media Integration | Outstand API; the official contract and MVP limits are amended by ADR-040 |
| Database Platform | Supabase PostgreSQL Cloud |
| Multi-tenancy | Row-Level Security with `workspace_id` |
| Auth Library | Better Auth |
| Real-time Strategy | In-app notification + manual refresh |
| Storage | Supabase Storage |
| Deployment | Railway |
| Domain Boundary | Pragmatic Boundary — shared types via `packages/shared`, no importing implementations across domains |

---

# Document List

* `domain-model.md` — bounded contexts, main entities, and relations between domains.
* `database-strategy.md` — database strategy, multi-tenancy, and workspace isolation.
* `application-layer.md` — how the Next.js App Router interacts with domain logic and the service layer.
* `integration-layer.md` — Outstand API architecture, webhook handling, and connected accounts.
* `background-jobs.md` — content scheduling architecture, job queue, and retry strategy.
* `realtime-strategy.md` — approach to in-app notifications and content status synchronization.
* `auth-architecture.md` — authentication, session management, and role-based authorization (Better Auth).

---

# Architecture Planning Workflow

The whole Architecture Planning process follows this flow, based on the dependencies between documents:

```text
UX Planning Baseline
        ↓
Domain Model & Bounded Context
        ↓
Database Strategy
        ↓
Application Layer
        ↓
Integration Layer  ←→  Background Jobs
        ↓
Real-time Strategy
        ↓
Auth Architecture
        ↓
Engineering Planning Input
```

Architecture decisions do not automatically change the Business, Product, or UX Baseline. Changes to the MVP scope, the product domain, or the target market must go through a new ADR.

---

# How to Use

1. Start from `domain-model.md` to set the bounded contexts and main entities.
2. Define the database strategy in `database-strategy.md`.
3. Design the layer interactions in `application-layer.md`.
4. Document the external integration architecture in `integration-layer.md`.
5. Define the background jobs architecture in `background-jobs.md`.
6. Set the notification strategy in `realtime-strategy.md`.
7. Document the auth architecture in `auth-architecture.md`.
8. Use all the documents as input to Engineering Planning (M6).

---

# Input from Previous Phases

## From Product Baseline v1.0

* 6 Core Modules: Workspace, Publishing, Analytics, Engagement, MCP Server (ADR-138), Start Page.
* 5 Supporting Modules: Authentication, User Profile, Media Library, Notifications, Billing, Settings.
* Infrastructure Module: API Integrations, Webhooks, Audit Logs, File Storage, Background Jobs, Monitoring.
* MVP Must Have: Draft, Schedule, Queue, Calendar, Connected Accounts, Engagement Inbox, Analytics Snapshot, MCP Server (AI client connection, read/draft/schedule tools).
* 3 Roles (revised by ADR-074): Account Owner, Admin, Creator — with a canonical set of content statuses.

## Outstand Contract Amendment (ADR-040)

* The MVP webhooks are only `post.published`, `post.error`, and `account.token_expired`; the ACL translates vendor names into domain statuses/notifications.
* Webhook ingestion: verify HMAC raw body → persist `outstand_webhook_events` idempotently → enqueue JOB-01 → ACK `2xx`; the vendor's delivery retry is separate from the internal process retry.
* MVP engagement is only comments/replies through JOB-03 every 30 minutes and manual refresh; no comment/DM/mention webhooks.
* Original media stays in Supabase Storage; publishing uses an Outstand working copy through request upload URL → PUT → confirm.
* Twitter/X stays in the MVP with mandatory BYOK configured by the Project Owner in the Outstand dashboard; the application does not store the X client secret.

## From UX Planning Baseline v1.0

* Main navigation: Home, Publish, Engage, Analyze, Start Page.
* 5 core user flows: Create & Publish, Content Calendar, Queue Management, Engagement, Analytics.
* Key screen patterns for the 8 main screens are ready to serve as a reference for domain entities.
* UX decisions (KSP-D01 through KSP-D11, NP-D01 through NP-D09) become domain design constraints.

## From User Discovery Baseline v1.0

* Biggest friction: context switching, status not visible across roles, risk of publishing the wrong thing.
* Main insights that influence the architecture: I-01 (workflow consolidation), I-04 (publishing trust), I-06 (AI attaches to the draft job).

---

# Expected Output

Once all the documents in this folder are finished, the project must have:

* A defined domain model with clear bounded contexts.
* A database and multi-tenancy strategy ready to serve as the initial schema.
* A layer architecture that supports Modular Monolith + DDD.
* A documented Outstand API and webhook integration design.
* A realistic background job strategy for the MVP.
* A role-based auth architecture aligned with the Roles & Permissions Baseline.
* Enough input to start Engineering Planning (M6).

---

# Exit Criteria

System Architecture is considered complete when:

* All 7 documents in this folder are finished.
* The domain model reflects every module in the Product Baseline.
* No architecture decision contradicts the Product or UX Baseline.
* All crucial architecture decisions are documented as ADRs in `DECISIONS.md`.
* All documents have gone through Architecture Review.

---

# Decision Rules

Architecture decisions that affect:

* System architecture
* Tech stack
* Domain model
* Repository strategy

must be documented in:

* `../../project-os/DECISIONS.md`

Changes to Architecture Planning progress must be updated in:

* `../../project-os/PROJECT_STATE.md`

For the ADR-040 alignment, the session edit limit may exclude updates to living/append-only documents; the Decision Log of each Architecture document must still mark that amendment.

---

# Related Documents

* `../README.md`
* `../01-business/README.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../02-product/roles-permissions.md`
* `../03-user/insights.md`
* `../04-ux/README.md`
* `../04-ux/information-architecture.md`
* `../04-ux/key-screen-patterns.md`
* `../06-engineering/README.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/PROJECT_RULES.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
