# Jobs To Be Done

This document defines the **Jobs To Be Done (JTBD)** of **Postific** users.

JTBD describes the work users want to get done in a given context, including its functional, emotional, and social dimensions.

---

# Overview

JTBD in this phase is drafted from desktop research and a synthesis of goals/pain points, not from formal interviews.

The focus is on recurring work in the Marketing Team, with context adjustments for Startups and Digital Agencies.

JTBD is used to test whether the MVP does the "job it was hired for", rather than merely providing a list of features.

---

# Purpose

- State the core jobs the product must get done.
- Separate functional, emotional, and social jobs.
- Connect jobs with personas and pain points.
- Provide evaluation criteria for Product Fit before UX Design.

---

# Scope

## In Scope

- Core jobs for the buyer and the daily user.
- Job stories in the situation → motivation → outcome format.
- Functional / emotional / social dimensions.
- Job priority against the MVP.

## Out of Scope

- Solution flow design.
- Technical feature breakdown.
- Wireframe or prototype.
- Engineering backlog.

---

# JTBD Format

Each job is written as:

> When **[situation]**, I want to **[motivation/action]**, so I can **[desired outcome]**.

Accompanied by:

- Job type (Functional / Emotional / Social)
- Primary actor
- Related pain points
- MVP relevance

---

# Core Jobs — Daily User

## J-01 — Plan and Schedule Content Reliably

**Job Story**

When I manage several accounts in a single week, I want to compose and schedule content from one place, so I can keep the cadence without going back and forth between tools.

- **Type:** Functional
- **Actor:** Raka (Social Media Manager), Dimas
- **Pain Points:** PP-01, PP-05, PP-04
- **MVP Relevance:** Must — Publishing core

---

## J-02 — Keep the Content Pipeline Visible

**Job Story**

When I am responsible for the content calendar, I want to see clearly the status from draft to published, so I can prevent empty slots in the schedule and missed deadlines.

- **Type:** Functional
- **Actor:** Raka, Maya (oversight)
- **Pain Points:** PP-02, PP-05
- **MVP Relevance:** Must — Calendar / Queue / Status clarity

---

## J-03 — Publish Without Operational Mistakes

**Job Story**

When the volume of accounts and assets grows, I want to make sure content is scheduled to the right account at the right time, so I can avoid mistakes that damage the brand.

- **Type:** Functional + Emotional (anxiety reduction)
- **Actor:** Raka, Lara
- **Pain Points:** PP-04, PP-10
- **MVP Relevance:** Must — Account clarity in Publishing

---

## J-04 — Respond to Important Audience Interactions

**Job Story**

When comments come in from several platforms, I want to read and reply to priority comments from one inbox, so I can respond quickly without missing important interactions.

- **Type:** Functional
- **Actor:** Raka / Community Manager
- **Pain Points:** PP-06, PP-01
- **MVP Relevance:** Must — Comments Inbox + reply; 30-minute periodic pull and manual refresh (ADR-040)

---

## J-05 — Produce Caption Drafts Faster

**Job Story**

When I have to write many captions in the right tone, I want help with quick drafting and improvement, so I can finish content production without a writing bottleneck.

- **Type:** Functional
- **Actor:** Sinta, Dimas
- **Pain Points:** PP-08
- **MVP Relevance:** Must — AI Assistant (in-workflow)

---

## J-06 — Hand Off Work Without Losing Context

**Job Story**

When a draft moves from the creator to the social media manager, I want the brief context and status to carry over, so I can reduce revisions and miscommunication.

- **Type:** Functional
- **Actor:** Sinta → Raka
- **Pain Points:** PP-03, PP-02
- **MVP Relevance:** High — Draft status & collaboration basics

---

# Core Jobs — Buyer

## J-07 — See Team Progress Without Chasing

**Job Story**

When I manage a marketing team, I want to see the progress of social media activity without asking people one by one, so I can focus on decisions, not manual coordination.

- **Type:** Functional + Social (managerial credibility)
- **Actor:** Maya, Lara
- **Pain Points:** PP-02, PP-03
- **MVP Relevance:** Must — Visibility via Workspace/Publishing/Analytics

---

## J-08 — Get a Weekly Performance Snapshot

**Job Story**

When it is time for the weekly review, I want a performance summary that is clear enough, so I can make content iteration decisions without a long manual compilation.

- **Type:** Functional
- **Actor:** Maya, Dimas, Lara
- **Pain Points:** PP-07
- **MVP Relevance:** Must — Analytics basics

