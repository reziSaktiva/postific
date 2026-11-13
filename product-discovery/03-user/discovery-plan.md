# Discovery Plan

This document sets the objectives, questions, reference sources, methods, validation rules, and limits of **User Discovery** for the **Postific** product.

This document is the entry point before segmentation, personas, goals, pain points, Jobs To Be Done (JTBD), scenarios, journey, and insights are drafted.

---

# Overview

User Discovery in this project is carried out through **desktop research** and **product discovery**, not through interviews, surveys, or usability testing.

The goal of this phase is to understand users deeply enough to evaluate the assumptions of the Business and Product Baselines, and to produce insights that can become the basis for UX Discovery and Architecture Discovery.

The whole process follows the project vocabulary:

```text
Assumption
    ↓
Discovery
    ↓
Observation
    ↓
Insight
    ↓
Decision
```

Every decision that affects the baseline must be traceable back to the observation that supports it.

---

# Purpose

- Set measurable User Discovery objectives.
- Formulate discovery questions relevant to the Business and Product Baselines.
- Determine the reference sources that are legitimate to use in this phase.
- Determine the discovery methods and validation rules.
- Limit the scope so discovery stays focused and actionable.
- Provide a consistent framework for all User Discovery documents.

---

# Scope

## In Scope

- Discovery objectives.
- Discovery questions.
- The assumption inventory to be evaluated.
- Desktop research and product observation.
- Observation capture.
- Insight synthesis.
- Discovery evidence.
- Discovery confidence.
- Insight quality criteria.
- Discovery risks.
- Decision readiness.

## Out of Scope

- User interviews.
- Customer survey.
- Focus group.
- Usability testing.
- UX Design.
- UI Design.
- Wireframe.
- Prototype.
- User Flow solution.
- Information Architecture.
- Technical Architecture.
- Database Design.
- API Design.
- Implementation.
- Changes to Target Market, Problem Statement, Product Scope, or MVP without going through the Decision process.

---

# Discovery Objectives

User Discovery must be able to answer the following questions at the product level.

1. Who are the primary and secondary users most relevant to the MVP?
2. Who buys the product, and who uses it every day?
3. What are the users' main goals when managing social media as a team?
4. Which pain points appear most often and have the greatest impact?
5. Which Jobs To Be Done must the product support for it to be considered useful?
6. What does the users' current-state journey look like before using this product?
7. What factors influence the adoption or rejection of a Social Media Management tool?
8. Which assumptions from the Business and Product Baselines are supported, not yet supported, or contradicted?

---

# Discovery Questions

## Segment & Role

- Who feels the fragmented workflow in social media management most?
- How do the needs of Marketing Teams, Startups, and Digital Agencies differ?
- What is the difference between the buyer's decisions and the daily user's needs?

---

## Goals & Motivation

- What work outcomes do users want to achieve every week?
- What motivation drives the adoption of a Social Media Management tool?
- What makes a tool considered useful by a marketing team?

---

## Pain Points

- Where does context switching happen most often?
- Which part of collaboration fails most often without a centralized tool?
- Why do analytics and engagement so often become bottlenecks?

---

## Jobs To Be Done

- What functional jobs must be completed for the user's workday to be considered successful?
- What emotional jobs lie behind the operational work?
- What social jobs do users want to achieve within a team or organization?

---

## Tool Adoption

- Why do teams keep using spreadsheets or separate tools?
- What is the main reason teams move to a new tool?
- What obstacles make onboarding fail?
- What makes a whole team willing to use the same platform?
- What reasons make users stop using a previous tool?

---

## Product Fit

- Which MVP module is closest to the users' daily work?
- Which features matter to the buyer but are rarely touched by the daily user?
- Where is the risk of overbuilding features highest, based on user behavior?

---

# Assumption Inventory

The following assumptions are inherited from Business Baseline v1.0 and Product Baseline v1.0, and will be evaluated throughout User Discovery.

| ID   | Assumption                                                                                           | Source                 | Initial Status |
| ---- | ---------------------------------------------------------------------------------------------------- | ---------------------- | -------------- |
| A-01 | Marketing Team is the best-fit primary user for the MVP                                              | ADR-006, Target Market | To Validate    |
| A-02 | Buyer and daily user are often different people                                                      | Target Market          | To Validate    |
| A-03 | The main problem is a fragmented workflow across tools                                               | Problem Statement      | To Validate    |
| A-04 | Team collaboration is an important differentiator                                                    | Competitor Analysis    | To Validate    |
| A-05 | Publishing is the core job that must be solved first                                                 | MVP Definition         | To Validate    |
| A-06 | Analytics and Engagement strengthen retention once Publishing is running                             | Feature Priority       | To Validate    |
| A-07 | An AI Assistant is useful when integrated into the workflow, not standing alone                      | Competitor Analysis    | To Validate    |
| A-08 | Individual Creator is not an MVP focus                                                               | Target Market          | To Validate    |
| A-09 | Startups and Digital Agencies have work patterns similar to a Marketing Team, in a different context | Target Market          | To Validate    |
| A-10 | Users are willing to consolidate their work into one dashboard if onboarding is simple               | Product Vision         | To Validate    |

The final status of each assumption is recorded in `insights.md`.

---

# Discovery Sources

## Product References

- Buffer.
- Postiz.
- Hootsuite.
- Later.
- Metricool.

---

## Market Signals

- Reddit.
- G2.
- Capterra.
- Product Hunt.
- Public discussions on X/Twitter.
- Community discussion about Social Media Management.

---

