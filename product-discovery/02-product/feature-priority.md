# Feature Priority

This document defines the development priority of every feature of the **Postific** product.

Priority is determined by business value, user needs, implementation complexity, and contribution to Product-Market Fit.

This document is the main reference for drafting the roadmap and the implementation order.

---

# Overview

Not all features are equally important.

For that reason, every feature is classified using the **MoSCoW** method so that development stays focused on the features that give users the most value.

---

# Priority Framework

## Must Have

Features that must be available for the product to be usable by the target users.

Without these features, the product cannot meet the main goal of the MVP.

---

## Should Have

Features that are very useful but can still be postponed if needed.

The product can still run without these features.

---

## Could Have

Features that improve the user experience but are not a main requirement.

Implementation depends on time, resources, and product validation results.

---

## Won't Have (Current Release)

Features that will deliberately not be developed in the current phase.

This does not mean these features are unimportant, but they are not a priority for reaching the MVP goal.

---

# Feature Priorities

## Workspace

### Must Have

* Workspace Management
* Team Members
* Roles & Permissions
* Social Account Connection

### Should Have

* Workspace Branding

### Could Have

* Multi Brand Management
* Team Activity Feed

### Won't Have

* Multi Organization Hierarchy

---

## Publishing

### Must Have

* Content Draft
* Content Format Selection (Post / Reel / Story on IG & FB; Pin on Pinterest; default Post on other platforms — ADR-039)
* Schedule Post
* Calendar View
* Queue Management
* Publishing History

### Should Have

* Media Library
* Content Templates

### Could Have

* Bulk Scheduling
* Recurring Posts

### Won't Have

* Advanced Approval Workflow

---

## Analytics

### Must Have

* Dashboard
* Basic Performance Metrics
* Engagement Summary

### Should Have

* Comparative Reports

### Could Have

* Custom Reports
* AI Insights (done by the client's AI through MCP, not a Postific feature)

### Won't Have

* Enterprise Analytics

---

## Engagement

### Must Have

* Comments
* Comments Inbox
* Reply Comments
* Periodic Sync every 30 minutes
* Manual Refresh

### Should Have

* Comment status (Belum dibalas, Dibalas, Selesai, Diabaikan) and grouping comments by post (ADR-157; post-MVP improvement, the v0.4 DoD is already met without this)

### Could Have

* Inbox Assignment

### Won't Have

* Social Listening
* Direct Messages
* Mentions
* Engagement Webhooks

---

## MCP Server

### Must Have

* OAuth connection per workspace with scopes (`read`, `draft`, `schedule`)
* Read tools (accounts, media, drafts, queue, history, analytics, comments)
* Draft tools (create, edit, upload media from a URL)
* Schedule tools (`schedule_posts`, batch)
* Call audit and rate limit per workspace
* Revoking an AI client connection
* MCP source marker ("dibuat lewat MCP"): badge and source filter in History, Drafts, and Queue (Calendar has no badge)

### Won't Have

* Publish Now through MCP (postponed, ADR-138)
* Reply to comments through MCP (postponed, ADR-138)
* Destructive and administrative actions through MCP (delete, cancel schedule, manage members/roles, disconnect accounts)
* Built-in Postific AI (removed, ADR-138)
* Autonomous AI Agent

---

## Start Page

### Must Have

* Link Management
* Public Page

### Should Have

* Themes

### Could Have

* Basic Analytics

### Won't Have

* E-commerce Widgets

---

# Prioritization Principles

Priorities are determined based on the following principles:

* Give users direct value.
* Support the MVP goal.
* Reduce implementation complexity.
* Speed up Product-Market Fit validation.
* Have a high business impact.

---

# Review Process

Feature priorities will be evaluated periodically based on:

* User feedback.
* Product usage data.
* Changes in business needs.
* Changes in product strategy.

Priority changes must be documented.

---

# Success Criteria

Feature Priority is considered complete when:

* Every feature has a priority level.
* Priorities are aligned with the MVP goal.
* The development order can be determined.
* The implementation roadmap can be drafted based on this document.

---

# Related Documents

* `README.md`
* `product-scope.md`
* `mvp-definition.md`
* `feature-modules.md`
* `release-roadmap.md`
* `future-roadmap.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/DECISIONS.md`
