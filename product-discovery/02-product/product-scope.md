# Product Scope

This document defines the scope of the **Postific** product at the domain level.

Its main purpose is to make sure all product development has clear boundaries before entering the feature design, UX, and architecture stages.

---

# Overview

The product is designed as a Social Media Management platform that helps Marketing Teams, Startups, and Digital Agencies manage social media activity in an integrated way.

The product scope focuses on activities directly related to planning, collaboration, publishing, analysis, and management of social media.

---

# Product Principles

The whole product scope follows these principles:

* Simplicity First.
* Team Collaboration First.
* AI-Native Workflow (the user's AI works inside the product through MCP, ADR-138).
* Modern User Experience.
* Scalable Architecture.
* Modular Product Design.

---

# Core Product Domains

## Workspace

Manages the organizations that use the platform.

Includes:

* Workspace
* Members
* Roles
* Permissions
* Brand / Organization Settings

---

## Publishing

Manages the whole content publishing process.

Includes:

* Content Draft
* Content Format per account (Post / Reel / Story / Pin — ADR-039)
* Schedule
* Queue
* Calendar
* Publishing History

---

## Analytics

Manages social media performance data.

Includes:

* Dashboard
* Reports
* Engagement Metrics
* Performance Insights

---

## Engagement

Manages audience comments and replies from a single inbox.

Includes:

* Comments
* Comment Replies
* Inbox
* Periodic Pull every 30 minutes
* Manual Refresh

Post-MVP improvements (Should Have, ADR-157): comment status and grouping by post.

Direct Messages, mentions, and engagement webhooks are outside the MVP scope (ADR-040).

---

## MCP Server

Lets users work in Postific through the AI of their own choice
(Claude, ChatGPT, Cursor, and other MCP clients). Postific does not build its own
AI (ADR-138).

Includes:

* Read access (accounts, media, drafts, queue, history, analytics, comments)
* Creating and editing drafts, uploading media from a URL
* Scheduling posts
* OAuth authorization per workspace and per scope
* Access audit and usage limits

Publish Now and replying to comments through MCP are postponed. Destructive and
administrative actions are not exposed.

---

## Start Page

Provides a public page for managing a collection of links.

Includes:

* Public Profile
* Link Management
* Theme Configuration
* Analytics

---

# Supporting Domains

Besides the core domains, the product also needs supporting domains.

* Authentication
* User Profile
* Notifications
* Media Library
* Settings
* Billing
* API Integrations
* Audit Log

These domains support platform operations but are not the main value of the product.

---

# Product Boundaries

The product focuses on Social Media Management activities.

The product does not aim to become:

* A Social Media Platform.
* A CRM.
* An Email Marketing Platform.
* A Marketplace.
* A Marketing Automation Platform.
* A Customer Support Platform.

These boundaries help keep product development focused.

---

# Out of Scope (MVP)

The following features are not a priority in the MVP phase:

* White Label.
* Marketplace Integrations.
* Browser Extension.
* Mobile Application.
* Public API.
* Plugin Ecosystem.
* Complex Enterprise Workflow.
* Direct Messages, mentions, and engagement webhooks.

These topics will be evaluated in later development phases.

---

# Success Criteria

Product Scope is considered complete when:

* The main product domains have been defined.
* Supporting domains have been identified.
* Product boundaries have been agreed.
* The MVP scope has a clear basis to be defined in the next document.

---

# Related Documents

* `README.md`
* `mvp-definition.md`
* `feature-modules.md`
* `../01-business/product-vision.md`
* `../01-business/problem-statement.md`
* `../01-business/target-market.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/DECISIONS.md`
