# Roles & Permissions

This document defines the role and access rights system in the **Postific** product.

Each role represents a real responsibility in a team, not just a technical abstraction. This document is the mandatory reference for UX Planning, System Architecture, and Engineering Planning — especially when defining collaboration flows, content visibility, and feature access control.

This document is an **addendum to Product Baseline v1.0** (ADR-012), revised by **ADR-074**, which reduced the role structure from 4 to 3.

---

# Overview

The product supports team collaboration within a single Workspace. Each member has one role that determines what they can see, create, and do.

This roles approach follows the principle of **visibility without bureaucracy** (UXP-06): every team member can see the status of work, but access control is designed to be proportional to the MVP's coordination needs — not layered workflow enforcement.

The product has **3 roles**: Account Owner, Admin, Creator (ADR-074 — previously 4 roles, with an extra "Manager" role that was removed because its operational responsibilities were merged into Creator).

---

# Roles

## Account Owner

The workspace owner. This role is held by the person who registers the workspace on the platform — usually the team lead, founder, or account lead.

**Characteristics:**
- There is only one Account Owner per workspace.
- The Account Owner cannot be removed by an Admin or another Member.
- Ownership can be transferred to another Admin — a **two-step** process: the Account Owner
  triggers the transfer, and the target Admin must accept it (`acceptOwnershipTransfer`)
  before the roles actually swap; it is not a direct one-sided swap
  (ADR-050).

**Access Rights:**

| Area | Access Rights |
| ---- | ------------- |
| Organization Settings | Read, change, delete workspace |
| Billing & Subscription | Full (upgrade, downgrade, cancel) |
| Connected Accounts | Add, remove, manage all social media accounts |
| Members | Invite, remove, change the role of all members |
| Brand Settings | Read and change |
| Content | Create, edit, delete, schedule, publish all content |
| Start Page | Full management (profile, links, theme, publish/unpublish, view analytics) — ADR-144 |
| Analytics | Full access |
| Engagement (Comments Inbox) | Read, reply to, and handle (Resolve, Dismiss, Buka kembali) all comments |
| Audit Logs | Read |
| Transfer Ownership | Yes |

---

## Admin

The Admin is trusted by the Account Owner. This role suits a senior manager or a second-in-command who needs to run workspace operations fully, without the right to delete the workspace or transfer ownership.

**Characteristics:**
- A workspace can have more than one Admin.
- An Admin cannot change the Account Owner's role or remove the Account Owner from the workspace.

**Access Rights:**

| Area | Access Rights |
| ---- | ------------- |
| Organization Settings | Read and change (cannot delete workspace) |
| Billing & Subscription | Read (cannot change plan) |
| Connected Accounts | Add, remove, manage all social media accounts |
| Members | Invite, remove, change role (except the Account Owner role) |
| Brand Settings | Read and change |
| Content | Create, edit, delete, schedule, publish all content |
| Start Page | Full management (profile, links, theme, publish/unpublish, view analytics) — ADR-144 |
| Analytics | Full access |
| Engagement (Comments Inbox) | Read, reply to, and handle (Resolve, Dismiss, Buka kembali) all comments |
| Audit Logs | Read |
| Transfer Ownership | No |

---

## Creator

The Creator is a content operator — covering draft creation **and** schedule/publish execution, without workspace administration access. This role suits a Content Creator, a daily Social Media Manager, a Copywriter, or a Social Media Specialist who is fully responsible for the content cycle from draft to live.

**Characteristics:**
- A workspace can have more than one Creator.
- A Creator can see **all** content in the workspace (not just their own) — needed to run the team's schedule and queue effectively.
- A Creator can create, edit, schedule, and publish content (including **Publish Now**, ADR-047) — no longer limited to their own content only, as in the previous role structure.
- A Creator has no access to Members, Billing, Organization Settings, or Audit Logs.

**Access Rights:**

| Area | Access Rights |
| ---- | ------------- |
| Organization Settings | No access |
| Billing & Subscription | No access |
| Connected Accounts | Read only (see the available accounts) |
| Members | No access |
| Brand Settings | Read only |
| Content | Create, edit, delete, schedule, publish all content |
| Start Page | Full management (profile, links, theme, publish/unpublish, view analytics) — ADR-144 |
| Analytics | Full read |
| Engagement (Comments Inbox) | Read, reply to, and handle (Resolve, Dismiss, Buka kembali) all comments |
| Audit Logs | No access |
| Transfer Ownership | No |

---

# Permissions Summary by Role

| Capability | Account Owner | Admin | Creator |
| ---------- | ------------- | ----- | ------- |
| Delete workspace (Tier 1 confirmation required, ADR-049) | ✅ | ❌ | ❌ |
| Transfer ownership (Tier 1 confirmation required, ADR-049) | ✅ | ❌ | ❌ |
| Manage billing | ✅ | 👁 | ❌ |
| Manage Organization Settings | ✅ | ✅ | ❌ |
| Invite/remove members (removal requires Tier 2 confirmation, ADR-049) | ✅ | ✅ | ❌ |
| Change member role (Tier 2 confirmation required, ADR-049) | ✅ | ✅ (except Account Owner) | ❌ |
| Add/remove connected accounts (removal must go through Disconnect Confirmation, ADR-048) | ✅ | ✅ | ❌ |
| Create/edit content | ✅ | ✅ | ✅ |
| Schedule/publish content (including Publish Now, ADR-047) | ✅ | ✅ | ✅ |
| Full Analytics access | ✅ | ✅ | ✅ |
| Manage Engagement Comments Inbox | ✅ | ✅ | ✅ |
| Manage Start Page (profile, links, theme, publish/unpublish; ADR-144) | ✅ | ✅ | ✅ |
| Read Audit Logs | ✅ | ✅ | ❌ |

