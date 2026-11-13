# User Journey

This document maps the **current-state user journey** of social media management for the priority users.

This journey describes today's working conditions — before or outside the product — without proposing UX solutions, wireframes, or design flows.

---

# Overview

The current-state journey is drafted for the Marketing Team as the primary segment, with notes on variations for Startups and Digital Agencies.

The purpose of the journey is not to design the ideal experience, but to show where friction appears across the real work cycle.

---

# Purpose

- Visualize the current-state workflow from planning to evaluation.
- Mark pain points at specific journey stages.
- Show the differences in experience between the buyer and the daily user.
- Provide an observation basis for product insights.

---

# Scope

## In Scope

- Current-state journey of the Marketing Team.
- Stages, actions, commonly used tools, emotions, and friction.
- Touchpoints across tools.
- Brief variations for Startups and Agencies.
- Opportunity areas (not solution design).

## Out of Scope

- Future-state journey.
- User flow solution.
- Information architecture.
- UI/UX design.
- Technical sequence diagram.

---

# Journey Lens

The main journey follows the point of view of:

- **Primary actor:** Raka (Social Media Manager)
- **Supporting actors:** Sinta (Creator), Maya (Manager/Buyer)
- **Timebox:** one typical weekly cycle

---

# Current-State Journey Map

## Stage 1 — Intake & Briefing

**Goal of stage:** Understand what needs to be published.

| Aspect       | Detail                                                                       |
| ------------ | ---------------------------------------------------------------------------- |
| Actions      | Receive the campaign/content brief from the manager or the planning document |
| Common tools | Chat, docs, email, meeting notes                                             |
| Actors       | Maya → Raka → Sinta                                                          |
| Emotion      | Neutral to slightly overloaded when the brief is incomplete                  |
| Friction     | Brief is scattered; asset context is incomplete; ownership is unclear        |
| Related      | S-01, PP-03, J-06                                                            |

**Opportunity area:** Bring the brief context together with the content work status.

---

## Stage 2 — Content Production

**Goal of stage:** Produce caption drafts and ready-to-use assets.

| Aspect       | Detail                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| Actions      | Write captions, prepare visuals/video, iterate on tone                              |
| Common tools | Docs, design tools, drive/storage, chat for feedback                                |
| Actors       | Sinta (primary), Raka (light review)                                                |
| Emotion      | Focused, but easily frustrated by repeated revisions                                |
| Friction     | Final version is unclear; caption production is slow; feedback gets lost in threads |
| Related      | S-04, PP-08, PP-03, J-05, J-06                                                      |

**Opportunity area:** Speed up drafting and keep version/status visible.

---

## Stage 3 — Scheduling & Queue Setup

**Goal of stage:** Put content into the schedule across accounts.

| Aspect       | Detail                                                                                 |
| ------------ | -------------------------------------------------------------------------------------- |
| Actions      | Choose accounts, set the time, fill the scheduler/queue, check for clashes             |
| Common tools | Scheduling tool, spreadsheet calendar, native schedulers                               |
| Actors       | Raka                                                                                   |
| Emotion      | Careful; anxiety about the wrong account/time                                          |
| Friction     | Context switching from docs to scheduler; status is not synced to the team; PP-04 risk |
| Related      | S-01, S-02, PP-01, PP-04, PP-05, J-01, J-03                                            |

**Opportunity area:** Simplify the draft → schedule path with account clarity.

---

## Stage 4 — Pre-Publish Verification

**Goal of stage:** Make sure what is scheduled is truly ready.

| Aspect       | Detail                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| Actions      | Check the preview, assets, final caption, local time, destination account |
| Common tools | Scheduler + native apps                                                   |
| Actors       | Raka, sometimes Maya                                                      |
| Emotion      | Tense ahead of important slots                                            |
| Friction     | Double verification takes time; other members do not see the same status  |
| Related      | S-03, PP-02, J-02, J-03                                                   |

**Opportunity area:** Visibility of "ready / scheduled / at risk" status.

---

## Stage 5 — Publish & Monitor

**Goal of stage:** Make sure the content goes live successfully.

| Aspect       | Detail                                                            |
| ------------ | ----------------------------------------------------------------- |
| Actions      | Monitor schedule execution, handle failed publishes, confirm live |
| Common tools | Scheduler notifications, native apps                              |
| Actors       | Raka                                                              |
| Emotion      | Relief if successful; stress if it fails                          |
| Friction     | Failures are often only discovered later; manual recovery         |
| Related      | S-03, PP-04, J-02, J-03                                           |

**Opportunity area:** Clarity of publish results and failures early on.

---

## Stage 6 — Engagement Handling

**Goal of stage:** Respond to important audience interactions.

| Aspect       | Detail                                                                               |
| ------------ | ------------------------------------------------------------------------------------ |
| Actions      | Check comments and messages in the native app, prioritize, reply, escalate if needed |
| Common tools | Native Instagram/Facebook/X/LinkedIn apps, sometimes a separate inbox tool           |
| Actors       | Raka / Community Manager                                                             |
| Emotion      | Split attention; FOMO about important comments                                       |
| Friction     | Scattered inbox; priority is not centralized; response time is inconsistent          |
| Related      | S-05, PP-06, PP-01, J-04                                                             |

