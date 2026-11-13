# User Scenarios

This document describes real usage contexts for **Postific** users.

A scenario describes the _situation_ in which jobs arise, without proposing UX solutions or interface design.

---

# Overview

User Scenarios bridge personas, goals, pain points, and JTBD into concrete work situations.

Each scenario represents a recurring condition in the Marketing Team, Startup, or Digital Agency before or outside this product (current-state oriented).

---

# Purpose

- Make usage context concrete and discussable.
- Show when jobs are triggered in real work.
- Provide material for the current-state journey.
- Help evaluate whether the MVP covers critical situations.

---

# Scope

## In Scope

- MVP-relevant current-state scenarios.
- Trigger, actors, context, constraints, and desired outcome.
- Mapping to personas, jobs, and pain points.

## Out of Scope

- Ideal future-state flow (solution).
- Wireframe, prototype, UI copy.
- Technical system edge cases.
- Enterprise scenarios outside the MVP.

---

# Scenario Structure

Each scenario contains:

- Context
- Trigger
- Actors
- Current behavior
- Friction
- Desired outcome (from the user's point of view)
- Related jobs / pain points

---

# Scenario Set

## S-01 — Weekly Content Planning

**Segment:** Marketing Team  
**Persona:** Raka (+ Sinta, Maya oversight)

**Context**

The team must prepare content for next week across several accounts.

**Trigger**

The start of the week or the end of the previous week; the calendar looks thin.

**Current Behavior**

- The brief is drafted in a document or chat.
- Captions are written separately.
- Assets are collected from the drive.
- The schedule is finally entered into a scheduling tool or a native scheduler.

**Friction**

- The caption version is unclear.
- The "ready to schedule" status is ambiguous.
- Coordination takes a lot of chasing.

**Desired Outcome**

All important slots are filled with ready-to-publish content before the week starts.

**Related:** J-01, J-02, J-06 | PP-01, PP-02, PP-03, PP-05

---

## S-02 — Same-Day Schedule Adjustment

**Segment:** Marketing Team / Startup  
**Persona:** Raka or Dimas

**Context**

There is a change in business priorities (a sudden promo, a timing issue, or content has to be moved).

**Trigger**

A request from the manager/founder in the middle of the day.

**Current Behavior**

- Look for the already scheduled post in the tool.
- Edit the time/account manually.
- Make sure there is no clash with other slots.

**Friction**

- It is hard to see the whole queue.
- Risk of a double-post or an empty slot.
- The change is not visible to other members.

**Desired Outcome**

The schedule is adjusted quickly without causing a publishing mistake.

**Related:** J-01, J-03 | PP-02, PP-04, PP-05

---

## S-03 — Multi-Account Publishing Morning

**Segment:** Marketing Team / Agency  
**Persona:** Raka / Lara’s team

**Context**

Several accounts need to be published or checked on a workday morning.

**Trigger**

Operating hours begin; several posts have a scheduled/publishing status.

**Current Behavior**

- Check the status in the scheduling tool.
- Open native apps to verify.
- Handle publish failures reactively.

**Friction**

- Failures are only noticed late.
- Cross-platform verification takes time.
- Accounts with similar names increase the risk of checking the wrong one.

**Desired Outcome**

Publication status is clear and problems are handled before the impact grows.

**Related:** J-02, J-03 | PP-04, PP-02

---

## S-04 — Caption Production Sprint

**Segment:** Marketing Team / Startup  
**Persona:** Sinta / Dimas

**Context**

Lots of content needs captions in different tones in a short time.

**Trigger**

A batch of content comes in; the scheduling deadline is approaching.

**Current Behavior**

- Write from scratch in docs.
- Ask for feedback via chat.
- Iterate on tone repeatedly.

**Friction**

- Slow production.
- Scattered revisions.
- The final version is hard to track.

**Desired Outcome**

Schedule-ready drafts are finished faster with little back-and-forth.

**Related:** J-05, J-06 | PP-08, PP-03

---

## S-05 — Midday Engagement Triage

**Segment:** Marketing Team  
**Persona:** Raka / Community Manager

**Context**

In the current situation, comments and messages arrive throughout the day from several platforms. The MVP solution consolidates comments only; Direct Messages and mentions are still handled in the native app (ADR-040).

**Trigger**

Scheduled triage time, manual refresh, or an internal notification after comment sync.

**Current Behavior**

- Open each native app.
- Look for important comments manually.
- Reply to comments one by one.

**Friction**

- Priority interactions are easily missed.
- High context switching.
- No centralized priority queue.

**Desired Outcome**

Important comments are handled within the team's internal SLA through a Comments Inbox that is refreshed every 30 minutes or on manual refresh.

**Related:** J-04 | PP-06, PP-01

---

## S-06 — Weekly Performance Review

**Segment:** Marketing Team / Startup / Agency  
**Persona:** Maya / Dimas / Lara

**Context**

A weekly review to assess what needs to be repeated or changed.

**Trigger**

A weekly meeting or a request for a short report.

**Current Behavior**

- Exports/metrics are pulled from several dashboards.
- Data is merged in a spreadsheet.
- Insights are compiled manually.

**Friction**

- Long compilation time.
- Late insight.
- Discussion is more about raw data than decisions.

**Desired Outcome**

A performance snapshot sufficient for iteration decisions in a short time.

**Related:** J-08, J-07 | PP-07

---

## S-07 — New Team Member Onboarding to Tools

**Segment:** Marketing Team / Agency  
**Persona:** Maya (buyer), Raka (buddy)

**Context**

A new member has to join the publishing workflow.

**Trigger**

The new member's join date.

**Current Behavior**

- Invited to several tools.
- Taught the process via chat/call.
- Often still asks "ini final belum?" during the first week.

**Friction**

- Too many tools = expensive onboarding.
- The process is not standardized.
- Higher risk of errors at the start.

**Desired Outcome**

The new member can contribute to drafts/schedules quickly and safely.

**Related:** J-09, J-10, J-06 | PP-09, PP-03

---

## S-08 — Agency Multi-Client Deadline Day

**Segment:** Digital Agency  
**Persona:** Lara

**Context**

Several clients have content deadlines on the same day.

**Trigger**

A packed delivery day.

**Current Behavior**

- Switch between folders, chats, and tools per client.
- Check the status of each account separately.
- Do a manual quality check so brands do not get mixed up.

**Friction**

- Context overload.
- Risk of the wrong asset/account.
- Oversight becomes a bottleneck.

**Desired Outcome**

All deliveries are completed on time with the lowest possible risk of the wrong brand.

**Related:** J-03, J-07, J-10 | PP-10, PP-04, PP-02

---

## S-09 — Tool Evaluation by Buyer

**Segment:** Marketing Team / Startup  
**Persona:** Maya / Dimas

**Context**

The buyer evaluates whether a new tool is worth adopting by the team.

**Trigger**

Operational pain increases or the old tool's contract is about to end.

**Current Behavior**

- Compare competitor features.
- A short trial.
- Ask the daily user whether it feels practical.

**Friction**

- Many features do not guarantee adoption.
- The daily user rejects a tool that is slow/complicated.
- The buyer worries about ROI.

**Desired Outcome**

Choose a tool the team uses routinely that reduces context switching.

**Related:** J-09 | PP-09, PP-01

---

# Scenario Priority for MVP Validation

| Priority | Scenario               | Why                                            |
| -------- | ---------------------- | ---------------------------------------------- |
| P0       | S-01, S-03, S-05, S-06 | Represent the core publish–engage–review cycle |
| P0       | S-09                   | Determines whether adoption is possible        |
| P1       | S-02, S-04, S-07       | High frequency, strengthens value              |
| P1       | S-08                   | Important for the secondary Agency segment     |

If the product does not help in the P0 scenarios, Product-Market Fit is at low odds even if the features look complete.

---

# Assumptions Evaluated in This Document

| ID   | Assumption                                    | Observation                                                     | Status    |
| ---- | --------------------------------------------- | --------------------------------------------------------------- | --------- |
| A-01 | Marketing Team primary                        | Most P0 scenarios center on the Marketing Team                  | Supported |
| A-05 | Publishing core                               | S-01/S-02/S-03 dominate the work rhythm                         | Supported |
| A-09 | Startup/Agency similar with different nuances | S-04/S-08 show specific contexts without changing the core jobs | Supported |
| A-10 | Consolidation is accepted if simple           | S-07 and S-09 confirm adoption as a gate                        | Supported |

---

# Expected Output

After this document is complete, the project must have:

- A set of concrete usage scenarios.
- A mapping of scenarios to jobs and pain points.
- Scenario priorities for MVP validation.
- Enough material to draft the current-state journey.

---

# Exit Criteria

User Scenarios is considered complete when:

- The P0 scenarios have been documented.
- Every scenario has actors, friction, and a desired outcome.
- A mapping to JTBD and pain points is available.
- There is no solution design in the document.
- The User Journey can be drafted from these scenarios.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-personas.md`
- `user-goals.md`
- `pain-points.md`
- `jobs-to-be-done.md`
- `user-journey.md`
- `insights.md`
- `../01-business/problem-statement.md`
- `../02-product/mvp-definition.md`
- `../../project-os/DECISIONS.md`
