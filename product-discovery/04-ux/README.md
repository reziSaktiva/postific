# 04 — UX

The documentation in this folder focuses on **UX Planning** for the **Postific** product, covering design principles, information architecture, user flows (solution-state), navigation patterns, and key screen patterns.

All documentation in this folder must refer to the agreed **Business Baseline v1.0**, **Product Baseline v1.0**, and **User Discovery Baseline v1.0**. UX Planning translates user insights into design decisions that can serve as a reference for implementation, without going into visual detail or code.

---

# Goals

* Set UX principles that align with user insights and product decisions.
* Define the information architecture: navigation structure and screen hierarchy.
* Draft user flows (solution flows) based on the current-state journey.
* Document the key screen patterns for development decisions.
* Keep UX decisions consistent with the Business, Product, and User Baselines.

---

# Scope

This folder covers **UX Planning** only.

Topics in scope:

* UX Principles — design principles that guide all UX decisions.
* Information Architecture — navigation structure, screen hierarchy, and content grouping.
* User Flows — solution flows from the user's perspective for each core job.
* Navigation Patterns — the primary and supporting navigation models.
* Key Screen Patterns — the main screen patterns along with their critical-function components.
* UX Decisions — design decisions that affect the direction of architecture or development.

The following topics are **not covered** in this folder:

* Detailed wireframes (high-fidelity)
* Interactive prototypes
* UI Design (visual design, color, typography, branding)
* Component library
* Technical Architecture
* Database Design
* API Design
* Implementation

---

# Document List

* `ux-principles.md` — design principles that govern all UX decisions.
* `information-architecture.md` — navigation structure, screen hierarchy, and feature grouping.
* `user-flows.md` — solution flows for the user's core jobs.
* `navigation-patterns.md` — the primary navigation model and screen-transition patterns.
* `key-screen-patterns.md` — critical-function patterns on the key screens.

---

# UX Planning Workflow

The whole UX Planning process follows this flow:

```text
User Discovery Insights
        ↓
UX Principles
        ↓
Information Architecture
        ↓
User Flows
        ↓
Navigation Patterns
        ↓
Key Screen Patterns
        ↓
Architecture Discovery Input
```

UX decisions do not automatically change the Business or Product Baseline. Changes to Target Market, Problem Statement, Product Scope, or MVP must go through a review process and ADR documentation.

---

# How to Use

1. Start with `ux-principles.md` to set the design decision guidance.
2. Define the application structure in `information-architecture.md`.
3. Draft user flows based on the user's core jobs in `user-flows.md`.
4. Document the navigation model in `navigation-patterns.md`.
5. Map the critical-function patterns in `key-screen-patterns.md`.
6. Use all documents as input to Architecture Discovery.

---

# Input from Previous Phases

UX Planning is built on the following foundation.

## From User Discovery Baseline v1.0

* **I-01** — Primary value is workflow consolidation; the MVP must win at publishing first.
* **I-02** — The buyer and the daily user optimize for different success signals.
* **I-03** — Simplicity is a product requirement, not a styling preference.
* **I-04** — Publishing trust beats feature breadth.
* **I-05** — Engagement and Analytics are retention layers.
* **I-06** — AI is most relevant when it attaches to the draft job, not as a separate module.
* **I-07** — Secondary segments share core jobs in a different context.
* **I-08** — Collaboration visibility matters; a full approval workflow is not MVP.

## From Product Baseline v1.0

* MVP priority domains: Publishing, Workspace, Engagement, Analytics, MCP Server (ADR-138).
* Must Have: Draft, Schedule, Queue, Calendar, Connected Accounts, Engagement Comments Inbox + reply, Analytics Snapshot, MCP Server (AI client connection, read/draft/schedule tools).
* Engagement in the MVP uses a 30-minute periodic pull + manual refresh; Direct Message, mention, and engagement webhooks are not part of the MVP (ADR-040).
* Persona focus: Raka (P0 daily user), Maya (P0 buyer).

## From User Discovery Journey

* 8 current-state stages: Intake → Production → Scheduling → Verification → Publish → Engagement → Review → Tool Evaluation.
* Biggest friction: context switching, status not visible across roles, risk of publishing the wrong thing.
* Opportunity: reduce tool switches, status visibility, publish confidence, lightweight comment triage.

---

# Expected Output

Once all documents in this folder are complete, the project must have:

* Clear UX Principles that can serve as design decision guidance.
* An Information Architecture that reflects the product domains and user needs.
* User Flows that describe the solution for the user's core jobs.
* A navigation model that is simple and does not add cognitive load.
* Key screen patterns ready to serve as a reference for architecture and development.
* Enough input to start Architecture Discovery (M5).

---

# Exit Criteria

UX Planning is considered complete when:

* UX Principles have been set and can be traced to user insights.
* Information Architecture has been defined with a clear screen hierarchy.
* User Flows for the core jobs have been documented.
* Navigation patterns have been chosen and documented.
* Key screen patterns have been drafted.
* No UX decision conflicts with Product Baseline v1.0.
* All documents have gone through UX Planning Review.

---

# Decision Rules

UX decisions that affect:

* MVP scope
* Product domains
* Feature Priority
* Target Market

must be documented in:

* `../../project-os/DECISIONS.md`

Changes to UX Planning progress must be updated in:

* `../../project-os/PROJECT_STATE.md`

---

# Related Documents

* `../../context/ctx-design.md` — pointer to the Postific design artifact (ADR-140; the `design/` folder was removed, ADR-045)
* `../README.md`
* `../01-business/README.md`
* `../01-business/product-vision.md`
* `../01-business/problem-statement.md`
* `../01-business/target-market.md`
* `../02-product/README.md`
* `../02-product/product-scope.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-modules.md`
* `../02-product/feature-priority.md`
* `../03-user/README.md`
* `../03-user/user-personas.md`
* `../03-user/user-goals.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/PROJECT_RULES.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
