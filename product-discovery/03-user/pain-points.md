# Pain Points

This document records the obstacles and problems users face in day-to-day social media management.

Pain points describe _what gets in the way_, not _what features must be built_.

---

# Overview

Pain points are drafted from the Business Baseline Problem Statement, competitor observations, patterns in communities of users of similar tools, and the work context of the priority personas.

The purpose of this document is to prioritize the problems with the greatest impact for the Marketing Team as the primary segment, then flag the nuances for Startups and Digital Agencies.

---

# Purpose

- Identify the main obstacles of the buyer and the daily user.
- Connect pain points with business/operational impact.
- Assess severity for product prioritization.
- Provide a basis for evaluating assumptions before insights are finalized.

---

# Scope

## In Scope

- Current-state pain points (before or outside this product).
- Severity and relative frequency.
- Who feels the pain most.
- Impact on user goals.
- Mapping pain to problem themes.

## Out of Scope

- UX/UI solutions.
- Feature specifications.
- Technical backlog ranking.
- Journey detail (see `user-journey.md`).
- Formal JTBD (see `jobs-to-be-done.md`).

---

# Pain Point Framework

Each pain point is assessed with:

- **Severity:** High / Medium / Low
- **Frequency:** Daily / Weekly / Occasional
- **Primary sufferers:** Buyer / Daily User / Both
- **Linked goals:** reference from `user-goals.md`

---

# Core Pain Themes

Aligned with the Problem Statement:

1. Fragmented Workflow
2. Inefficient Collaboration
3. Limited Visibility
4. Data-Driven Decision Challenges
5. Growing Operational Complexity

---

# Pain Points Inventory

## PP-01 — Context Switching Across Tools

**Theme:** Fragmented Workflow  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Daily User (primary), Buyer (productivity impact)

**Description**

Planning lives in documents, assets in storage, scheduling in another tool, analytics in native dashboards, and comment replies in each platform's own app.

**Impact**

- Time lost to context switching.
- Risk of content version inconsistency.
- Operational fatigue increases.

**Linked Goals:** OG-02, BG-01

---

## PP-02 — Unclear Content Status

**Theme:** Limited Visibility / Inefficient Collaboration  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Both

**Description**

It is hard to know whether content is still a draft, awaiting review, scheduled, failed to publish, or already live — without asking in chat.

**Impact**

- Repeated meetings and status chasing.
- Duplicated work.
- Missed deadlines.

**Linked Goals:** BG-03, EG-02, OG-01

---

## PP-03 — Collaboration Relies on Chat Threads

**Theme:** Inefficient Collaboration  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Daily User, Buyer

**Description**

Briefs, feedback, and light approvals are scattered across chat/email. Context is easily lost and hard to trace back.

**Impact**

- Repeated revisions.
- Knowledge is not stored where the work happens.
- Slower onboarding of new members.

**Linked Goals:** BG-02, OG-05, EG-03

---

## PP-04 — Scheduling Errors and Account Confusion

**Theme:** Growing Operational Complexity  
**Severity:** High  
**Frequency:** Weekly (High risk)  
**Sufferers:** Daily User (primary), Agency Lead

**Description**

Choosing the wrong account, the wrong time, or the wrong asset becomes more likely as the number of accounts grows.

**Impact**

- Brand reputation risk.
- Emergency rework.
- Loss of stakeholder/client trust.

**Linked Goals:** OG-06, OG-01

---

## PP-05 — Empty or Fragile Content Queue

**Theme:** Fragmented Workflow  
**Severity:** Medium–High  
**Frequency:** Weekly  
**Sufferers:** Social Media Manager

**Description**

The content queue often is not visible as a whole, so gaps in the schedule are only noticed late.

**Impact**

- Sporadic posting.
- Quality drops because of last-minute production.
- Inconsistent brand cadence.

**Linked Goals:** OG-03, OG-01

---

## PP-06 — Engagement Handling Is Scattered

**Theme:** Fragmented Workflow  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Community Manager / Social Media Manager

**Description**

In the current situation, comments and messages must be checked on each native platform. Interaction priorities are easily missed. The MVP solution reduces this pain for comments and replies; Direct Messages and mentions are not yet consolidated (ADR-040).

**Impact**

- Slow response time.
- Lost engagement opportunities.
- Brand perception declines.

**Linked Goals:** OG-04

---

## PP-07 — Analytics Take Too Long to Assemble

**Theme:** Data-Driven Decision Challenges  
**Severity:** Medium–High  
**Frequency:** Weekly  
**Sufferers:** Buyer (primary), Social Media Manager

**Description**

Performance data is scattered. Building a weekly summary requires manual export and compilation.

**Impact**

- Slow decisions.
- Tiring reporting.
- Insight arrives after the momentum has passed.

