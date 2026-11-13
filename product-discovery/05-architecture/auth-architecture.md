# Auth Architecture

This document defines the **Security & Auth Architecture** for the **Postific** product — the authentication architecture, session management, workspace context resolution, and role-based authorization (RBAC).

This document is the reference for system security design and does not cover code implementation. Implementation details (Better Auth configuration, middleware code) are documented in Engineering Planning (M6).

---

# Purpose

* Define the authentication flow using Better Auth.
* Set the session structure and the data stored in the session.
* Define the workspace context resolution mechanism.
* Set the role-based authorization (RBAC) model and how it is enforced.
* Document the Middleware strategy for the auth guard.
* Define the route and API endpoint protection pattern.

---

# Pre-Architecture Decisions

The following decisions were set before this document was created and are the foundation of the Auth Architecture:

| Topic | Decision | Source |
|-------|-----------|--------|
| Auth Library | Better Auth | Pre-architecture decision |
| Auth Enforcement | Application-enforced as the main layer; RLS as defense-in-depth | ADR-015 |
| Identity BC | BC-01 Identity — managed by Better Auth, table prefix `identity_` | `domain-model.md` |
| Application Layer | Middleware for the auth guard and workspace context injection | ADR-016 |
| Roles | 3 roles: Account Owner, Admin, Creator | ADR-012, ADR-074, `roles-permissions.md` |
| Multi-tenancy Unit | `workspace_id` as the isolation unit | ADR-015 |

---

# Authentication

## Better Auth as Identity Provider

Better Auth manages the entire authentication lifecycle:
- Account registration (email + password).
- Login with email + password.
- OAuth login (Google — if added in Engineering Planning).
- Session lifecycle (create, refresh, destroy).
- Password reset via email.

**The internal domain does not implement authentication logic from scratch.** BC-01 Identity only exposes an interface that calls the Better Auth API.

## MVP Authentication Methods

| Method | MVP Status |
|--------|-----------|
| Email + Password | ✅ MVP |
| Google OAuth | ✅ MVP (via the Better Auth OAuth plugin) |
| Magic Link | Post-MVP |
| SSO/SAML | Post-MVP |

## Registration Flow

```
┌─────────┐    ┌──────────────────┐    ┌──────────────┐    ┌────────────┐
│  User   │    │  Next.js Server  │    │  Better Auth │    │  Database  │
│ Browser │    │  (Server Action) │    │              │    │ (Supabase) │
└────┬────┘    └────────┬─────────┘    └──────┬───────┘    └─────┬──────┘
     │                  │                      │                   │
     │  Submit form     │                      │                   │
     │─────────────────►│                      │                   │
     │                  │  auth.signUp()        │                   │
     │                  │─────────────────────►│                   │
     │                  │                      │  INSERT user       │
     │                  │                      │──────────────────►│
     │                  │                      │  INSERT session    │
     │                  │                      │──────────────────►│
     │                  │  Session cookie       │                   │
     │                  │◄─────────────────────│                   │
     │  Set-Cookie +    │                      │                   │
     │  Redirect        │                      │                   │
     │◄─────────────────│                      │                   │
```

**After registration:**
- No workspace exists yet — the user is directed to onboarding to create their first workspace.
- `WorkspaceService.createWorkspace()` is called with the `userId` from the session, and the user automatically becomes the Owner.

## Login Flow

```
User submits the login form
  └── Server Action
        └── Better Auth auth.signIn.email({ email, password })
              ├── Success → Set session cookie → Redirect to root (Middleware continues to resolve to `(app)` or `/onboarding`, see "Onboarding Flow")
              └── Failure → Return error to the form
```

## Session Cookie

Better Auth uses an **HTTP-only cookie** to store the session token.

| Property | Value |
|----------|-------|
| Cookie name | `better-auth.session_token` (Better Auth default) |
| HTTP-only | Yes |
| Secure | Yes (production) |
| SameSite | `lax` |
| Expiry | 7 days (configurable) |

**Note:** The session token is stored in a cookie, not in `localStorage` — preventing XSS attacks.

---

# Session Management

## Session Data Structure

Better Auth stores the session in the `identity_sessions` table. Data accessible from the active session:

```
Session {
  userId: string          -- User.id from Better Auth
  expiresAt: Date
  ipAddress: string?
  userAgent: string?
}
```

## Workspace Context

The Better Auth session **does not store** `workspaceId` directly. The workspace context is stored in a **cookie** (`active-workspace-id`, HTTP-only) and re-validated by Middleware against the member data on every request.

