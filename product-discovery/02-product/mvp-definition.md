# MVP Definition

This document defines the scope of the **Minimum Viable Product (MVP)** for the **Postific** product.

The MVP is the first version of the product that has real value for users and is able to validate business and product assumptions.

This document is the main reference for determining development priorities before the product enters the release stage.

---

# Overview

The goal of the MVP is not to deliver all planned features, but to provide the core capabilities that let target users do their main work effectively.

Every feature that enters the MVP must contribute directly to validating Product-Market Fit.

---

# MVP Goals

The MVP must be able to prove that:

* The product solves the users' main problem.
* The designed workflow can be used in real work.
* Target users get value from using the product.
* Users are willing to use the product repeatedly.

---

# Must Have

The following capabilities must be available in the MVP.

## Workspace

* Create a Workspace.
* Manage team members.
* Connect social media accounts to the Workspace.

---

## Publishing

* Create content drafts.
* Choose the **content type/format per target account** according to platform and Outstand capabilities (ADR-039):
  * Instagram & Facebook: **Post / Reel / Story**
  * TikTok: video/feed posting (no Reel/Story selector in the UI)
  * Pinterest: **Pin** (title, destination link, board)
  * Other supported platforms: `post` format as the default
* Schedule posts.
* Publish content directly without scheduling (**Publish Now**) —
  limited to the same roles as Schedule: Account Owner, Admin, Creator
  (all roles can, since the role structure reduction in ADR-074), see
  `roles-permissions.md` (ADR-047).
* View the publishing calendar.
* Manage the post queue.
* View publishing history.

---

## Analytics

* Basic performance dashboard.
* Post statistics.
* Engagement summary.

---

## Engagement

* View comments from connected accounts.
* Reply to comments from inside the app.
* Simple comments inbox.
* Periodic comment sync every 30 minutes.
* Manual refresh to fetch the latest comments when needed.

Post-MVP improvements (Should Have, ADR-157): comment status (Belum dibalas, Dibalas, Selesai, Diabaikan) and grouping comments by post.

Direct Messages, mentions, and engagement webhooks are not part of the MVP (ADR-040).

---

## MCP Server

Postific does not build its own AI. The user's own AI works inside the
app through MCP (ADR-138).

* Connect an AI client through OAuth, bound to one workspace per connection.
* Permission scopes: `read`, `draft`, `schedule`. Default: `read` + `draft`.
* Read accounts, media, drafts, queue, history, analytics, and comments.
* Create and edit drafts, upload media from a URL.
* Schedule posts (batch several pieces of content per call).
* Revoke an AI client connection from Settings.
* Call audit, the "dibuat lewat MCP" source marker (badge and filter in History,
  Drafts, and Queue), and rate limit per workspace.

Not part of the MVP: Publish Now through MCP, reply to comments through MCP, and
destructive/administrative actions (delete, cancel schedule, manage members,
disconnect accounts).

---

## Start Page

* Create a public page.
* Manage the list of links.
* Share the page URL.

---

# Should Have

Features that give extra value but are not a main requirement of the MVP.

* Media Library.
* Brand Assets.
* Content Templates.
* Saved Captions.
* Tone Rewrite (done by the client AI through MCP, not a Postific feature).
* Basic Notifications.
* Workspace Branding.

---

# Could Have

Features that can be developed if time and resources allow.

* AI Content Calendar (done by the client AI through MCP, not a Postific feature).
* Team Activity Feed.
* Custom Reports.
* AI Insights (done by the client AI through MCP, not a Postific feature).
* AI Performance Suggestions (done by the client AI through MCP, not a Postific feature).
* Hashtag Suggestions.

---

# Out of Scope

The following features are not part of the MVP.

* White Label.
* Mobile Application.
* Browser Extension.
* Marketplace.
* Public API.
* Plugin System.
* Enterprise SSO.
* Advanced Workflow Automation.
* Approval Workflow (a layered gate that locks Schedule/Publish until
  another role approves) — explicitly rejected by UXP-06 (`04-ux/ux-principles.md`)
  and confirmed by King Rezi (documentation audit, 2026-08-28): all roles
  (including Creator) remain free to publish on their own, see
  `roles-permissions.md`. Content status (`In Review`/`Ready to Schedule`)
  remains as a lightweight coordination label — not a gate — and that still
  stays in Must Have.
* Social Listening.
* Direct Messages and mentions in the Engagement Inbox.
* Engagement webhooks.
* Multi Workspace Management — **partly in the MVP per ADR-088**: switching the
  active workspace among memberships the user already has, and
  creating an additional workspace, both through Settings → Account →
  Workspaces. The rest (cross-workspace bulk actions, combined billing,
  shared views across workspaces, and the like) remains Out of Scope.

---

# MVP Success Criteria

The MVP is considered successful when users are able to:

* Connect social media accounts.
* Create content.
* Schedule publishing.
* Publish.
* View publishing results.
* Manage social media activity without depending on many other apps.

---

# Decision Rules

A feature can enter the MVP only if it:

* Supports the main goal of the product.
* Solves the users' main problem.
* Is needed by the primary target market.
* Does not add unnecessary complexity.
* Helps validate Product-Market Fit.

If a feature does not meet these criteria, it must be considered for inclusion in a later phase.

---

# Related Documents

* `README.md`
* `product-scope.md`
* `feature-modules.md`
* `feature-priority.md`
* `release-roadmap.md`
* `../01-business/product-vision.md`
* `../01-business/problem-statement.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/DECISIONS.md`
