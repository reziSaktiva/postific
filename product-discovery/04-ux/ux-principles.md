# UX Principles

This document sets the UX principles that govern all design decisions on the **Postific** product.

Each principle is derived from user insights (I-01 through I-08) and must be traceable to User Discovery Baseline v1.0. These principles are not visual rules — they are UX decision-making guidance that applies from Information Architecture through Key Screen Patterns.

---

# Overview

UX Principles act as a decision filter: when there is a design choice, these principles help determine the right direction for the priority users (Raka and Maya).

The principles apply across all UX Planning documents and do not change without a documented reason.

---

# How to Use

1. When there is a design decision (navigation structure, feature placement, flow order), check whether the decision aligns with the principles below.
2. If two options are equally valid technically, choose the one more aligned with the principles.
3. If a principle needs to change, discuss it and document the reason — do not change it without a trace.

---

# UX Principles

## UXP-01 — One Cycle, Not a Collection of Features

**Derived from:** I-01 (Workflow Consolidation), O-01, O-04

This product is not designed as a collection of standalone social features. It is designed as one work cycle: **Draft → Schedule → Publish → Engage → Review**.

Every information architecture, navigation, and flow decision must reinforce this cycle — not break it into separate modules that force the user to switch context.

**Design implications:**
- The primary navigation reflects the stages of the cycle, not feature categories.
- Transitions between stages (from draft to schedule, from publish to inbox) must feel natural, not like switching apps.
- Onboarding introduces the cycle as a whole, not one feature at a time.

---

## UXP-02 — Two Work Modes: Execution and Visibility

**Derived from:** I-02 (Buyer vs Daily User), O-02, O-06

Raka needs execution speed. Maya needs visibility and summaries. The product must serve both without forcing either to compromise.

This does not mean two separate UIs. It means the design must be **context-aware**: the screens Raka uses to work must still give Maya enough of a status picture when she opens the app.

**Design implications:**
- Publishing and calendar screens must give an overview of content status that the buyer can read at a glance.
- Analytics summaries must be available without layered navigation.
- Do not hide content status behind deep drill-downs.

---

## UXP-03 — Simplicity Is a Quality Bar, Not an Aesthetic

**Derived from:** I-03 (Simplicity as Requirement), O-03, O-09

Simplicity is not about a clean look. Simplicity means the user does not have to think hard to finish their core job.

Every feature or screen that adds cognitive load without proportional value must be questioned — not in the visual phase, but from the planning of flows and information architecture.

**Design implications:**
- If a feature needs a long explanation to be used, that is a signal of a design problem, not a documentation problem.
- Could-haves that complicate the core flow must be deferred.
- The default state of a screen must show the most relevant work right away, not an empty dashboard.

---

## UXP-04 — Publishing Trust Is the Foundation

**Derived from:** I-04 (Publishing Trust Beats Feature Breadth), O-04, journey stages 3–5

Users must trust that content will go out to the right account, at the right time, without ambiguity. This trust matters more than the completeness of secondary features.

**Design implications:**
- Account and schedule confirmation must be clear and cannot be ignored before publishing.
- Content status (draft / scheduled / published / failed) must always be visible.
- Publish errors or failures must be shown clearly and give an obvious recovery path.
- Do not leave users in a state of "not knowing whether this has been published or not".
- The cross-product Safety Check / Double Confirmation policy (when an action must have a confirmation dialog, based on reversibility and blast radius) is documented as a cross-screen pattern in `key-screen-patterns.md` (ADR-049) — it is a direct application of this principle beyond the pure publish context.

---

## UXP-05 — AI Attaches to the Work, Not Standalone

**Derived from:** I-06 (AI in the Draft Job), O-07 — **Reinterpreted (ADR-138):** the principle still holds, but Postific's built-in AI was removed; what attaches to the work is the user's own AI through MCP.

AI is considered useful when it works inside the same job as the human: Drafts and Queue. AI loses its relevance if it becomes a separate module or surface that must be navigated to deliberately. In Postific, the user's AI (Claude, ChatGPT, etc.) works through MCP tools that wrap the same Application Services as the UI, so its output appears in the work lists the user already knows, not on a dedicated AI screen.

