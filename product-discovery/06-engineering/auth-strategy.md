# Authentication Strategy

This document defines the **authentication implementation configuration** for the Postific product: the Better Auth setup, providers, session structure, cookie configuration, Supabase JWT integration for Realtime, and per-environment configuration.

This document is the concrete implementation of the **Auth Architecture** (`../05-architecture/auth-architecture.md`, ADR-024). The security design decisions (RBAC in the Application Service, Middleware workspace resolution, RLS defense-in-depth) are already set there and are **not decided again** here — this document focuses on technical configuration details.

---

# Goals

- Define the Better Auth instance configuration definitively.
- Set the MVP authentication providers and their configuration (email/password, Google OAuth).
- Set the structure and attributes of the session cookie.
- Define the Better Auth ↔ Supabase integration so `auth.uid()` is available to Supabase Realtime (dual-context RLS).
- Set the auth configuration per environment (production vs staging).
- Set the external dependencies required (transactional email for password reset).

---

# Locked Decisions (from Baseline)

The following decisions are final from the Auth Architecture (ADR-024) and are inputs to this document:

| Topic             | Decision                                                                                         | Source                |
| ----------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| Auth Library      | Better Auth                                                                                      | ADR-024, AU-D01       |
| MVP Methods       | Email + Password, Google OAuth                                                                   | AU-D07                |
| Session Token     | HTTP-only cookie                                                                                 | AU-D02                |
| Session Expiry    | 7 days                                                                                           | `auth-architecture.md` |
| SameSite          | `lax`                                                                                            | `auth-architecture.md` |
| Authorization     | RBAC in the Application Service (3 roles, ADR-074)                                               | AU-D05                |
| Workspace Context | Resolved from the cookie (not the URL slug) — its membership is validated by `src/proxy.ts`      | AU-D03, AU-D04        |
| RLS               | Defense-in-depth, not primary enforcement                                                        | AU-D06, DB-D05        |
| Identity Tables   | `identity_` prefix, managed by Better Auth                                                       | DB-D04                |

---

# Auth Strategy Decisions (Set in This Document)

| ID     | Topic                  | Decision                                                                                                                                                                                                                                                     |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AS-D01 | Better Auth Database   | Better Auth stores auth data in the same Supabase PostgreSQL, tables with the `identity_` prefix, accessed via the Prisma adapter + `DATABASE_URL` (pooled; see `database-orm.md`)                                                                            |
| AS-D02 | Session Strategy       | Database session (not JWT-only) — an opaque token in the cookie, the session validated against the `identity_sessions` table                                                                                                                                 |
| AS-D03 | Supabase Realtime Auth | Better Auth issues a Supabase-compatible JWT (HS256, signed with `SUPABASE_JWT_SECRET`) containing `sub = userId` so `auth.uid()` is valid for Realtime RLS                                                                                                   |
| AS-D04 | Password Reset         | Via a Better Auth email token — provider **Resend** (ADR-126). Actual sending is still T-005.3                                                                                                                                                               |
| AS-D05 | Google OAuth Redirect  | Callback per environment: `{BETTER_AUTH_URL}/api/auth/callback/google` — a different URL for production & staging                                                                                                                                            |
| AS-D06 | Mobile Auth            | Better Auth **Bearer plugin** for `/api/v1` (ADR-043) — `Authorization: Bearer <token>` replaces the cookie session for mobile requests; one Better Auth instance & one session table shared with the web                                                    |

---

# Better Auth Configuration

The Better Auth instance is defined in `apps/web/src/lib/better-auth/auth.ts` (see `monorepo-setup.md`).

## Configuration Structure

```typescript
// apps/web/src/lib/better-auth/auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  // Connection to Supabase PostgreSQL via Prisma (AS-D01, DO-D05)
  database: {
    // Better Auth Prisma adapter — pooled DATABASE_URL (Supavisor)
    // details: database-orm.md
  },

  // Base URL differs per environment (AS-D05)
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // Email + Password (AU-D07)
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // email verification at registration
    // sendResetPassword: Resend (ADR-126); wiring is still T-005.3
  },

  // Google OAuth (AU-D07)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // Session: 7 days (auth-architecture.md)
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // extend if < 1 day remains
  },

  // Cookie attributes (AU-D02) — Secure follows the environment (see the table below)
  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: process.env.NODE_ENV === "production", // true on staging/prod (HTTPS); false on local HTTP
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
});
```