**Reasons:**
- A user can be a member of more than one workspace, but only 1 workspace is active at a time (`active-workspace-id`); the cookie acts as the marker of that active workspace.
- All workspace-scoped routes (Home, Publish, Engage, Analyze, Start Page, Settings) live under the `(app)` route group — the workspace context does not depend on the URL structure (`../06-engineering/monorepo-setup.md`).
- The cookie is still re-validated against `workspace_members` on every request (not trusted raw) — preventing a stale or manipulated cookie from granting access to the wrong workspace.
- If the cookie is missing or invalid (e.g. new browser, cookie deleted), the user is redirected back to the workspace picker in the onboarding flow (see "Onboarding Flow" below) — this is a *recovery* case, different from a deliberate switch (see "Deliberate Workspace Switch" below).

**Deliberate Workspace Switch (ADR-088, amendment to ADR-089):** as long as the cookie
is still valid, a user who is a member of more than one workspace can
deliberately switch the active workspace through Settings → Account →
Workspaces — the list of workspaces they belong to, the active workspace marked with
the chip "Aktif", other workspaces can be clicked to switch. Clicking a row first triggers
a Tier 2 confirmation dialog (`AlertDialog`, ADR-049 — "Pindah ke workspace
[nama]?" + Batal/Pindah, ADR-089); only after the user presses "Pindah"
does the switch mechanism run: (1) re-validate that the user really is a member of the
target workspace, (2) **directly overwrite** the `active-workspace-id` cookie
with the target workspace id (without a separate cookie-delete step), (3) redirect
to Home. This page also provides a "Buat Workspace Baru" button (a dialog
with a workspace name form, without the ADR-049 confirmation tier because it is non-destructive —
unlike the switch, which is now fenced by Tier 2 even though it is also non-destructive,
because a switch replaces the entire working context the user is viewing).
This is a different case from the `/onboarding` picker below — the switch is triggered
deliberately by a user who still has a valid cookie, not by a cookie that
was lost beyond their control. This scope is deliberately narrow: only switching between
existing memberships + creating an additional workspace; the broader "Multi Workspace
Management" (bulk actions, combined billing, etc.) stays
Out of Scope (`../02-product/mvp-definition.md`).

## Session Validation

Every request to a protected page or API passes through Middleware:

```
Request comes in
  └── Middleware
        ├── Get the session cookie
        ├── Call Better Auth auth.api.getSession({ headers })
        ├── If there is no session → redirect to /login
        ├── If the session is expired → redirect to /login
        └── If valid → inject userId into the request context → continue
```

---

# Workspace Context Resolution

## How It Works

The active workspace is resolved by Middleware from the `active-workspace-id` cookie, then validated that the user has access to that workspace.

```
Request to route (app)/*
  └── Middleware
        ├── Read the active-workspace-id cookie
        ├── If the cookie is missing → redirect to /onboarding (see "Onboarding Flow")
        ├── If present → Query: SELECT * FROM workspace_members
        │                       WHERE workspace_id = ?
        │                         AND user_id = session.userId
        ├── If not found (cookie invalid/workspace no longer a membership) → redirect to /onboarding
        ├── If found → inject { workspaceId, role } into the request headers
        └── The Application Service can read workspaceId from the headers
```

## Workspace Context in the Request

Middleware injects the workspace context as custom request headers:

```
x-workspace-id: {workspaceId}
x-workspace-role: {owner | admin | creator}
```

The Application Service and Server Actions read these headers to know the active workspace and the user's role without needing to query the database again.

**Security:** These headers **cannot be set by the client** — only Middleware writes these headers. Next.js Middleware runs on the server edge, not in the browser.

---

# Authorization (RBAC)

## Approach

The system uses **Role-Based Access Control (RBAC)** enforced at the **Application Service layer**.

**Enforcement position:**

```
Request (Server Action / Route Handler)
  └── Application Service
        ├── Read the role from the request context (header x-workspace-role)
        ├── Check: is this role allowed to perform this operation?
        ├── If not → throw AuthorizationError
        └── If yes → continue to domain logic
```

**Enforcement rules:**
- The authorization check is **mandatory** in the Application Service before domain logic is executed.
- Entry Points (Server Action, Route Handler) **must not** perform authorization checks on their own — delegate to the Application Service.
- RLS in Supabase is **defense-in-depth** — if the Application Service misses a check, RLS prevents access to data that should not be accessible.

## Role Hierarchy

```
Owner > Admin > Creator
```

Owner has all Admin permissions. Admin has more permissions than Creator (ADR-074 — the previous hierarchy was Owner > Admin > Manager > Creator, "Manager" was removed and its content operational rights were merged into Creator).

## Permission Matrix

Full reference: `../02-product/roles-permissions.md`

Summary of permissions per area relevant for enforcement in the Application Service:

| Operation | Account Owner | Admin | Creator |
|---------|-------|-------|---------|
| Delete workspace | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |
| Change billing | ✅ | ❌ | ❌ |
| Manage connected accounts | ✅ | ✅ | ❌ |
| Invite/remove members | ✅ | ✅ | ❌ |
| Publish / schedule posts | ✅ | ✅ | ✅ |
| Create / edit drafts | ✅ | ✅ | ✅ |
| Delete other people's content | ✅ | ✅ | ❌ |
| Read analytics | ✅ | ✅ | ✅ |
| Reply to engagement | ✅ | ✅ | ✅ |
| Read audit log | ✅ | ✅ | ❌ |

## Authorization Helper

The Application Service uses a helper function to validate permissions:

```
assertPermission(role: WorkspaceRole, operation: Operation): void
  ├── If the role is allowed → return (continue execution)
  └── If not → throw AuthorizationError("Insufficient permissions")
```

`AuthorizationError` is caught at the Entry Point and translated to HTTP 403 or a UI error message.

---

# Middleware Strategy

## Route Groups

Next.js Middleware manages two route zones:

```
Middleware matchers:
├── /login          → Public route (bypass auth)
├── /register       → Public route (bypass auth)  
├── /onboarding     → Protected route (session required, no workspace context — see "Onboarding Flow")
├── /u/*            → Public Start Page pages (bypass proxy, no session; data through a `SECURITY DEFINER` function) (ADR-128, ADR-142, ADR-143)
├── /api/webhooks/* → Webhook routes (bypass auth — protected via HMAC signature)
├── /api/jobs/*     → Job runner routes (bypass auth — protected via X-Job-Secret)
├── /api/mcp        → MCP Server endpoint (bypass proxy — token validated in the Route Handler via `mcpHandler`) (ADR-139)
├── /.well-known/*  → MCP OAuth metadata (bypass proxy) (ADR-139)
└── (app)/*         → Protected routes (session + workspace context from the cookie required)
    └── Home, Publish, Engage, Analyze, Start Page, Settings — all require a workspace membership check
```

## Middleware Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE FLOW                                │
│                                                                   │
│  Request comes in                                                 │
│      │                                                            │
│      ▼                                                            │
│  Public route? ──── Yes ──► Continue to handler                  │
│      │ No                                                         │
│      ▼                                                            │
│  Webhook / Job route? ── Yes ──► Continue (protected by secret)  │
│      │ No                                                         │
│      ▼                                                            │
│  Get the session cookie                                           │
│      │                                                            │
│      ├─ Missing / expired ──► Redirect /login                    │
│      │                                                            │
│      └─ Valid → Is the route in (app)/*?                          │
│                     │                                             │
│                     ├─ No (e.g. /onboarding) ──► Inject userId → Continue │
│                     │                                             │
│                     └─ Yes → Read the active-workspace-id cookie  │
│                                 │                                 │
│                                 ├─ Missing ──► Redirect /onboarding │
│                                 │                                 │
│                                 └─ Present → Query workspace membership │
│                                             │                     │
│                                             ├─ No access → Redirect /onboarding │
│                                             │                     │
│                                             └─ Has access → Inject headers → Continue │
└──────────────────────────────────────────────────────────────────┘
```

---

# API Route Protection

## Route Handlers for External Systems

Route Handlers that receive requests from external systems (webhook, job runner) do not go through session auth. They are protected by a different mechanism:

| Route | Protection Mechanism |
|-------|-------------------|
| `/api/webhooks/outstand` | HMAC-SHA256 over the raw body, durable idempotent receipt before ACK (ADR-020, ADR-040) |
| `/api/jobs/run` | `X-Job-Secret` header secret compared with an env variable |
| `/api/integrations/outstand/callback` | CSRF protection via the `state` parameter (ADR-021) |

## Internal API Route

A Route Handler called from Client Components must:
1. Be protected by Middleware (session check).
2. Check workspace membership if it relates to workspace data.

**External secret boundary:**
- `OUTSTAND_WEBHOOK_SECRET` and the Outstand API key are only available server-side.
- Twitter/X BYOK credentials are configured manually by the Project Owner in the Outstand dashboard. The application provides no form, endpoint, table, or env var for the X Client ID/Client Secret.

---

# Row-Level Security (Defense-in-Depth)

RLS does not replace authorization in the Application Service — RLS is an **additional security layer** if the Application Service fails to perform the check.

**Example RLS policy for workspace data:**

```sql
-- A user can only read data of workspaces they belong to
CREATE POLICY "workspace_member_access"
ON publishing_posts
FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
```

**Note:** The RLS policy uses `auth.uid()` from the Better Auth session — the Supabase Better Auth integration must be configured so that `auth.uid()` returns the correct userId. Configuration details are in Engineering Planning (M6).

---

# Auth Error Handling

| Scenario | Response |
|----------|---------|
| No session | Redirect to `/login` (via Middleware) |
| Session expired | Redirect to `/login` (via Middleware) |
| User has no access to the workspace (cookie invalid/workspace no longer a membership) | Redirect to `/onboarding` |
| Insufficient role for the operation | `AuthorizationError` → UI error message / HTTP 403 |
| RLS violation | Supabase returns an empty result or an error — the Application Service handles it as not found |

---

# Onboarding Flow (First Login & Cookie Re-entry)

`/onboarding` handles two scenarios — a new user without a workspace, and an existing user who lost the active workspace cookie (new browser, cookie deleted, etc.). The workspace picker in the second scenario is the re-entry point when the cookie is lost beyond the user's control — **different** from the Deliberate Workspace Switch (ADR-088, see the "Workspace Context" section above), which is triggered deliberately by the user while the cookie is still valid, through Settings → Account → Workspaces.

```
Login succeeds / Middleware redirects to /onboarding (active-workspace-id cookie missing/invalid)
  └── /onboarding
        ├── Query: workspaces the user belongs to (workspace_members WHERE user_id = session.userId)
        │
        ├── 0 workspaces → The user creates their first workspace
        │     └── WorkspaceService.createWorkspace()
        │           ├── Create a new Workspace
        │           ├── Create a WorkspaceMember (userId, role: owner)
        │           ├── Set the active-workspace-id cookie
        │           └── Redirect to (app) home
        │
        └── ≥1 workspace (cookie lost, not a new user) → Show the workspace list picker
              └── The user picks one
                    ├── Set the active-workspace-id cookie
                    └── Redirect to (app) home
```

---

# Post-MVP Considerations

| Feature | Complexity | Priority |
|-------|-------------|-----------|
| Multi-workspace switching (deliberate switch between memberships + creating an additional workspace are already in the MVP per ADR-088 — the rest such as cross-workspace bulk actions, combined billing, shared views stay here) | Medium | High |
| Magic Link login | Low | Medium |
| SSO/SAML | High | Low (enterprise) |
| Two-Factor Authentication (2FA) | Medium | Medium |
| Audit log for auth events | Low | Medium |
| API key for programmatic access (machine-to-machine, not interactive user login — different from the mobile Bearer plugin ADR-043) | Medium | Low |

---

# Decision Log

| ID | Decision | Reason |
|----|-----------|--------|
| AU-D01 | Better Auth as the auth library | Already set as a pre-architecture decision; avoids implementing auth from scratch |
| AU-D02 | HTTP-only cookie for the session token | Prevents XSS attacks; the session cannot be accessed by JavaScript in the browser |
| AU-D03 | Workspace context stored in the `active-workspace-id` cookie, re-validated by Middleware against `workspace_members` on every request | The cookie is not trusted raw — it is still validated against the database so it cannot go stale or be manipulated; cookie lost → re-entry via the onboarding picker; deliberate switch between memberships → Tier 2 confirmation dialog then direct cookie overwrite via Settings → Account → Workspaces (ADR-088, amendment to ADR-089) |
| AU-D04 | Inject workspace context via custom request headers | Lets the Application Service read the context without re-querying the database; cannot be manipulated by the client |
| AU-D05 | Authorization check at the Application Service layer | Aligned with DDD — the domain service knows the business rules; Entry Points stay thin |
| AU-D06 | RLS as defense-in-depth, not primary enforcement | Application-enforced is more flexible and testable; RLS as a safety net if there is a bug in the upper layer |
| AU-D07 | Email + Password + Google OAuth for the MVP | Sufficient for the target user (professional teams); Magic Link and SSO considered post-MVP |
| AU-D08 | HMAC webhook verified over the raw body and a durable receipt before ACK | Preserves authenticity while preventing event loss |
| AU-D09 | The X BYOK secret lives in the Outstand dashboard, not the application | Reduces platform secret exposure and aligns with ADR-040 |
| AU-D10 | ADR-040 | AU-D08–D09 amend the integration protection boundary |
| AU-D11 | Better Auth Bearer plugin as the mobile client auth mechanism, on top of the `/api/v1` Route Handler (ADR-043) | Server Actions are not stable across builds for external clients; Bearer keeps RBAC in the Application Service (AU-D05) without a second mobile-specific authorization path |

---

# Related Documents

* `domain-model.md` — BC-01 Identity, BC-02 Workspace, WorkspaceMember entity
* `database-strategy.md` — `identity_*` tables (Better Auth), `workspace_members`
* `application-layer.md` — Middleware strategy and Application Service authorization pattern
* `../02-product/roles-permissions.md` — Full permission matrix per role
* `realtime-strategy.md` — The session is required before a Supabase Realtime subscription
* `../06-engineering/auth-strategy.md` — Better Auth Bearer plugin configuration for mobile (AS-D06)
* `../../project-os/DECISIONS.md` — ADR-024, ADR-043
