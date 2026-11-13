# User Personas

This document drafts the initial personas for the **Postific** product based on assumptions, desktop research observations, and relevant insights.

Personas are used to keep empathy and focus in product decisions. Personas are not the result of academic research, and they are not a feature contract.

---

# Overview

Personas represent recurring user patterns in the priority segments.

Each persona is drafted so it can answer:

- Who is this person in their work context?
- What do they want to achieve?
- What gets in their way?
- What makes the product count as a success for them?

More complete detail on goals, pain points, and JTBD lives in separate documents. A persona only carries a summary sufficient for decision making.

---

# Purpose

- Give a concrete face to the user segments.
- Help distinguish the needs of the buyer and the daily user.
- Serve as a reference for Product and UX discussions without excessive speculation.
- Evaluate whether the MVP does the job of the right people.

---

# Scope

## In Scope

- Primary and secondary personas relevant to the MVP.
- A summary of context, goals, pains, and success criteria per persona.
- Mapping personas to segments and to buyer/daily user roles.

## Out of Scope

- Market segmentation (see `user-segments.md`).
- The complete inventory of goals/pain points/JTBD.
- UI design based on personas.
- User flow solution.
- Technical role-permission matrix.

---

# Persona Principles

- Realistic, not caricatured.
- Job-oriented, not cosmetic demographics.
- Sufficient for product decisions; not excessively detailed fiction.
- Consistent with the Marketing Team as the primary segment.
- Separate the buyer's motivation from the daily user's friction.

---

# Primary Personas

## Persona 1 — Maya, Marketing Manager (Buyer + Occasional User)

### Profile

| Field     | Detail                                                                    |
| --------- | ------------------------------------------------------------------------- |
| Role      | Marketing Manager                                                         |
| Segment   | Marketing Team                                                            |
| Type      | Buyer (primary), light daily user                                         |
| Team size | 6–12 people                                                               |
| Context   | Responsible for channel performance and the team's operational efficiency |

### Day-to-Day Context

Maya makes sure content goes out on time, quality is maintained, and the team does not drown in administrative work. She rarely writes every caption, but often checks the calendar status, performance, and process bottlenecks.

### Goals

- Visibility of content status across team members.
- Reduce the tool switching that slows the team down.
- Get a performance summary sufficient for weekly decisions.

### Friction

- It is hard to see "what is ready / scheduled / published" without asking in chat.
- Analytics is scattered across native dashboards.
- Onboarding a new tool fails if it feels complicated to the team.

### Success Criteria

The team adopts one dashboard, the publishing cadence is stable, and Maya can review progress without excessive meetings.

### Product Relevance

Cares most about Workspace, Calendar visibility, concise Analytics, and clarity of work ownership.

---

## Persona 2 — Raka, Social Media Manager (Primary Daily User)

### Profile

| Field     | Detail                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Role      | Social Media Manager                                                     |
| Segment   | Marketing Team                                                           |
| Type      | Daily user (primary)                                                     |
| Team size | Works with creators, copywriters, and community                          |
| Context   | Operational owner of publishing and of daily/weekly content coordination |

### Day-to-Day Context

Raka builds the schedule, makes sure drafts are ready, schedules to several accounts, monitors important comments through periodic sync or manual refresh, and maintains the consistency of the brand's presence on the channels.

### Goals

- Complete the draft → light review → schedule → publish cycle quickly.
- Keep the content queue healthy.
- Read and reply to important comments without them getting lost across many native apps.

### Friction

- Drafts are in documents, assets in a drive, the schedule in another tool, replies in native apps.
- Content status is unclear between members.
- A failed publish or the wrong account is a high risk to reputation.

### Success Criteria

In a single work session, Raka can plan and schedule the current week's content and handle priority comments through the Comments Inbox without switching too many tools.

### Product Relevance

Cares most about Publishing (draft, schedule, queue, calendar), the Engagement Comments Inbox, and fast AI caption assistance.

---

## Persona 3 — Sinta, Content Creator / Copywriter (Supporting Daily User)

### Profile

| Field   | Detail                                                                                |
| ------- | ------------------------------------------------------------------------------------- |
| Role    | Content Creator / Copywriter                                                          |
| Segment | Marketing Team                                                                        |
| Type    | Daily user (supporting)                                                               |
| Context | Focuses on creating caption drafts and content variations, not full channel ownership |

### Day-to-Day Context

Sinta receives the brief, writes drafts, adjusts the tone, and hands off to the Social Media Manager for scheduling. She often needs help speeding up caption iteration.

### Goals

- Finish quality drafts faster.
- Get clear brief context and assets.
- Reduce revisions caused by a tone that misses.

### Friction

- The brief is scattered in chat.
- Creating many caption variations takes time.
- It is hard to know which version is final for scheduling.

