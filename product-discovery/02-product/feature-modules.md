# Feature Modules

This document defines how features are divided into product modules.

Its main purpose is to make sure every product capability has a clear responsibility boundary before entering the UX and Architecture stages.

The modules defined here represent the business domain, not the page structure or the source code structure.

---

# Overview

The product is built using a modular approach.

Each module has a specific responsibility and can evolve independently without disrupting the other modules.

This approach supports development that is more structured, easier to maintain, and easier to scale.

---

# Core Product Modules

## Workspace

Manages the organizations that use the platform.

Responsibilities:

* Workspace
* Organization
* Members
* Roles
* Permissions
* Brand Settings

---

## Publishing

Manages the entire content publishing lifecycle.

Responsibilities:

* Content Draft
* Content Format per target (Post / Reel / Story / Pin — ADR-039)
* Schedule
* Queue
* Calendar
* Publishing History

---

## Analytics

Manages social media performance data.

Responsibilities:

* Dashboard
* Reports
* Performance Metrics
* Insights

---

## Engagement

Manages audience comments and replies from a single inbox.

Responsibilities:

* Comments
* Comment Replies
* Comments Inbox
* Periodic Sync every 30 minutes
* Manual Refresh

Post-MVP improvements (Should Have, ADR-157): comment status and grouping by post.

Direct Messages, mentions, and engagement webhooks are not MVP responsibilities of this module (ADR-040).

---

## MCP Server

Exposes product actions to the user's own AI through MCP (ADR-138). Contains
no AI of its own.

Responsibilities:

* OAuth authorization per workspace and per scope
* Read, draft, and schedule tools that wrap the Application Service
* Call audit and MCP source marker
* Rate limit per workspace

---

## Start Page

Manages the user's public page.

Responsibilities:

* Public Profile
* Link Management
* Theme
* Basic Analytics

---

# Supporting Modules

Modules that support product operations but are not the business core.

## Authentication

Responsibilities:

* Login
* Register
* Session
* OAuth

---

## User Profile

Responsibilities:

* Personal Profile
* Preferences
* Notification Settings

---

## Media Library

Responsibilities:

* Upload
* Media Management
* Media Reuse

---

## Notifications

Responsibilities:

* Email
* In-App Notification
* Activity Updates

---

## Billing

Responsibilities:

* Subscription
* Payment
* Invoice

---

## Settings

Responsibilities:

* Organization Settings
* Account Settings
* Integrations

---

# Infrastructure Modules

Technical modules that support the whole system.

* API Integrations
* Webhooks
* Audit Logs
* File Storage
* Background Jobs
* Monitoring

Implementation details will be covered in the Architecture phase.

---

# Module Relationships

Relationships between modules follow these principles:

* Each module has a clear responsibility.
* Modules interact through defined contracts.
* No module becomes the center of all business logic.
* Dependencies between modules must be minimized.

The module relationship diagram will be created in the Architecture phase.

---

# Module Design Principles

All modules follow these principles:

* Single Responsibility.
* High Cohesion.
* Low Coupling.
* Domain-Oriented.
* Scalable.
* Easy to Maintain.

---

# Success Criteria

Feature Modules is considered complete when:

* All main domains have been identified.
* The responsibilities of each module have been defined.
* Supporting modules have been separated from core modules.
* Relationships between modules are understood.
* The document can be used as the basis for drafting the system architecture.

---

# Related Documents

* `README.md`
* `product-scope.md`
* `mvp-definition.md`
* `feature-priority.md`
* `release-roadmap.md`
* `../05-architecture/`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/DECISIONS.md`
