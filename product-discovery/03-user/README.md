# 03 — User

The documentation in this folder focuses on **User Discovery** for the **Postific** product, starting from understanding who the users are, how they work, and the problems they face, through to producing insights that can serve as the basis for product decisions.

All documentation in this folder must refer to the agreed **Business Baseline** and **Product Baseline**. Insights are used to evaluate assumptions and support product decisions, not to change the baseline without a documented decision process.

---

# Purpose

- Understand the primary and secondary users in depth.
- Identify user goals, motivations, behaviors, needs, and pain points.
- Distinguish the needs of the buyer from those of the daily user.
- Define Jobs To Be Done (JTBD) based on the user's work context.
- Evaluate assumptions that come from Business Discovery and Product Discovery.
- Produce insights that can be used as the basis for the UX Discovery and Architecture Discovery stages.

---

# Scope

This folder covers **User Discovery** only.

Topics included in the scope:

- Discovery objectives and discovery questions.
- User segments.
- Buyer and daily user.
- User personas.
- User goals.
- Pain points.
- Jobs To Be Done (JTBD).
- User scenarios.
- Current user journey.
- Assumptions.
- Observations.
- Insights.
- References from similar products, communities, articles, documentation, videos, and relevant experience.

The approach in this phase focuses on **desktop research** and **product discovery**. User interviews, surveys, usability testing, and field validation are not within the scope of this phase.

The following topics are **not covered** in this folder:

- UX Design
- UI Design
- Information Architecture
- User Flow Solution
- Wireframe
- Prototype
- Technical Architecture
- Database Design
- API Design
- Implementation

---

# Document List

- `discovery-plan.md` — discovery objectives, questions, reference sources, and scope.
- `user-segments.md` — user groups, buyer, daily user, and user priorities.
- `user-personas.md` — initial personas based on assumptions, observations, and insights.
- `user-goals.md` — the goals, motivations, and outcomes users want to achieve.
- `pain-points.md` — the obstacles and problems users face.
- `jobs-to-be-done.md` — the functional, emotional, and social jobs users want to get done.
- `user-scenarios.md` — usage context in real situations.
- `user-journey.md` — the user's current-state journey without proposing solutions.
- `insights.md` — summary of observations, patterns, insights, and their implications for product decisions.

---

# Discovery Workflow

The whole User Discovery process follows this flow:

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

An insight does not automatically become a product decision. All changes to the baseline must go through review and documentation.

---

# How to Use

1. Start from `discovery-plan.md` to set the discovery objectives and scope.
2. Collect references from similar products, communities, articles, documentation, videos, and other relevant sources.
3. Define the user groups in `user-segments.md`.
4. Draft the initial personas in `user-personas.md`.
5. Document the user goals and pain points.
6. Define the Jobs To Be Done (JTBD).
7. Describe the user scenarios.
8. Map the current-state user journey.
9. Consolidate all insights in `insights.md`.
10. Use the insights as the basis for discussion before making product decisions.

---

# Expected Output

After all documents in this folder are complete, the project must have:

- Well-documented User Discovery.
- User segmentation consistent with the Target Market.
- A clear separation between buyer and daily user.
- Realistic User Personas.
- User Goals and Pain Points validated through discovery.
- Clear Jobs To Be Done (JTBD).
- A documented Current User Journey.
- Insights that can be used as the basis for UX and Architecture.
- A list of assumptions that are supported, not yet supported, or contradicted by the discovery results.

---

# Exit Criteria

User Discovery is considered complete when:

- Discovery objectives have been set.
- User segments have been defined.
- Buyer and daily user have been distinguished.
- User personas have been drafted.
- User goals, pain points, and JTBD have been documented.
- The current user journey is complete.
- The main insights have been summarized.
- All important assumptions have been reviewed.
- All documents have gone through the User Discovery Review.

---

# Decision Rules

Insights that lead to a change to:

- Target Market
- Problem Statement
- Product Vision
- Product Scope
- MVP
- Feature Priority

must be documented in:

- `../../project-os/DECISIONS.md`

Changes to User Discovery progress must be updated in:

- `../../project-os/PROJECT_STATE.md`

---

# Related Documents

- `../README.md`
- `../01-business/README.md`
- `../01-business/product-vision.md`
- `../01-business/problem-statement.md`
- `../01-business/target-market.md`
- `../02-product/README.md`
- `../02-product/product-scope.md`
- `../02-product/mvp-definition.md`
- `../02-product/feature-modules.md`
- `../../project-os/PROJECT_OVERVIEW.md`
- `../../project-os/PROJECT_RULES.md`
- `../../project-os/PROJECT_STATE.md`
- `../../project-os/DECISIONS.md`