### Success Criteria

Sinta can produce schedule-ready drafts with little back-and-forth communication.

### Product Relevance

Cares most about Content Draft, the AI Assistant (caption generation/improvement), and clarity of draft status.

---

# Secondary Personas

## Persona 4 — Dimas, Startup Growth Lead (Buyer + Heavy Daily User)

### Profile

| Field     | Detail                                                       |
| --------- | ------------------------------------------------------------ |
| Role      | Head of Growth / Marketing Lead                              |
| Segment   | Startup                                                      |
| Type      | Buyer and daily user (often overlapping)                     |
| Team size | 1–4 people                                                   |
| Context   | Lean team; one person often does both strategy and execution |

### Day-to-Day Context

Dimas needs a tool that can be used right away. He has no time for complex setup. His focus is posting consistency and learning from basic performance.

### Goals

- Fast time-to-value.
- Consistent publishing cadence.
- Simple insights for content iteration.

### Friction

- Enterprise tools are too heavy.
- Too many features at the start actually hinder adoption.
- Context switching still happens because resources are limited.

### Success Criteria

On the first day, Dimas can connect accounts, schedule posts, and see basic results.

### Product Relevance

Simple onboarding, core Publishing, basic Analytics, AI caption help.

---

## Persona 5 — Lara, Agency Social Lead (Buyer Influence + Daily Oversight)

### Profile

| Field   | Detail                                                         |
| ------- | -------------------------------------------------------------- |
| Role    | Social Media Lead / Account Ops                                |
| Segment | Digital Agency                                                 |
| Type    | Influences buying; daily oversight across clients              |
| Context | Manages several clients with tight deadlines and many accounts |

### Day-to-Day Context

Lara makes sure every client has a healthy schedule, the team does not mix up context between brands, and work status is visible without having to chase people one by one.

### Goals

- Tidy multi-account visibility.
- A consistent process across clients.
- Reduce the risk of publishing to the wrong brand.

### Friction

- Context switching between clients is high.
- Tools that do not support workspace/account clarity increase the risk of errors.
- Reporting to clients takes time if the data is scattered.

### Success Criteria

Lara can monitor the status of several client accounts and maintain delivery without adding operational meetings.

### Product Relevance

Workspace clarity, account connection hygiene, Publishing calendar, concise Analytics per account.

---

# Persona Priority Map

| Priority | Persona                     | Segment        | Primary Need                                |
| -------- | --------------------------- | -------------- | ------------------------------------------- |
| P0       | Raka — Social Media Manager | Marketing Team | Reliable publishing + engagement workflow   |
| P0       | Maya — Marketing Manager    | Marketing Team | Visibility, adoption, team efficiency       |
| P1       | Sinta — Content Creator     | Marketing Team | Faster draft quality with AI assist         |
| P1       | Dimas — Startup Growth Lead | Startup        | Fast time-to-value                          |
| P1       | Lara — Agency Social Lead   | Digital Agency | Multi-account visibility without complexity |

The MVP must be "right" for Raka and Maya first. The other personas are used to check whether the solution stays usable in secondary contexts.

---

# Anti-Personas (MVP)

The following personas are not a design reference for the MVP:

- Solo influencer focused on personal brand growth.
- Enterprise social ops with layered approval and strict compliance.
- Power user looking for deep social listening or complex automation.

---

# Assumptions Evaluated in This Document

| ID   | Assumption                             | Observation                                               | Status                  |
| ---- | -------------------------------------- | --------------------------------------------------------- | ----------------------- |
| A-01 | Marketing Team is the primary          | The P0 personas are in the Marketing Team                 | Supported               |
| A-02 | Buyer ≠ daily user                     | Maya vs Raka/Sinta                                        | Supported               |
| A-05 | Publishing is the core job             | All priority personas depend on the publishing cadence    | Supported               |
| A-07 | AI is useful if it enters the workflow | Sinta and Dimas get value from in-flow caption assistance | Supported (directional) |

---

# Expected Output

After this document is complete, the project must have:

- Realistic personas for the primary and secondary segments.
- A mapping of buyer vs daily user at the individual level.
- Persona priorities for MVP decisions.
- A consistent basis for discussion before UX Discovery.

---

# Exit Criteria

User Personas is considered complete when:

- At least two primary personas have been defined.
- The buyer and the daily user are represented.
- Secondary personas have been covered proportionally.
- Anti-personas have been marked.
- The goals, pain points, and scenarios documents can refer to the personas without conflict.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-segments.md`
- `user-goals.md`
- `pain-points.md`
- `jobs-to-be-done.md`
- `user-scenarios.md`
- `insights.md`
- `../01-business/target-market.md`
- `../02-product/mvp-definition.md`
- `../../project-os/DECISIONS.md`
