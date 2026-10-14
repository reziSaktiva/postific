import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";

/**
 * Prisma transaction client type as seen inside `prisma.$transaction(async (tx) => ...)`.
 * Repositories that adopt `withCurrentUser` receive this instead of the
 * top-level `prisma` singleton for the duration of the callback.
 */
export type PrismaTransactionClient = Prisma.TransactionClient;

/**
 * Server-side RLS session variable wrapper (T-017.1, DO-D06 / database-strategy.md
 * "RLS dan Better Auth").
 *
 * Better Auth does not use Supabase Auth, so `auth.uid()` is unavailable to
 * RLS policies for server-side (service-role) queries. The agreed pattern is:
 *
 * 1. Better Auth session → `userId`.
 * 2. `SET LOCAL app.current_user_id = '<userId>'` inside a transaction.
 * 3. Subsequent queries run in that same transaction/connection so RLS
 *    policies (`current_setting('app.current_user_id', true)`) see it.
 * 4. Authorization stays in the Application Service (RBAC) — RLS here is
 *    defense-in-depth, not the primary authorization mechanism.
 *
 * `userId` is Better Auth's `identity_user.id`, a `cuid()` string — NOT a
 * UUID (see correction note in database-strategy.md § "RLS dan Better Auth"
 * and database-orm.md § DO-D06, 2026-08-13). `SET LOCAL` therefore takes the
 * raw string; RLS policies must compare `app.current_user_id` as text, not
 * cast it to `::uuid`.
 *
 * Implementation notes:
 * - Uses Prisma's tagged-template `$executeRaw` so `userId` is passed as a
 *   bound parameter — never string-concatenated into SQL (SQL injection
 *   safety, per this task's requirement).
 * - `SET LOCAL` only has effect for the remainder of the current
 *   transaction, which is exactly the lifetime of `prisma.$transaction`'s
 *   callback — after the callback resolves/rejects the transaction commits
 *   or rolls back and the setting is discarded automatically.
 * - Adoption is intentionally partial for T-017 (`workspaceRepository`,
 *   see `getMember`/`listMembers` below, is the first adopter). Migrating
 *   every repository method in the codebase to run through this wrapper is
 *   a separate, larger task — see "Catatan Implementasi" on T-017 in
 *   `tasks/v01-foundation.md`.
 */
export async function withCurrentUser<T>(
  userId: string,
  callback: (tx: PrismaTransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setCurrentUserId(tx, userId);
    return callback(tx);
  });
}

/**
 * The single `set_config` statement `withCurrentUser` wraps in its own
 * transaction — exported separately for callers that already have their
 * own outer `prisma.$transaction` (e.g. `WorkspaceRepository.createWithOwner`,
 * which must create the workspace + owner membership atomically and can't
 * nest a second transaction via `withCurrentUser` itself). Always call this
 * as the first statement inside that transaction.
 */
export async function setCurrentUserId(
  tx: PrismaTransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
}

/**
 * Second, narrower-purpose GUC — same `SET LOCAL` + `current_setting()`
 * pattern as `app.current_user_id` above, but for the ONE anonymous
 * (pre-membership) read path in the codebase: looking up a
 * `workspace_invitations` row by its `token` (T-093.1, accept-invite,
 * code review follow-up migration `20260831044328_t093_code_review_rls_hardening`).
 *
 * The invitee has no membership anywhere at that point, so `app.current_user_id`
 * doesn't apply — but the RLS policy on `workspace_invitations` still must
 * not let a caller read ANY `pending` row, only the one matching the exact
 * token it's asking for. Setting this GUC to that specific token value lets
 * the RLS policy (`workspace_invitations_public_pending_lookup`) compare
 * against it directly: `token = current_invite_lookup_token()`. A caller
 * that queries the table without ever calling this (raw SQL, a different
 * tool, a future bug) gets `current_setting(..., true)` = NULL, which can't
 * equal any real token — default-deny, not default-permit.
 */
export async function setInviteLookupToken(
  tx: PrismaTransactionClient,
  token: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.invite_lookup_token', ${token}, true)`;
}

/**
 * Third GUC, same pattern as `setInviteLookupToken` above — scoped to
 * EMAIL instead of TOKEN (T-005.5, migration
 * `20261014120000_t005_5_accept_invite_prevverified_lookup`). Dipakai
 * Better Auth `databaseHooks.user.create.before` (`lib/better-auth/
 * auth.ts`) lewat `WorkspaceRepository.hasVerifiedPendingInvitationForEmail`
 * — hook itu berjalan SEBELUM user dibuat, jadi tidak ada
 * `app.current_user_id` yang valid (chicken-and-egg yang sama dengan
 * lookup token anonim di atas). RLS policy
 * `workspace_invitations_public_email_verified_lookup` membandingkan
 * terhadap GUC ini DAN mengunci sendiri kondisi
 * pending/belum-expired/sudah-terverifikasi di dalam policy-nya —
 * default-deny kalau GUC ini tidak pernah di-set.
 */
export async function setInviteLookupEmail(
  tx: PrismaTransactionClient,
  email: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.invite_lookup_email', ${email}, true)`;
}