> The configuration above is a structural reference, not final code. The Prisma adapter and the `identity_*` models are finalized during Repository & Bootstrap (M7) following `database-orm.md` (DO-D05).
>
> **Cookie `Secure` per tier** (aligned with `environment-management.md`): local (`bun run dev`, HTTP `localhost`) → `secure: false` / `useSecureCookies: false`; staging & production (Railway HTTPS, `NODE_ENV=production`) → `true`. The M7 implementation may use explicit detection other than `NODE_ENV` as long as the result per tier is the same.

---

# Authentication Providers & Methods

## Email + Password

| Aspect             | Configuration                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Registration       | Email + password via a Server Action → `auth.api.signUpEmail()`                                                                       |
| Email verification | Required (`requireEmailVerification: true`) — provider Resend (ADR-126). Actual sending is still T-005.3; this flag is enabled in T-005.5 |
| Login              | `auth.api.signInEmail()`                                                                                                              |
| Password reset     | Token via email (AS-D04)                                                                                                              |
| Password hashing   | Managed by Better Auth (scrypt default) — not implemented manually                                                                    |

## Google OAuth

| Aspect                | Configuration                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Client ID/Secret      | Env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                              |
| Redirect URI          | `{BETTER_AUTH_URL}/api/auth/callback/google`                                                     |
| Scope                 | `email`, `profile` (default)                                                                     |
| Separate account per env | A separate Google OAuth client for production & staging is recommended (different redirect URIs) |

**Redirect URIs to register in the Google Cloud Console:**

```
Production : https://<production-domain>/api/auth/callback/google
Staging    : https://staging.<domain>/api/auth/callback/google
```

---

# Mobile Auth — Bearer Plugin (AS-D06, ADR-043)