**Legend:** ✅ Yes &nbsp; ❌ No &nbsp; 👁 Read only

---

# Content Status — Canonical Set

Below is the list of content statuses that apply across the whole product. This set is the **only canonical status reference** — all UX and implementation documents must refer to this list.

| Status | Description |
| ------ | ----------- |
| `Draft` | Content is being created or edited. Not yet ready for review or scheduling. |
| `In Review` | The Creator has marked the content as ready for review. Waiting for confirmation from the Admin/Account Owner (optional — can be skipped). |
| `Ready to Schedule` | The content has been approved informally. Ready to be scheduled. |
| `Scheduled` | The content has a publish time. The system will publish it automatically. |
| `Published` | The content has been successfully published to the social media platform. |
| `Failed` | The content failed to publish. Requires manual action to fix or reschedule. |

**Important note:** `In Review` and `Ready to Schedule` are lightweight coordination statuses — not enforcement of a layered approval workflow (UXP-06). Because the Creator can now schedule on their own, anyone (Account Owner/Admin/Creator) can skip `In Review`/`Ready to Schedule` and schedule content directly from `Draft` if the team context allows it.

---

# Status Transition Rules by Role

The following table defines who can trigger each content status transition.

| Transition | Account Owner | Admin | Creator | System |
| ---------- | ------------- | ----- | ------- | ------ |
| (new) → `Draft` | ✅ | ✅ | ✅ | — |
| `Draft` → `In Review` | ✅ | ✅ | ✅ | — |
| `In Review` → `Draft` | ✅ | ✅ | ✅ | — |
| `In Review` → `Ready to Schedule` | ✅ | ✅ | ✅ | — |
| `Ready to Schedule` → `Scheduled` | ✅ | ✅ | ✅ | — |
| `Draft` → `Scheduled` (skip review) | ✅ | ✅ | ✅ | — |
| `Draft` → `Published` (**Publish Now**, skip schedule) | ✅ | ✅ | ✅ | — |
| `Scheduled` → `Draft` (pull the schedule) | ✅ | ✅ | ✅ | — |
| `Scheduled` → `Published` | — | — | — | ✅ automatic |
| `Scheduled` → `Failed` | — | — | — | ✅ automatic |
| `Failed` → `Draft` | ✅ | ✅ | ✅ | — |

**Notes:**
- All transitions that require a specific role require logging in with that role — not a manual check.
- All roles (Account Owner, Admin, Creator) have the same rights for content status transitions — there is no longer a role limited to only "In Review" as in the previous 4-role structure.
- The `Scheduled → Published` and `Scheduled → Failed` transitions are fully automatic by the system — no user action is needed.
- **Publish Now (ADR-047):** `Draft → Published` directly (skipping `In Review`/`Ready to Schedule`/`Scheduled`) is limited to the **exact same** roles as Schedule (Account Owner/Admin/Creator) — not a new, stricter access level. This is consistent with the "Schedule/publish content" row in the permissions summary table above. Publish Now is riskier than Schedule (goes live immediately, with no `cancelSchedule` window for correction), so the UI must show an explicit confirmation before execution (in line with UXP-06).

---

# Mapping to Personas

This document is traceable to User Discovery Baseline v1.0 through the following persona mapping.

| Persona | Role on the Platform | Notes |
| ------- | -------------------- | ----- |
| Maya — Marketing Manager | Admin or Account Owner | Buyer; high visibility, rarely creates content directly |
| Raka — Social Media Manager | Creator | Primary daily user; publishing and queue operator — the Creator role now includes the schedule/publish rights that used to be in the Manager role |
| Sinta — Content Creator | Creator | Focused on creating drafts; can now also schedule on their own if the team workflow allows |
| Dimas — Startup Growth Lead | Account Owner | Solo/small team; likely holds all roles |
| Lara — Agency Social Lead | Admin or Creator | Multi-account oversight; small team coordination |

---

# Decision Rules

1. If the roles structure needs to change (for example: adding a new role), discuss it and create a new ADR.
2. The canonical status set must not be changed without an ADR. All UX documents that refer to statuses must be updated together.
3. This document is the reference for database design (the `members`, `roles`, `content_posts` tables) in the Architecture phase.
4. Do not implement a layered "Approval Workflow" — this is not MVP (see `mvp-definition.md`: Approval Workflow is in *Could Have*, not *Must Have*).

---

# Related Documents

* `README.md`
* `feature-modules.md` — the Workspace module defines Roles & Permissions as responsibilities
* `mvp-definition.md` — the MVP scope includes Workspace management
* `feature-priority.md`
* `../03-user/user-personas.md` — persona-to-role mapping
* `../04-ux/ux-principles.md` — UXP-06 — Clear Status, Light Process
* `../04-ux/information-architecture.md`
* `../04-ux/user-flows.md`
* `../04-ux/key-screen-patterns.md`
* `../../project-os/DECISIONS.md` — ADR-008 (Product Baseline), ADR-012 (this addendum), ADR-047 (Publish Now), ADR-048 (Disconnect Confirmation), ADR-049 (Safety Check / Double Confirmation), ADR-050 (Transfer Ownership & Delete Workspace), ADR-074 (reduction from 4 roles to 3 roles, resolution of KI-017)