## Public Knowledge

- Official documentation.
- Industry article.
- Public case study.
- Video walkthrough.
- Product review.
- Conference talk.
- Engineering or product blog.

---

## Internal Baseline

- `../01-business/`
- `../02-product/`
- `../../project-os/PROJECT_OVERVIEW.md`
- `../../project-os/PROJECT_RULES.md`
- `../../project-os/DECISIONS.md`

---

## Excluded Sources

The following sources are not used in this phase.

- Interview.
- Customer survey.
- Focus group.
- Usability testing.
- AI-generated content without a verifiable source.

---

# Discovery Method

## 1. Assumption Framing

All discovery starts from recorded assumptions.

Discovery does not start from solutions or opinions.

---

## 2. Desktop Discovery

Collect evidence from various public sources and product references.

---

## 3. Observation Capture

An observation contains only facts or patterns that were actually observed.

An observation must not contain interpretation or recommendations.

Example:

**Observation**

Marketing Teams often use Google Docs for planning, Canva for design, Buffer for publishing, and native apps for engagement.

**Evidence**

- Buffer Documentation.
- Reddit Discussion.
- Product Walkthrough.

**Confidence**

High

---

## 4. Insight Synthesis

An insight is the interpretation of one or more observations.

An insight must explain:

- what is happening,
- why it matters,
- who is affected,
- how it affects the product.

---

## 5. Decision Gate

If an insight affects the Business Baseline, Product Baseline, or Project Rules, the change must go through the Decision process and be recorded in `../../project-os/DECISIONS.md` before other documents are updated.

---

# Evidence Rules

An observation is considered valid if it meets one of the following conditions.

- Supported by at least two independent sources.
- Comes from official product documentation.
- Repeats across several competitors.
- Repeats across several different communities.

An observation that comes from a single opinion without additional validation must not become the basis for a decision change.

---

# Confidence Level

Each observation should have a confidence level.

| Level  | Description                                             |
| ------ | ------------------------------------------------------- |
| High   | Supported by many consistent sources.                   |
| Medium | Supported by several sources but still shows variation. |
| Low    | Evidence is still limited or not yet consistent.        |

Confidence is used to help with prioritization, not as a final decision.

---

# Quality Criteria for Insights

An insight is fit for use if:

- It comes from an observation that has evidence.
- It is relevant to the Target Market.
- It is relevant to the Problem Statement.
- It helps a Product, UX, or Architecture decision.
- It does not mix in UX or UI solutions.
- It explains its impact on the buyer, the daily user, or both.
- It can be traced back to the observation that supports it.

---

# Discovery Risks

Some risks to watch during User Discovery.

- Desktop research can be biased toward popular products.
- Community discussion is often dominated by negative experiences.
- Competitors do not necessarily have the same target market.
- Opinion articles do not always represent the behavior of most users.
- AI-generated summaries are not considered evidence.

---

# Traceability

Every discovery result should have a traceable link.

```text
Assumption
    ↓
Observation
    ↓
Insight
    ↓
Decision
```

Example identifiers:

```text
A-001
↓

OBS-003

↓

INS-002

↓

ADR-007
```

With this approach, all decisions can be audited later.

---

# Document Ownership Map

| Document             | Responsibility                                                         |
| -------------------- | ---------------------------------------------------------------------- |
| `discovery-plan.md`  | Objectives, methods, rules, sources, and governance of User Discovery  |
| `user-segments.md`   | User segmentation, buyer, daily user, and priorities                   |
| `user-personas.md`   | Personas that represent the user groups                                |
| `user-goals.md`      | User goals, motivations, and outcomes                                  |
| `pain-points.md`     | User obstacles and problems                                            |
| `jobs-to-be-done.md` | Functional, Emotional, and Social Jobs                                 |
| `user-scenarios.md`  | Real usage situations                                                  |
| `user-journey.md`    | Current-state journey without solutions                                |
| `insights.md`        | Observation, insight, assumption validation, and decision implications |

Each document has a single responsibility and does not repeat the content of other documents.

---

# Expected Output

After the Discovery Plan is used, the project must have:

- Clear discovery objectives.
- Discovery questions that can be answered.
- A validated assumption inventory.
- Observations that have evidence.
- Insights that can be acted on.
- Traceable decisions.
- A consistent User Discovery framework.

---

# Success Criteria

The User Discovery phase is considered successful if:

- All discovery questions have observations.
- All assumptions have been evaluated.
- All insights have clear evidence.
- All insights can be traced to observations.
- No product decision is made without an insight.

---

# Exit Criteria

The Discovery Plan is considered complete when:

- Discovery objectives have been set.
- Discovery questions have been formulated.
- The assumption inventory is available.
- The discovery method has been set.
- Evidence rules have been agreed.
- Confidence levels have been defined.
- Discovery risks have been documented.
- The phase limits have been agreed.
- All User Discovery documents use the Discovery Plan as the primary reference.

---

# Related Documents

- `README.md`
- `user-segments.md`
- `user-personas.md`
- `user-goals.md`
- `pain-points.md`
- `jobs-to-be-done.md`
- `user-scenarios.md`
- `user-journey.md`
- `insights.md`
- `../01-business/target-market.md`
- `../01-business/problem-statement.md`
- `../01-business/competitor-analysis.md`
- `../02-product/mvp-definition.md`
- `../02-product/feature-priority.md`
- `../../project-os/PROJECT_OVERVIEW.md`
- `../../project-os/PROJECT_RULES.md`
- `../../project-os/DECISIONS.md`
