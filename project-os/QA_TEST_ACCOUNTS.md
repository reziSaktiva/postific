# QA TEST ACCOUNTS

This document records the test accounts available for end-to-end browser
verification (used mainly by Najwa QA Engineer, `.claude/agents/
najwa-qa-engineer.md`), so the same accounts can be used repeatedly
without registering again.

---

## Browser testing directly on localhost (ADR-070)

The root cause of the earlier ngrok requirement was **Better Auth Cloud**
(a separate hosted product, once active via the `dash` plugin in `auth.ts`
with `BETTER_AUTH_API_KEY` filled in) which required a public Base URL — not
self-hosted Better Auth. After `BETTER_AUTH_API_KEY` was emptied and the
project went back to self-hosted Better Auth per the baseline
(`auth-strategy.md`, ADR-024), login/session was verified to work normally
through `http://localhost:3000` — see ADR-070 in `DECISIONS.md`.

**Browser verification:** open `http://localhost:3000` directly (via
`bun run dev` or `preview_start` with the `web` config in `.claude/
launch.json`) — **there is no need to ask the user for a tunnel URL anymore.**

---

## Test accounts available at present

These accounts are **already registered in the database** — do not register again.

| Field    | Value                       |
| -------- | --------------------------- |
| Name     | Raka Pratama                |
| Email    | `raka.test@kopiselasar.com` |
| Password | `Password123!`              |
| Role     | Owner                       |

This account has been used many times for M8 end-to-end verification (see
the history of "Raka Pratama test account" in `PROJECT_STATE.md` — ADR-046,
Publishing MVP persistence, ADR-052 Stage 3, etc.).

| Field    | Value                       |
| -------- | --------------------------- |
| Name     | Maya Anggraini              |
| Email    | `maya.test@kopiselasar.com` |
| Password | `Password123!`              |
| Role     | Admin                       |

Created 2026-08-31 through the **Accept Invite (T-093)** flow that had just
been implemented — Raka Pratama (Owner) invited via Settings → Members →
Invite Member (role Admin, Copy Link method), then the `/invite/{token}` link
was opened to fill in Name + Password ("Email Baru" state, email locked to the
invitation). It landed successfully in the same workspace (workspace
"Insvire") with the Admin role — used as proof that T-093 works end-to-end
and as the second account for RBAC verification (KI-038, T-093.4: Owner vs
Admin vs Creator — not fully done yet, still open).

| Field    | Value                        |
| -------- | ---------------------------- |
| Name     | Sinta Wijaya                 |
| Email    | `sinta.test@kopiselasar.com` |
| Password | `Password123!`               |
| Role     | Creator                      |

Created 2026-08-31 — the account was registered via `/register` by the AI,
and the invite to the Insvire workspace (role Creator) was done by King Rezi
personally through Settings → Members → Invite Member → the `/invite/{token}`
link, successfully.

With this, the **Insvire** workspace now has real accounts for **all three
roles** (Raka=Owner, Maya=Admin, Sinta=Creator) — completing the data needed
for end-to-end RBAC verification (KI-038, T-093.4: Danger Zone hidden for
non-Owner, Transfer Ownership, Update Role, Remove Member) which was
previously blocked because there were no ≥2 real accounts in one workspace.

---

## Playwright E2E test account (T-173)

A dedicated account for the Playwright E2E suite (ADR-149, S-002, T-173),
created by King Rezi on 2026-10-29. Different from the Raka/Maya/Sinta
accounts above.

| Field | Value                       |
| ----- | --------------------------- |
| Email | `rezisaktiva.dev@gmail.com` |

**Password policy: NOT written in the repo** (T-173.1). This is deliberately
different from the Raka/Maya/Sinta accounts above, whose passwords are
recorded. The credentials exist only in `apps/web/.env.local` and GitHub
Secrets, through the variables `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`.

**Usage rules** (King Rezi, 2026-10-29):

- All actions are allowed with this account, **except publishing a post**
  (publish now or a schedule that will be published) in the workspace
  **"Cook It Real Good"**.
- Data created by tests uses the prefix `e2e-` (T-173.3).

---

## Updating this document

When a new test account is added (e.g. Manager/Creator after the invite
feature is finished, or any other additional account), add a new row to the
"Test accounts available at present" table above — do not create a separate
file per account again.