---

## J-09 — Adopt a Tool the Team Will Actually Use

**Job Story**

When I choose a new platform, I want simple onboarding for every member, so I can make sure the tool investment is actually used day to day.

- **Type:** Functional + Emotional (risk reduction)
- **Actor:** Maya, Dimas, Agency Owner
- **Pain Points:** PP-09
- **MVP Relevance:** Critical — Simplicity as product constraint

---

## J-10 — Standardize Social Operations

**Job Story**

When the team grows or handles many brands, I want a consistent way of working, so I can maintain delivery quality without adding operational chaos.

- **Type:** Functional + Social
- **Actor:** Maya, Lara
- **Pain Points:** PP-03, PP-10, PP-02
- **MVP Relevance:** High — Workspace + clear publishing process

---

# Emotional Jobs

| ID   | Emotional Job                                   | Why It Matters              |
| ---- | ----------------------------------------------- | --------------------------- |
| E-01 | Feel in control of the content schedule         | Reduces missed-post anxiety |
| E-02 | Feel safe from publishing mistakes              | High reputation risk        |
| E-03 | Feel competent in front of stakeholders/clients | The buyer needs credibility |
| E-04 | Feel not overwhelmed by tool switching          | Fatigue is a churn risk     |

Emotional jobs do not stand alone; they accompany J-01 through J-10.

---

# Social Jobs

| ID   | Social Job                                   | Context               |
| ---- | -------------------------------------------- | --------------------- |
| S-01 | Look tidy and reliable as a channel manager  | Daily user to manager |
| S-02 | Show that the team works in a measurable way | Buyer to leadership   |
| S-03 | Maintain client trust in delivery            | Agency                |

---

# Job Priority for MVP

| Priority | Jobs                                                              | Rationale                                                        |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| P0       | J-01, J-02, J-03, J-09                                            | Without these, the product fails at the core job and at adoption |
| P0       | J-04, J-08                                                        | Completes the value cycle after publishing                       |
| P1       | J-05, J-06, J-07, J-10                                            | Strengthens speed, collaboration, and standardization            |
| Later    | Enterprise jobs (layered approval, social listening, white-label) | Outside the MVP                                                  |

---

# Jobs vs Product Domains

| Job              | Main domain                                         |
| ---------------- | --------------------------------------------------- |
| J-01, J-02, J-03 | Publishing                                          |
| J-04             | Engagement                                          |
| J-05             | AI Assistant + Publishing                           |
| J-06, J-07, J-10 | Workspace + Publishing                              |
| J-08             | Analytics                                           |
| J-09             | Cross-domain simplicity (esp. Workspace onboarding) |

---

# Competing Jobs / Alternatives

Currently the jobs above are "hired out" to a combination of:

- Native social apps
- Scheduling tools
- Spreadsheet / docs
- Chat tools
- Separate analytics dashboards
- Manual copy-paste workflow

The product succeeds if users move the P0 jobs from that combination to a single dashboard, without adding new friction.

---

# Assumptions Evaluated in This Document

| ID   | Assumption                              | Observation                                 | Status    |
| ---- | --------------------------------------- | ------------------------------------------- | --------- |
| A-05 | Publishing is the core job              | J-01–J-03 are P0                            | Supported |
| A-06 | Analytics & Engagement strengthen value | J-04 and J-08 are P0 after publishing       | Supported |
| A-07 | AI is useful in-workflow                | J-05 is relevant when attached to the draft | Supported |
| A-04 | Collaboration matters                   | J-06, J-07, J-10 appear strongly in teams   | Supported |

---

# Expected Output

After this document is complete, the project must have:

- Clear JTBD for the buyer and the daily user.
- Job priorities for the MVP.
- A mapping of jobs to product domains.
- A basis for evaluating Product Fit based on jobs, not a list of features.

---

# Exit Criteria

Jobs To Be Done is considered complete when:

- The core jobs of the daily user and the buyer have been documented.
- The emotional and social dimensions have been covered.
- The MVP priority for jobs has been set.
- A mapping to pain points and domains is available.
- Scenarios and journey can be drafted based on these jobs.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-segments.md`
- `user-personas.md`
- `user-goals.md`
- `pain-points.md`
- `user-scenarios.md`
- `user-journey.md`
- `insights.md`
- `../01-business/problem-statement.md`
- `../02-product/mvp-definition.md`
- `../02-product/feature-modules.md`
- `../../project-os/DECISIONS.md`
