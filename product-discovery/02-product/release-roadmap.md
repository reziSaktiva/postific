# Release Roadmap

This document defines the release plan of the **Postific** product based on development milestones.

The roadmap serves as a guide for step-by-step implementation, from the system foundation to the launch of the first version to users.

This roadmap is adaptive and may change based on product validation results, user feedback, and business priorities.

---

# Roadmap Principles

The roadmap is drafted based on these principles:

* Milestone-Based Development.
* Incremental Delivery.
* Product Validation First.
* Quality Over Quantity.
* Sustainable Development.

The product is developed in stages, making sure every milestone produces a real increase in value.

---

# Release Strategy

All releases follow this approach:

* Every release must produce an improvement that can be used.
* Every release must have a clear goal.
* No release may contain only technical changes without giving a benefit to the product.
* Every release must become the foundation for the next release.

---

# Planned Releases

## v0.1 — Foundation

Goal:

Build the application foundation.

Focus:

* Project Setup
* Authentication
* Workspace
* User Management
* Social Account Connection
* Basic Settings

Outcome:

The platform is ready to start developing the main workflows.

---

## v0.2 — Publishing MVP

Goal:

Let users create and schedule content.

Focus:

* Content Draft
* Content Format per account (Post / Reel / Story / Pin — ADR-039)
* Schedule
* Queue
* Calendar
* Publishing History

Outcome:

Users can manage the publishing process from start to finish.

---

## v0.3 — Analytics MVP

Goal:

Give visibility into content performance.

Focus:

* Dashboard
* Engagement Metrics
* Performance Reports
* Basic Insights

Outcome:

Users can evaluate publishing results.

---

## v0.4 — Engagement MVP

Goal:

Bring social media interactions together in one place.

Focus:

* Comments
* Comments Inbox
* Reply Management
* Periodic Pull every 30 minutes
* Manual Refresh

Outcome:

Users can read and reply to comments without switching platforms, with data refreshed every 30 minutes or through manual refresh.

Direct Messages, mentions, and engagement webhooks are not part of this MVP release (ADR-040).

---

## v0.5 — MCP Server MVP

Goal:

Let users work in Postific through the AI of their own choice
(ADR-138). Postific does not build its own AI.

Focus:

* AI client connection through OAuth (one workspace per connection)
* Read, draft, and schedule tools
* Audit, rate limit, and connection revocation

Outcome:

The user's AI can read, draft, and schedule content in
Postific. Publish Now and replying to comments through MCP are postponed.

---

## v0.6 — Start Page MVP

Goal:

Provide a public page for bio link needs.

Focus:

* Public Profile
* Link Management
* Theme Configuration
* Basic Analytics

Outcome:

Users can share the public page through social media.

---

## v1.0 — Public Launch

Goal:

Launch the product to the public.

Focus:

* Product Stability
* Performance
* Security
* Documentation
* Bug Fixing
* User Experience Improvement

Outcome:

The product is ready for general use.

---

# Roadmap Review

The roadmap will be evaluated based on:

* User feedback.
* Product Validation results.
* Changes in business priorities.
* Resource availability.
* Changes in technology or third-party integrations.

Roadmap changes must be documented.

---

# Success Criteria

The roadmap is considered successful when:

* Every release has a clear goal.
* The development order supports the MVP.
* Every release gives an increase in value.
* The product grows in stages toward the Public Launch.

---

# Decision Rules

Changes to the release order or the scope of each release must be recorded in:

* `../../project-os/DECISIONS.md`

Roadmap progress changes must be updated in:

* `../../project-os/PROJECT_STATE.md`

---

# Related Documents

* `README.md`
* `mvp-definition.md`
* `feature-priority.md`
* `future-roadmap.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
