# Insights

This document consolidates the observations, patterns, and insights from all of User Discovery.

Insights are used to evaluate the Business/Product Baseline assumptions and support the next product decisions. Insights do **not** automatically change the baseline.

---

# Overview

User Discovery in this phase was carried out through desktop research and product discovery (Buffer, Postiz, competitors, documentation, communities, articles, videos, and practical experience).

The results are summarized following the project vocabulary:

```text
Assumption → Discovery → Observation → Insight → Decision
```

Decisions that change the Target Market, Problem Statement, Product Vision, Product Scope, MVP, or Feature Priority must go into `../../project-os/DECISIONS.md`.

---

# Purpose

- Provide a single source of truth for User Discovery findings.
- Assess the status of the assumptions inventoried in the Discovery Plan.
- Spell out product implications without entering UX/technical design.
- Prepare material for UX Discovery and Architecture Discovery.

---

# Scope

## In Scope

- Key observations.
- Synthesized insights.
- Assumption review outcomes.
- Product implications (decision level, not specification).
- Open questions for the next phase.

## Out of Scope

- UX/UI solution.
- Wireframe and prototype.
- Architecture, database, API.
- Baseline changes without an ADR.

---

# Key Observations

An observation is a pattern that repeats across discovery sources, not a product opinion.

| ID   | Observation                                                                                                                  | Sources                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| O-01 | Marketing teams complete one content cycle through many separate tools (docs, chat, scheduler, native apps, analytics).      | Problem Statement, competitor landscape, community discussions     |
| O-02 | The Social Media Manager is the daily operational center; the Manager/Buyer more often needs visibility and summaries.       | Target Market, persona synthesis                                   |
| O-03 | Tool adoption failures often occur when onboarding and the daily workflow feel complicated.                                  | Competitor weaknesses (complex suites), buyer evaluation scenarios |
| O-04 | Publishing reliability (schedule, queue, calendar, history) is the foundation of value that users understand most easily.    | Buffer/Postiz patterns, MVP definition alignment                   |
| O-05 | Engagement handling remains scattered across native apps in many teams, so response time is inconsistent.                    | Problem Statement, scenario S-05                                   |
| O-06 | Analytics is needed routinely, but often in the form of decision snapshots, not an enterprise suite.                         | Buyer goals, weekly review scenario                                |
| O-07 | AI is most relevant when it is attached to creating/improving captions inside the draft flow, not as a separate destination. | Competitor AI positioning, creator scenario                        |
| O-08 | Agencies have the same core jobs, with the added risk of multi-client context switching.                                     | Target Market secondary, scenario S-08                             |
| O-09 | Startups often combine buyer and daily user in one person, so time-to-value becomes critical.                                | Secondary segment characteristics                                  |
| O-10 | The individual creator is not the user most aligned with the team collaboration value proposition in the MVP.                | ADR-006, target-market out of scope                                |

---

# Insights

## I-01 — Primary Value Is Workflow Consolidation for Teams

**Based on:** O-01, O-02, O-04

Priority users are not looking for "more social features". They are looking for less context switching so that the draft → schedule → publish → respond → review cycle is more compact.

**Implication**

The MVP must win the core publishing job first, then tie engagement and analytics in as continuations of the same cycle.

---

## I-02 — Buyer and Daily User Optimize for Different Success Signals

**Based on:** O-02, O-03, O-06

The buyer optimizes for visibility, adoption, and team efficiency. The daily user optimizes for execution speed and error prevention.

**Implication**

Product messaging and capability priorities must serve both: reliability for the daily user, clarity for the buyer. Neglecting either lowers the chance of adoption.

---

## I-03 — Simplicity Is a Product Requirement, Not a Styling Preference

**Based on:** O-03, O-09

In an already competitive category, complexity is a churn risk. Startups and lean Marketing Teams will reject a tool that feels "heavy" even if its features are complete.

**Implication**

MVP scope decisions must keep using the simplicity filter. Could-haves that add cognitive load should be deferred.

---

## I-04 — Publishing Trust Beats Feature Breadth

**Based on:** O-04, journey stages 3–5

Trust that content will be published to the right account at the right time matters more than the completeness of secondary features at the start.

**Implication**

The Publishing quality bar (draft, schedule, queue, calendar, history, account clarity) is the foundation of Product-Market Fit.

---

## I-05 — Engagement and Analytics Are Retention Layers

**Based on:** O-05, O-06

Once publishing is running, users need a way to handle priority interactions and see a performance summary. Without both, the product is easily seen again as "just a scheduler".

**Implication**

Order of value: Publishing reliability → comment triage → Analytics snapshot. MVP Engagement is limited to Comments Inbox + reply with a 30-minute periodic pull and manual refresh; Direct Messages, mentions, and engagement webhooks are not part of the MVP (ADR-040).

---

## I-06 — AI Should Reduce Production Friction Inside the Draft Job

**Based on:** O-07

AI is considered useful when it speeds up caption generation/improvement at the moment the user is already in the draft context.

**Implication**

The MVP AI Assistant should stay close to the Publishing Draft. Avoid placing AI as a module separate from the main job.

---

## I-07 — Secondary Segments Share Core Jobs, Differ in Context Risk

**Based on:** O-08, O-09

Startups and Agencies do not need a "different product" in this phase. They need the same jobs under different context pressure: speed for startups, multi-account safety for agencies.

