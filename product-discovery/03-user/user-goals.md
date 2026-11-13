# User Goals

This document defines the goals, motivations, and outcomes that **Postific** users want to achieve.

Goals describe _what users want to achieve_, not _how the product gets it done_.

---

# Overview

User Goals are drafted from the priority segments and personas, then mapped to business outcomes and operational outcomes.

Understanding goals is needed so the MVP does not just add features, but delivers work outcomes that are meaningful to the buyer and the daily user.

---

# Purpose

- Describe user goals in a structured way.
- Separate the goals of the buyer and the daily user.
- Connect user motivation with the Problem Statement and the MVP domains.
- Serve as a reference for JTBD, scenarios, and insight evaluation.

---

# Scope

## In Scope

- Goals per user type (buyer vs daily user).
- Goals per priority persona.
- The motivation behind the goals.
- Observable desired outcomes.
- Mapping goals to product domains (need level, not solution design).

## Out of Scope

- Pain points in detail (see `pain-points.md`).
- Formal JTBD (see `jobs-to-be-done.md`).
- Current journey (see `user-journey.md`).
- UX/UI or architecture solutions.

---

# Goal Levels

Goals are grouped into three levels:

1. **Business Goals** — outcomes the organization/buyer wants.
2. **Operational Goals** — the daily/weekly work outcomes of the daily user.
3. **Enabling Goals** — conditions that make operational goals easier to achieve.

---

# Business Goals (Buyer)

The buyer (Maya, Dimas, Lara) generally pursues:

| Goal ID | Goal                                      | Motivation                                       | Desired Outcome                                   |
| ------- | ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| BG-01   | Improve the team's operational efficiency | The time cost of administrative work is too high | More time for strategy and content quality        |
| BG-02   | Standardize the social media workflow     | The process is inconsistent between members      | More predictable cadence and quality              |
| BG-03   | Improve activity visibility               | It is hard to know the status without asking     | Progress review without excessive meetings        |
| BG-04   | Make data-driven decisions                | Data is scattered and slow to compile            | Faster and sufficiently accurate weekly decisions |
| BG-05   | Ensure the team adopts the tool           | A tool that is not used = wasted cost            | Daily users finish the core work in one place     |

---

# Operational Goals (Daily User)

The daily user (Raka, Sinta, and Dimas in execution mode) pursues:

| Goal ID | Goal                                  | Motivation                                        | Desired Outcome                                                          |
| ------- | ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| OG-01   | Complete publishing on time           | Channel consistency is a baseline KPI             | Content is scheduled and published as planned                            |
| OG-02   | Reduce context switching              | Switching tools slows work down and causes errors | One workflow for draft–schedule–publish                                  |
| OG-03   | Keep the content queue healthy        | Schedule gaps are a risk to the brand             | Calendar/queue is clearly visible and filled                             |
| OG-04   | Respond to important comments quickly | Engagement affects brand perception               | Priority comments can be found and replied to through the Comments Inbox |
| OG-05   | Speed up creating quality drafts      | Caption production takes time                     | Schedule-ready drafts sooner with fewer revisions                        |
| OG-06   | Avoid operational mistakes            | Wrong account/wrong schedule is costly            | Publish with control and account clarity                                 |

---

# Enabling Goals

Supporting goals that often appear across roles:

| Goal ID | Goal                                          | Why It Matters                               |
| ------- | --------------------------------------------- | -------------------------------------------- |
| EG-01   | Fast onboarding for new members               | Adoption fails if setup feels heavy          |
| EG-02   | Clear content ownership                       | Reduces miscommunication and duplicated work |
| EG-03   | Sufficient access to assets and brief context | Quality drafts need context                  |
| EG-04   | Easy-to-read performance summary              | Analytics is only useful if actionable       |

---

# Goals by Persona

## Maya — Marketing Manager

- Primary: BG-01, BG-03, BG-04, BG-05
- Secondary: OG-01 (as oversight)

## Raka — Social Media Manager

- Primary: OG-01, OG-02, OG-03, OG-04, OG-06
- Secondary: EG-02, EG-04

## Sinta — Content Creator / Copywriter

- Primary: OG-05, EG-03
- Secondary: OG-02

## Dimas — Startup Growth Lead

- Primary: BG-01, OG-01, OG-05, EG-01
- Secondary: BG-04

## Lara — Agency Social Lead

- Primary: BG-02, BG-03, OG-01, OG-06
- Secondary: BG-04, EG-02

---

# Goals to Product Domain Mapping

This mapping states _needs_, not feature specifications.

| Goal                | Most relevant domain                             |
| ------------------- | ------------------------------------------------ |
| BG-01, BG-02, BG-05 | Workspace, Publishing                            |
| BG-03               | Workspace, Publishing Calendar, Analytics        |
| BG-04, EG-04        | Analytics                                        |
| OG-01, OG-03, OG-06 | Publishing                                       |
| OG-02               | Publishing + Engagement (workflow consolidation) |
| OG-04               | Engagement                                       |
| OG-05               | AI Assistant, Publishing Draft                   |
| EG-01               | Workspace, Authentication/Onboarding             |
| EG-02               | Workspace, Publishing status                     |
| EG-03               | Publishing Draft, Media Library (Should Have)    |

---

# Motivation Patterns

From desktop research and competitor patterns, user motivations tend to cluster around:

1. **Save time** — reduce administrative work.
2. **Reduce risk** — prevent missed schedules and wrong publishes.
3. **Increase clarity** — work status and performance are more visible.
4. **Improve output quality** — content is more consistent and faster to iterate.

The motivation of "having many features" is rarely a true goal. Features are only a means.

---

# Non-Goals (User Perspective)

In the MVP phase, priority users do **not** treat the following as primary goals:

- Building enterprise social listening.
- Automating the whole marketing stack.
- Managing CRM or email campaigns.
- Running a white-label client portal.

These non-goals keep discovery focused on Social Media Management.

---

# Assumptions Evaluated in This Document

| ID   | Assumption                                | Observation                                                 | Status                |
| ---- | ----------------------------------------- | ----------------------------------------------------------- | --------------------- |
| A-03 | Fragmented workflow is the core problem   | Goals OG-02 and BG-01 appear strongly across personas       | Supported             |
| A-04 | Collaboration matters                     | BG-02, BG-03, EG-02 appear in the Marketing Team and Agency | Supported             |
| A-05 | Publishing is the core                    | OG-01 and OG-03 are the most recurring daily goals          | Supported             |
| A-06 | Analytics/Engagement strengthen retention | BG-04 and OG-04 matter, but after publishing is stable      | Supported (sequenced) |

---

# Expected Output

After this document is complete, the project must have:

- A structured list of goals for the buyer and the daily user.
- Observable desired outcomes.
- A mapping of goals to product domains at the need level.
- A clear basis for drafting JTBD and scenarios.

---

# Exit Criteria

User Goals is considered complete when:

- Business, operational, and enabling goals have been documented.
- The goals of the buyer and the daily user have been separated.
- The goals of the priority personas have been mapped.
- A mapping to product domains is available without entering UX solutions.
- Pain points and JTBD can be drafted without overlapping responsibilities.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-segments.md`
- `user-personas.md`
- `pain-points.md`
- `jobs-to-be-done.md`
- `user-scenarios.md`
- `insights.md`
- `../01-business/problem-statement.md`
- `../01-business/target-market.md`
- `../02-product/product-scope.md`
- `../02-product/mvp-definition.md`
- `../../project-os/DECISIONS.md`