**Opportunity area:** For the MVP, consolidate comments and replies through a 30-minute periodic pull + manual refresh. Direct Messages, mentions, and engagement webhooks remain out of scope (ADR-040).

---

## Stage 7 — Performance Review

**Goal of stage:** Understand what works and what needs to change.

| Aspect       | Detail                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Actions      | Pull metrics, compile a summary, discuss the next content decisions     |
| Common tools | Native insights, exports, spreadsheet, report slides/docs               |
| Actors       | Maya (primary), Raka supports, Lara in the agency context               |
| Emotion      | Administrative fatigue; wants to get to a decision quickly              |
| Friction     | Slow compilation; late insight; meetings are consumed by data gathering |
| Related      | S-06, PP-07, J-07, J-08                                                 |

**Opportunity area:** A performance snapshot that is sufficient for weekly decisions.

---

## Stage 8 — Process Retrospective & Tool Friction

**Goal of stage:** Assess whether the team's way of working is still sustainable.

| Aspect       | Detail                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Actions      | The buyer evaluates tool overload, onboarding of new members, process cost |
| Common tools | The whole stack the team uses                                              |
| Actors       | Maya / Dimas / Agency Owner                                                |
| Emotion      | Skeptical of new tools; worried adoption will fail                         |
| Friction     | Too many stacks; training is expensive; daily users resist complexity      |
| Related      | S-07, S-09, PP-09, J-09, J-10                                              |

**Opportunity area:** Lower the adoption cost and the number of context switches.

---

# Journey Swimlane Summary

```text
Maya (Buyer)     : Brief → Oversight status → Weekly review → Tool evaluation
Raka (Daily)     : Intake → Schedule → Verify → Publish monitor → Engagement triage → Support reporting
Sinta (Creator)  : Produce drafts → Revise → Hand off
Tools (current)  : Chat/Docs → Design/Drive → Scheduler → Native apps → Analytics exports
```

The most visible pattern: **the work of one cycle is spread across many systems**.

---

# Emotion Curve (Current-State)

| Stage           | Emotion signal       |
| --------------- | -------------------- |
| Intake          | Ambiguity            |
| Production      | Effortful focus      |
| Scheduling      | Caution / anxiety    |
| Verification    | Tension              |
| Publish         | Relief or stress     |
| Engagement      | Fragmented attention |
| Review          | Admin fatigue        |
| Tool evaluation | Adoption skepticism  |

A successful future journey must lower anxiety in scheduling/publish and admin fatigue in review — without adding complexity in onboarding.

---

# Segment Variations

## Startup Variation

- Fewer handoffs; the buyer is often the daily user.
- The production and scheduling stages are often done by the same person.
- High sensitivity to time-to-value and simplicity.

## Agency Variation

- The same stages repeat per client.
- The biggest friction is context switching between brands (PP-10).
- Verification and account clarity are more critical.

---

# Opportunity Areas (Non-Solution)

From the current-state journey, the clearest product opportunities:

1. Reduce the number of systems needed to complete one content cycle.
2. Make content status visible across roles.
3. Lower the risk of wrong publishes.
4. Provide enough engagement triage for daily work.
5. Provide an analytics snapshot for weekly decisions.
6. Keep onboarding light so that team adoption happens.

These opportunities will be consolidated as insights in `insights.md`.

---

# Assumptions Evaluated in This Document

| ID   | Assumption                                     | Observation                                          | Status    |
| ---- | ---------------------------------------------- | ---------------------------------------------------- | --------- |
| A-03 | Fragmented workflow is the core of the problem | The journey passes through many tools at every stage | Supported |
| A-05 | Publishing is the core                         | Stages 3–5 are the center of the weekly rhythm       | Supported |
| A-06 | Engagement & Analytics strengthen the cycle    | Stages 6–7 happen routinely after publishing         | Supported |
| A-02 | Buyer ≠ daily user                             | The Maya vs Raka/Sinta swimlanes clearly differ      | Supported |

---

# Expected Output

After this document is complete, the project must have:

- A documented current-state journey.
- Clear friction per stage.
- The differences between the buyer and daily user roles in the journey.
- Opportunity areas that are ready to be synthesized into insights.

---

# Exit Criteria

User Journey is considered complete when:

- The current-state weekly cycle has been mapped end to end.
- Every stage has actions, tools, friction, and related references.
- The Startup and Agency variations have been noted.
- There is no future-state solution design in this document.
- Insights can be drafted based on journey observations.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-personas.md`
- `user-goals.md`
- `pain-points.md`
- `jobs-to-be-done.md`
- `user-scenarios.md`
- `insights.md`
- `../01-business/problem-statement.md`
- `../02-product/mvp-definition.md`
- `../../project-os/DECISIONS.md`