**Implication**

Do not over-segment the MVP. Build the core for the Marketing Team, make sure it is usable in secondary contexts.

---

## I-08 — Collaboration Pain Is Real, but Full Approval Workflow Is Not MVP-Critical

**Based on:** O-01, O-02, pain PP-02/PP-03, feature priority Won't Have

Teams need clear status and basic handoff. However, a layered approval workflow is closer to enterprise/advanced-agency needs.

**Implication**

Support status visibility and lightweight handoff in the MVP. Advanced approval stays out of scope per the Product Baseline.

---

# Assumption Review

| ID   | Assumption                                        | Result                      | Evidence                                                        |
| ---- | ------------------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| A-01 | Marketing Team is the primary user                | **Supported**               | I-01, I-07, O-02, O-10                                          |
| A-02 | Buyer and daily user are often different          | **Supported**               | I-02, journey swimlane                                          |
| A-03 | Fragmented workflow is the main problem           | **Supported**               | O-01, current-state journey                                     |
| A-04 | Team collaboration is an important differentiator | **Supported (scoped)**      | I-08 — important as visibility/handoff, not enterprise approval |
| A-05 | Publishing is the core job                        | **Supported**               | I-04, J-01–J-03                                                 |
| A-06 | Analytics and Engagement strengthen retention     | **Supported**               | I-05                                                            |
| A-07 | AI is useful if integrated into the workflow      | **Supported**               | I-06                                                            |
| A-08 | Individual creator is not an MVP focus            | **Supported**               | O-10                                                            |
| A-09 | Startup/Agency are similar with different nuances | **Supported**               | I-07                                                            |
| A-10 | Users will consolidate if it is simple            | **Supported (conditional)** | I-03 — conditional on simplicity and time-to-value              |

No major baseline assumption was **Contradicted** in this desktop discovery phase.

---

# Product Implications

The following implications **support** Business Baseline v1.0 and Product Baseline v1.0. No ADR change is needed at this time.

1. Keep Marketing Team as primary; Startup and Agency as secondary.
2. Keep the buyer vs daily user separation in product decisions and messaging.
3. Keep Publishing as the MVP foundation.
4. Keep Engagement and Analytics as part of the value cycle, not ornaments.
5. Keep the AI Assistant as in-workflow help on captions/drafts.
6. Keep Start Page as a supporting capability, not the center of the weekly journey.
7. Keep advanced approval, social listening, white-label, and enterprise complexity outside the MVP.
8. Make simplicity and account/publish trust a non-negotiable quality bar.

---

# Implications for Next Phases

## For UX Discovery

- Design the experience around the daily user's weekly cycle, with an oversight mode for the buyer.
- Prioritize clarity of content status and account context.
- Avoid the "feature cafeteria" pattern that raises cognitive load.
- Place AI help at the draft moment, not as a main navigation destination.

## For Architecture Discovery

- The Publishing, Workspace, Engagement, Analytics, and AI Assistant domains remain relevant as product bounded contexts.
- Publish reliability and account integration will be the technical critical path.
- The design must support multi-account clarity from the start.

Note: architecture details are not discussed here.

---

# Open Questions

The following questions were not closed by desktop discovery and can be carried into the next phase (without blocking the current baseline):

1. How far does the handoff status need to be visualized before it starts to feel like an approval workflow?
2. Once the MVP comments/reply is validated, does expanding the inbox to Direct Messages or mentions give enough value for the next phase?
3. Which weekly analytics snapshot does the buyer use most often in real practice?
4. In a lean agency, is separating brand context through simple account grouping enough?

These open questions do **not** change the current MVP; they are used as input for the next research/validation.

---

# Decision Gate

| Candidate Change                 | Needed now? | Action                        |
| -------------------------------- | ----------- | ----------------------------- |
| Change the primary target market | No          | Keep ADR-006                  |
| Change the MVP domains           | No          | Keep Product Baseline v1.0    |
| Raise approval workflow to MVP   | No          | Remain Won't Have             |
| Drop AI from the MVP             | No          | Keep as in-workflow Must Have |
| Expand to individual creator     | No          | Remain out of MVP focus       |

**Conclusion:** User Discovery supports the current baseline direction. No new Decision ADR must be created at this point.

---

# Expected Output

After this document is complete, the project must have:

- The key insights documented.
- A clear assumption status (supported / conditional / contradicted).
- Product implications for the next phase.
- A decision on whether the baseline needs to change or not.

---

# Exit Criteria

Insights are considered complete when:

- The key observations have been consolidated.
- Actionable insights have been formulated.
- The assumption inventory has been reviewed.
- Implications for Product/UX/Architecture have been recorded at the decision level.
- No baseline change is pending without an ADR.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-segments.md`
- `user-personas.md`
- `user-goals.md`
- `pain-points.md`
- `jobs-to-be-done.md`
- `user-scenarios.md`
- `user-journey.md`
- `../01-business/problem-statement.md`
- `../01-business/target-market.md`
- `../01-business/competitor-analysis.md`
- `../02-product/mvp-definition.md`
- `../02-product/feature-priority.md`
- `../../project-os/PROJECT_OVERVIEW.md`
- `../../project-os/PROJECT_STATE.md`
- `../../project-os/DECISIONS.md`