**Linked Goals:** BG-04, EG-04

---

## PP-08 — Caption Production Is Slow

**Theme:** Operational Complexity  
**Severity:** Medium  
**Frequency:** Daily  
**Sufferers:** Content Creator, Startup Growth Lead

**Description**

Writing many caption variations in the right tone takes time, especially when content volume rises.

**Impact**

- Production bottleneck.
- Dependence on a single writer.
- Delayed schedule.

**Linked Goals:** OG-05

---

## PP-09 — Tool Adoption Fails When Complexity Is High

**Theme:** Growing Operational Complexity  
**Severity:** High (for the buyer)  
**Frequency:** Occasional (but large impact)  
**Sufferers:** Buyer

**Description**

Teams reject or only half-use a tool that feels complicated, so the investment does not pay off.

**Impact**

- Shadow process goes back to spreadsheets/chat.
- Tool ROI is not achieved.
- The buyer loses confidence in the product category.

**Linked Goals:** BG-05, EG-01

---

## PP-10 — Multi-Client Context Overload (Agency)

**Theme:** Growing Operational Complexity  
**Severity:** High (Agency)  
**Frequency:** Daily  
**Sufferers:** Agency Social Lead / Managers

**Description**

Switching between clients without clear context boundaries increases the risk of errors and fatigue.

**Impact**

- Wrong brand / wrong asset.
- Inconsistent delivery quality.
- Oversight becomes expensive.

**Linked Goals:** OG-06, BG-02, BG-03

---

# Severity Summary

| ID    | Pain Point                | Severity         | MVP Relevance                |
| ----- | ------------------------- | ---------------- | ---------------------------- |
| PP-01 | Context switching         | High             | Critical                     |
| PP-02 | Unclear content status    | High             | Critical                     |
| PP-03 | Chat-based collaboration  | High             | High                         |
| PP-04 | Scheduling/account errors | High             | Critical                     |
| PP-05 | Fragile content queue     | Medium–High      | High                         |
| PP-06 | Scattered engagement      | High             | High                         |
| PP-07 | Slow analytics assembly   | Medium–High      | High (after publishing)      |
| PP-08 | Slow caption production   | Medium           | Medium–High (AI assist)      |
| PP-09 | Adoption friction         | High             | Critical for PMF             |
| PP-10 | Multi-client overload     | High (secondary) | Medium for MVP, higher later |

---

# Pain Points by Persona

| Persona | Top Pain Points                   |
| ------- | --------------------------------- |
| Maya    | PP-02, PP-07, PP-09, PP-03        |
| Raka    | PP-01, PP-02, PP-04, PP-05, PP-06 |
| Sinta   | PP-03, PP-08, PP-02               |
| Dimas   | PP-01, PP-08, PP-09, PP-07        |
| Lara    | PP-10, PP-04, PP-02, PP-07        |

---

# What This Implies (Without Designing Solutions)

Pain points point the product focus toward:

- Consolidating the publishing workflow as the foundation.
- Clarity of content and account status.
- Reducing operational risk.
- A Comments Inbox with reply, a 30-minute periodic pull, and manual refresh that is enough for daily triage.
- Concise analytics that save the buyer time.
- AI that speeds up drafting inside the workflow.
- Simple onboarding so that team adoption happens.

Product decision implications are finalized in `insights.md`.

---

# Assumptions Evaluated in This Document

| ID   | Assumption                                   | Observation                                         | Status                  |
| ---- | -------------------------------------------- | --------------------------------------------------- | ----------------------- |
| A-03 | Fragmented workflow is the main problem      | PP-01, PP-06 appear repeatedly                      | Supported               |
| A-04 | Collaboration is a differentiator            | PP-02, PP-03 show a current-state collaboration gap | Supported               |
| A-06 | Analytics/Engagement matter after publishing | PP-06 high; PP-07 high for the buyer but weekly     | Supported               |
| A-10 | Users will consolidate if it is simple       | PP-09 shows adoption fails when complex             | Supported (conditional) |

---

# Expected Output

After this document is complete, the project must have:

- A prioritized pain points inventory.
- A mapping of pain to the Problem Statement themes.
- Clarity on who feels each pain most.
- A basis for JTBD, journey, and insights.

---

# Exit Criteria

Pain Points is considered complete when:

- The main pain points have been documented.
- Severity and sufferers have been set.
- A mapping to goals is available.
- There are no UX solution proposals in this document.
- Insights can be drafted based on the pain points evidence.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-segments.md`
- `user-personas.md`
- `user-goals.md`
- `jobs-to-be-done.md`
- `user-journey.md`
- `insights.md`
- `../01-business/problem-statement.md`
- `../01-business/competitor-analysis.md`
- `../02-product/mvp-definition.md`
- `../../project-os/DECISIONS.md`