**Design implications:**
- The user's AI works in Drafts and Queue through MCP tools; there is no built-in AI UI inside Postific.
- The trace of AI work is visible through a source badge (the AI client's name) and a source filter in History, Drafts, and Queue — users know which items were created by AI without opening them.
- There is no "AI Hub" or AI menu in the primary navigation; the only MCP entry points in the UI are the OAuth consent screen and Settings → Account → Klien AI.

---

## UXP-06 — Clear Status, Light Process

**Derived from:** I-08 (Collaboration Visibility without Approval Overhead), O-01, O-02

Teams need clarity: who is working on what, where content status stands. But a layered approval workflow is not an MVP need — it can even become a barrier to adoption.

The design must support **status visibility** without imposing **process enforcement**.

**Design implications:**
- Content status (draft / in review / ready to schedule / scheduled / published / failed) can be seen without opening the item.
- A light handoff (for example: marking a draft as "ready to schedule") is enough for team coordination.
- Do not implement a layered approval workflow — it is not MVP and adds complexity.
- Collaboration visibility must feel like transparency, not bureaucracy.
- Status transition rules per role are defined in `../02-product/roles-permissions.md` — that document is the canonical reference for who can trigger which status transitions.

---

## UXP-07 — Value Grows with the Cycle, Not All at Once

**Derived from:** I-05 (Engagement and Analytics as Retention Layers), I-01

The order of value in this product: **Publishing reliability → Engagement triage → Analytics snapshot**.

Users do not need to access everything from day one. The product must let users discover the next layer of value naturally once their core job is fulfilled — without forcing or hiding it.

**Design implications:**
- Onboarding focuses on publishing; engagement and analytics are introduced as a continuation of the cycle, not features that must be set up at the start.
- Navigation must make the Comments Inbox and analytics easy to reach when users are ready, but must not burden the initial publishing flow.
- The Comments Inbox must show the last sync time and provide a Manual Refresh; do not give the impression of real-time engagement data because the MVP uses a 30-minute periodic pull (ADR-040).
- Do not create the impression that the product is "incomplete" if the user only uses publishing.

---

# Principles Summary

| ID | Principle | Source Insight |
| -- | --------- | -------------- |
| UXP-01 | One Cycle, Not a Collection of Features | I-01 |
| UXP-02 | Two Work Modes: Execution and Visibility | I-02 |
| UXP-03 | Simplicity Is a Quality Bar, Not an Aesthetic | I-03 |
| UXP-04 | Publishing Trust Is the Foundation | I-04 |
| UXP-05 | AI Attaches to the Work, Not Standalone | I-06 |
| UXP-06 | Clear Status, Light Process | I-08 |
| UXP-07 | Value Grows with the Cycle, Not All at Once | I-05 |

---

# How These Principles Are Used in Subsequent Documents

| Document | Most Relevant Principles |
| -------- | ------------------------ |
| `information-architecture.md` | UXP-01, UXP-02, UXP-03 |
| `user-flows.md` | UXP-01, UXP-04, UXP-05, UXP-06 |
| `navigation-patterns.md` | UXP-01, UXP-02, UXP-03, UXP-07 |
| `key-screen-patterns.md` | UXP-02, UXP-04, UXP-05, UXP-06 |

---

# Decision Rules

If a UX principle needs to change because of a new product decision:

1. Identify which principle is affected.
2. Document the reason for the change in `../../project-os/DECISIONS.md`.
3. Update the UX documents that refer to that principle.

---

# Expected Output

Once this document is complete, the project must have:

* 7 UX Principles traceable to user insights.
* Concrete design implications per principle.
* Guidance on applying the principles in subsequent UX documents.

---

# Exit Criteria

UX Principles are considered complete when:

* Each principle has traceability to a User Discovery insight.
* Each principle has actionable design implications.
* No principle conflicts with Product Baseline v1.0.
* This document can be used as a reference in Information Architecture, User Flows, Navigation Patterns, and Key Screen Patterns.

---

# Related Documents

* `README.md`
* `information-architecture.md`
* `user-flows.md`
* `navigation-patterns.md`
* `key-screen-patterns.md`
* `../03-user/insights.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../../project-os/DECISIONS.md`
* `../../project-os/PROJECT_STATE.md`