The mobile client (iOS/Android, implemented after the web MVP is done)
accesses `/api/v1/...` (`application-layer.md` — "Route Handler v1 — Mobile
Client") using the **Better Auth Bearer plugin**, not a cookie session.

## Configuration Structure (Additional)

```typescript
// apps/web/src/lib/better-auth/auth.ts
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";

export const auth = betterAuth({
  // ...base configuration stays the same (see "Configuration Structure" above)

  plugins: [
    bearer(), // Authorization: Bearer <token> for the /api/v1 mobile client
  ],

  // The mobile custom scheme must be registered explicitly — not a loose wildcard
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    // example Expo dev client — adjust to the actual mobile app scheme:
    // "exp://192.168.*.*:*/*",
  ],

  rateLimit: {
    enabled: true,
    customRules: {
      "/api/auth/sign-in/email": { window: 60, max: 5 },
      "/api/auth/sign-up/email": { window: 60, max: 3 },
    },
  },
});
```

## Rules

| Aspect                    | Decision                                                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanism                 | `Authorization: Bearer <token>` — an opaque token, validated against the same `identity_sessions` table as the web (AS-D02 is unchanged)                                                                                                                  |
| Token storage on device   | Must be Keychain (iOS) / Keystore or EncryptedSharedPreferences (Android) — **must not** be in plain storage without encryption. A requirement for the mobile team, not backend configuration, but it must be recorded as a release condition              |
| Workspace context         | There is no "active workspace" cookie like the web Middleware — `workspaceId` must be explicit in the path/header of every request; authorization stays in the Application Service (AU-D05, no shortcut for mobile)                                         |
| `trustedOrigins`          | The mobile custom scheme (e.g. Expo `exp://...`) is registered explicitly per app, with no loose wildcard that could accept an unknown origin                                                                                                             |
| Auth endpoint rate limit  | `customRules` tightens `/api/auth/sign-in/email` and `/api/auth/sign-up/email` from the general default — `/api/v1` widens the attack surface that was previously more hidden behind Server Actions                                                        |
| Mobile session expiry     | Follows the 7-day default (same as the web) unless decided otherwise at implementation — a lost/stolen physical device is a real risk for long-lived sessions, re-evaluate before the first mobile endpoint release                                         |
| CORS                      | Not enabled for this need — CORS is a browser mechanism, irrelevant for a native HTTP client using a Bearer token                                                                                                                                         |
| CSRF                      | Not relevant for Bearer-only endpoints — a Bearer token is not auto-attached like a cookie, so it is free of the class of CSRF attacks that applies to cookie-based endpoints                                                                              |
| Audit trail               | `databaseHooks.session.create`/`delete` can be used to record the device/IP when a mobile session is created/revoked — the same pattern can be used for auditing auth events in general                                                                    |

---

# Session Management

## Session Strategy (AS-D02)

Better Auth uses a **database session** — an opaque token stored in the cookie, and every validation checks the `identity_sessions` table. This is chosen (rather than stateless-only JWT) so sessions can be **revoked** (logout, remove device) and to be consistent with `auth-architecture.md`.

## Cookie Attributes

| Property | Value                                                          | Reason                                                                                                                                        |
| -------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Name     | `better-auth.session_token`                                    | Better Auth default                                                                                                                           |
| HttpOnly | `true`                                                         | Prevents access via JavaScript (anti-XSS) — AU-D02                                                                                            |
| Secure   | `false` (local HTTP); `true` (staging & production HTTPS)      | Local uses `http://localhost`; staging/prod use Railway TLS — `environment-management.md`, `deployment-infrastructure.md`                     |
| SameSite | `lax`                                                          | Balances CSRF protection and OAuth redirect UX                                                                                                |
| Expiry   | 7 days                                                         | `auth-architecture.md`                                                                                                                        |
| Path     | `/`                                                            | Applies to the whole application                                                                                                              |

## Session Validation

The validation flow is unchanged from `auth-architecture.md`: the Middleware calls `auth.api.getSession({ headers })` on every protected request, redirecting to `/login` if absent/expired. This document only sets the configuration that supports that flow.

---

# Better Auth ↔ Supabase Integration (Dual-Context RLS)

This is the M6 detail referred to by `auth-architecture.md` and ARCH-REVIEW-02 (`database-strategy.md`, `realtime-strategy.md`). There are **two contexts** of data access with different identity mechanisms:

```
┌───────────────────────────────────────────────────────────────┐
│  CONTEXT 1 — Server-side (most data access)                     │
│                                                                  │
│  Next.js Server (Server Component / Action / Route Handler)      │
│    → Prisma Client (domain CRUD — ADR-031)                       │
│    → SET LOCAL app.current_user_id = '{userId}' (via Prisma)     │
│    → RLS checks current_setting('app.current_user_id')           │
│                                                                  │
│  Identity comes from: Better Auth session (opaque token)         │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  CONTEXT 2 — Supabase Realtime (in-app notifications, client-side) │
│                                                                  │
│  Browser client → Supabase Realtime (WebSocket)                  │
│    → requires a JWT recognized by Supabase (auth.uid())          │
│    → subscription RLS checks auth.uid() = user_id                │
│                                                                  │
│  Identity comes from: Supabase-compatible JWT from Better Auth   │
└───────────────────────────────────────────────────────────────┘
```

## Context 2 Mechanism (AS-D03)

Because Better Auth does **not** use Supabase Auth (DB-D05, `database-strategy.md`), `auth.uid()` is not automatically available. For the Realtime path:

1. The server issues an **HS256 JWT** signed with `SUPABASE_JWT_SECRET` (the Supabase project's secret).
2. The JWT payload contains at minimum `sub = userId` (and `role`, `exp`) — compatible with the Supabase convention so `auth.uid()` returns `userId`.
3. This JWT is generated on demand for the client (e.g. via a protected endpoint) and handed to the Supabase Realtime client (`supabase.realtime.setAuth(token)`).
4. The subscription RLS on the `notifications` table uses `auth.uid() = user_id` (`realtime-strategy.md`).

**Important limitation:** This JWT is **only** for authorizing Realtime channels, not a replacement for the session cookie. All mutations and main data reads still go through Context 1 (Prisma + `app.current_user_id`). The Supabase service role key stays on the server only for Storage (and other platform operations that need it) — never exposed to the browser.

---

# Configuration per Environment

Aligned with `deployment-infrastructure.md` (separate Supabase projects, DI-D03):

| Env Var                        | Production                    | Staging                    |
| ------------------------------ | ----------------------------- | -------------------------- |
| `BETTER_AUTH_URL`              | `https://<production-domain>` | `https://staging.<domain>` |
| `BETTER_AUTH_SECRET`           | Production secret (unique)    | Staging secret (unique)    |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Production OAuth client       | Staging OAuth client       |
| `DATABASE_URL`                 | Prod Supabase project         | Staging Supabase project   |
| `SUPABASE_JWT_SECRET`          | Prod project JWT secret       | Staging project JWT secret |

- Staging & production: `useSecureCookies: true` (HTTPS). Local: `useSecureCookies: false` (HTTP `localhost`) — aligned with the tier catalog in `environment-management.md`.
- Cookies are scoped to each environment's own domain — no session sharing between staging and production (local is separate too).
- Details of naming and managing all env vars are in `environment-management.md`.

---

# Transactional Email (AS-D04)

Registration email verification and password reset use **Resend** (ADR-126, 2026-10-14). The same env as member invitations: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (already used by T-110 and T-007.7).

**Decision status:** locked. **Implementation status:** the env catalog is already in `environment-management.md` (T-005.2). `sendResetPassword` and Better Auth email verification are still stubbed / disabled until T-005.3–T-005.5.

---

# Security Considerations

| Aspect                  | Handling                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                     | Session token is HttpOnly — cannot be read by JavaScript (AU-D02)                                                                                                                                                                      |
| CSRF                    | SameSite=lax + Better Auth's built-in CSRF protection                                                                                                                                                                                  |
| Service role key        | Only on the server (env var), never sent to the browser                                                                                                                                                                                |
| Supabase JWT (Realtime) | Short-lived, minimal scope (`sub`, `role`, `exp`), only for Realtime channels                                                                                                                                                          |
| Secret rotation         | `BETTER_AUTH_SECRET` and `SUPABASE_JWT_SECRET` can be rotated per environment without affecting other environments (DI-D03)                                                                                                            |
| Brute force             | Better Auth rate limiting with explicit `customRules` per sensitive endpoint (`sign-in`, `sign-up`) — see "Mobile Auth — Bearer Plugin" (AS-D06) for the concrete configuration, which also applies to the web                          |
| Mobile Bearer token     | Token is stored in secure device storage (Keychain/Keystore), revocable via the same database session as the web; not vulnerable to CSRF because it is not auto-attached like a cookie (AS-D06, ADR-043)                                |

---

# Decision Log

| ID     | Decision                                                                           | Reason                                                                                                                                                                                                   | Alternatives                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AS-D01 | Better Auth stores auth data in the same Supabase PostgreSQL (prefix `identity_`) via Prisma | One database & one migrate path (DO-D05); consistent with DB-D04                                                                                                                                         | A separate DB for auth; a non-Prisma driver separate from the schema                                                                                         |
| AS-D02 | Database session (opaque token) instead of stateless-only JWT                      | Sessions can be revoked (logout/remove device); consistent with `auth-architecture.md`                                                                                                                   | Stateless JWT (cannot be revoked before expiry)                                                                                                              |
| AS-D03 | Better Auth issues a Supabase-compatible JWT for Realtime                          | Provides `auth.uid()` for Realtime RLS without moving all auth to Supabase Auth                                                                                                                          | Move to Supabase Auth (conflicts with ADR-024); manual polling (removes the benefit of Realtime)                                                             |
| AS-D04 | Password reset & email verification via Resend (ADR-126)                           | Resend is already installed for invitations (T-110, T-007.7); one provider for account email and invitations                                                                                             | Postmark, AWS SES, Supabase SMTP                                                                                                                             |
| AS-D05 | Separate OAuth client & redirect URI per environment                               | Credential isolation; different callback URLs between prod & staging                                                                                                                                     | One shared OAuth client (mixed redirect URIs, prone to misrouting)                                                                                           |
| AS-D06 | Better Auth Bearer plugin for `/api/v1` mobile auth                                | Keeps one auth system (one secret, one session table, one place to revoke) instead of building a second auth just for mobile; Bearer is CSRF-free and still revocable (ADR-043)                          | API Key plugin as the mobile login auth (suited to programmatic access, not interactive login); a separate auth backend for mobile (duplicated system)       |

---

# Related Documents

- `README.md` — scope and workflow of Engineering Planning
- `deployment-infrastructure.md` — environment topology, cookie `Secure`, `BETTER_AUTH_URL` per env
- `monorepo-setup.md` — location of `src/lib/better-auth/auth.ts` and `src/proxy.ts` (Next.js 16 Proxy, formerly `middleware.ts`)
- `database-orm.md` — Prisma ORM, the Better Auth Prisma adapter, `identity_*` migration, pooling
- `environment-management.md` — auth env var & secret details (ADR-033)
- `../../product-discovery/05-architecture/auth-architecture.md` — auth design (ADR-024), Middleware, RBAC
- `../../product-discovery/05-architecture/database-strategy.md` — DB-D04, DB-D05, RLS `app.current_user_id`
- `../../product-discovery/05-architecture/realtime-strategy.md` — subscription RLS `auth.uid()` on `notifications`
- `../05-architecture/application-layer.md` — Route Handler v1 mobile client (AL-D08, ADR-043)
- `../../project-os/DECISIONS.md` — ADR-024, ADR-030, ADR-043
