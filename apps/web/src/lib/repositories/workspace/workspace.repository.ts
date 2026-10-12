import {
  asConnectedAccountId,
  asInvitationId,
  asMemberId,
  asUserId,
  asWorkspaceId,
  InvitationStatus,
  MemberRole,
  MemberStatus,
  type ConnectedAccountId,
  type SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import type {
  ConnectedAccountRecord,
  IWorkspaceRepository,
  WorkspaceInvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceMembershipSummary,
} from "@/domains/workspace";
import {
  Prisma,
  type WorkspaceConnectedAccount,
  type WorkspaceInvitation,
  type WorkspaceMember,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import {
  setCurrentUserId,
  setInviteLookupToken,
  withCurrentUser,
} from "@/lib/prisma/with-current-user";
import { ConflictError, NotFoundError } from "@/lib/utils/errors";

/**
 * With the pg driver adapter (Prisma 7 / @prisma/adapter-pg), P2002's
 * `meta.target` field name array isn't populated — only `meta.modelName`
 * is reliable. `slug` is the only unique constraint on Workspace besides
 * the generated UUID primary key, so a P2002 on this model is the slug
 * collision.
 */
function isSlugConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.meta?.modelName === "Workspace"
  );
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

function isInvitationEmailConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.meta?.modelName === "WorkspaceInvitation"
  );
}

/** P2002 on `[workspaceId, outstandAccountId]` — dipakai `createConnectedAccount` (T-013.1/T-013.2, ADR-105). */
function isConnectedAccountConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.meta?.modelName === "WorkspaceConnectedAccount"
  );
}

/** Shared mapper — dipakai `listConnectedAccounts`, `findConnectedAccountById`, `createConnectedAccount`, `reconnectAccount`. */
function toConnectedAccountRecord(
  account: WorkspaceConnectedAccount,
): ConnectedAccountRecord {
  return {
    id: asConnectedAccountId(account.id),
    workspaceId: asWorkspaceId(account.workspaceId),
    platform: account.platform as SocialPlatform,
    outstandAccountId: account.outstandAccountId,
    handle: account.handle,
    status: account.status,
    reconnectRequired: account.reconnectRequired,
    connectedAt: account.connectedAt,
    // KI-076/ADR-120 — lihat docstring `ConnectedAccountRecord.avatarUrl`.
    // KNOWN ISSUE (KI-078): avatar hanya di-backfill saat connect/reconnect
    // BARU — akun yang sudah terhubung SEBELUM ADR-120 diterapkan akan
    // selalu `null` di sini selamanya kecuali di-reconnect, dan (KI-078)
    // saat ini tidak ada jalur UI untuk reconnect akun yang statusnya
    // `disconnected`. Kalau field ini `null` untuk akun yang "seharusnya"
    // punya foto, ini gap yang sudah diketahui, bukan bug baru.
    avatarUrl: account.avatarUrl,
    lastImportedUntil: account.lastImportedUntil,
    lastImportRequestedAt: account.lastImportRequestedAt,
  };
}

function toMemberRecord(member: WorkspaceMember): WorkspaceMemberRecord {
  return {
    id: asMemberId(member.id),
    workspaceId: asWorkspaceId(member.workspaceId),
    userId: asUserId(member.userId),
    role: member.role as MemberRole,
    status: member.status as MemberStatus,
  };
}

function toInvitationRecord(
  invitation: WorkspaceInvitation,
): WorkspaceInvitationRecord {
  return {
    id: asInvitationId(invitation.id),
    workspaceId: asWorkspaceId(invitation.workspaceId),
    email: invitation.email,
    role: invitation.role as MemberRole,
    token: invitation.token,
    status: invitation.status as InvitationStatus,
    invitedByUserId: asUserId(invitation.invitedByUserId),
    expiresAt: invitation.expiresAt,
    // T-110/KI-053 — lihat docstring WorkspaceInvitationRecord.
    verificationCodeHash: invitation.verificationCodeHash,
    verificationCodeExpiresAt: invitation.verificationCodeExpiresAt,
    verificationAttempts: invitation.verificationAttempts,
    emailVerifiedAt: invitation.emailVerifiedAt,
  };
}

export const workspaceRepository: IWorkspaceRepository = {
  async createWithOwner({ name, slug, ownerId }) {
    try {
      return await prisma.$transaction(async (tx) => {
        // RLS (KI-026): the owner's membership row is created before any
        // membership exists, so `app.current_user_id` must be set to the
        // new owner's own id — the SELECT policy on workspace_members
        // allows a row to be returned when it matches the session's own
        // user_id directly (no self-referencing subquery), which is what
        // lets Prisma's implicit `RETURNING` on the insert below succeed.
        // Uses `setCurrentUserId` (not `withCurrentUser`) because this
        // already has its own outer transaction — `withCurrentUser` opens
        // a second, separate one, which would break the atomicity of
        // creating the workspace + owner membership together.
        await setCurrentUserId(tx, ownerId);

        const workspace = await tx.workspace.create({
          data: { name, slug, ownerId },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: ownerId,
            role: MemberRole.Owner,
            status: MemberStatus.Active,
            joinedAt: new Date(),
          },
        });

        return {
          id: asWorkspaceId(workspace.id),
          name: workspace.name,
          slug: workspace.slug,
        };
      });
    } catch (error) {
      if (isSlugConflict(error)) {
        throw new ConflictError(`Slug "${slug}" sudah digunakan.`);
      }
      throw error;
    }
  },

  async findDefaultWorkspaceForUser(userId) {
    // Sama seperti `getMember` (lihat catatan di atasnya) — tanpa
    // `withCurrentUser`, `app.current_user_id` tidak ter-set sehingga RLS
    // policy default-deny di `workspace_members` membuat query ini selalu
    // balik 0 baris walau membership-nya benar-benar ada. Ditemukan saat
    // debugging live: user dengan workspace aktif tetap diarahkan ke
    // halaman "buat workspace pertama" karena fungsi ini kelewatan saat
    // migrasi PR #71 mem-wrap seluruh method lain di file ini.
    const membership = await withCurrentUser(userId, (tx) =>
      tx.workspaceMember.findFirst({
        where: { userId, status: MemberStatus.Active },
        orderBy: { joinedAt: "asc" },
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
        },
      }),
    );

    if (!membership) {
      return null;
    }

    return {
      id: asWorkspaceId(membership.workspace.id),
      name: membership.workspace.name,
      slug: membership.workspace.slug,
    };
  },

  /**
   * Seluruh workspace dengan membership AKTIF milik user ini (T-089.2,
   * ADR-088) — dibungkus `withCurrentUser` sesuai pola method lain yang
   * query berdasarkan `userId` (mis. `findDefaultWorkspaceForUser`), supaya
   * `app.current_user_id` ter-set untuk RLS policy `workspace_members`.
   */
  async listWorkspacesForUser(userId): Promise<WorkspaceMembershipSummary[]> {
    const memberships = await withCurrentUser(userId, (tx) =>
      tx.workspaceMember.findMany({
        where: { userId, status: MemberStatus.Active },
        orderBy: { joinedAt: "asc" },
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
        },
      }),
    );

    return memberships.map((membership) => ({
      workspaceId: asWorkspaceId(membership.workspace.id),
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role as MemberRole,
    }));
  },

  async findById(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        pendingOwnerTransferTo: true,
      },
    });

    if (!workspace) {
      return null;
    }

    return {
      id: asWorkspaceId(workspace.id),
      name: workspace.name,
      slug: workspace.slug,
      pendingOwnerTransferTo: workspace.pendingOwnerTransferTo
        ? asUserId(workspace.pendingOwnerTransferTo)
        : null,
    };
  },

  async listConnectedAccounts(workspaceId, userId) {
    const accounts = await withCurrentUser(userId, (tx) =>
      tx.workspaceConnectedAccount.findMany({
        where: { workspaceId },
        orderBy: { connectedAt: "asc" },
      }),
    );

    return accounts.map(toConnectedAccountRecord);
  },

  async countActiveConnectedAccounts(workspaceId, userId) {
    return withCurrentUser(userId, (tx) =>
      tx.workspaceConnectedAccount.count({
        where: { workspaceId, status: "active" },
      }),
    );
  },

  async listMembers(workspaceId, actingUserId) {
    const members = await withCurrentUser(actingUserId, (tx) =>
      tx.workspaceMember.findMany({
        where: { workspaceId },
        orderBy: { joinedAt: "asc" },
      }),
    );

    return members.map(toMemberRecord);
  },

  async findUsersByIds(userIds) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    return users.map((user) => ({
      id: asUserId(user.id),
      name: user.name,
      email: user.email,
    }));
  },

  /**
   * `getMember` is called with the acting `userId` already in scope (RBAC
   * membership lookup), so it's a natural fit for `withCurrentUser` — sets
   * `app.current_user_id` for the duration of this query so the RLS
   * policy on `workspace_members` (migration
   * `20260813045625_t017_add_rls_policies`, KI-026 follow-up fixes) can
   * actually enforce workspace isolation. `DATABASE_URL` now connects as
   * the non-BYPASSRLS `app_runtime` role (KI-026, resolved). Every other
   * method in this file has since adopted the same pattern (code review,
   * PR #71) — `findInvitationByToken` is the one deliberate exception, see
   * its doc comment in `domains/workspace/repositories/workspace.repository.ts`.
   */
  async getMember(workspaceId, userId) {
    const member = await withCurrentUser(userId, (tx) =>
      tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      }),
    );

    return member ? toMemberRecord(member) : null;
  },

  async findMemberById(workspaceId, memberId, actingUserId) {
    const member = await withCurrentUser(actingUserId, (tx) =>
      tx.workspaceMember.findFirst({
        where: { id: memberId, workspaceId },
      }),
    );

    return member ? toMemberRecord(member) : null;
  },

  async removeMember(workspaceId, memberId, actingUserId) {
    try {
      await withCurrentUser(actingUserId, (tx) =>
        tx.workspaceMember.delete({
          where: { id: memberId, workspaceId },
        }),
      );
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundError("Anggota tidak ditemukan.");
      }
      throw error;
    }
  },

  async updateMemberRole(workspaceId, memberId, role, actingUserId) {
    try {
      await withCurrentUser(actingUserId, (tx) =>
        tx.workspaceMember.update({
          where: { id: memberId, workspaceId },
          data: { role },
        }),
      );
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundError("Anggota tidak ditemukan.");
      }
      throw error;
    }
  },

  async createInvitation({
    workspaceId,
    email,
    role,
    invitedByUserId,
    token,
    expiresAt,
  }) {
    let invitation;
    try {
      invitation = await withCurrentUser(invitedByUserId, (tx) =>
        tx.workspaceInvitation.create({
          data: {
            workspaceId,
            email,
            role,
            invitedByUserId,
            token,
            expiresAt,
          },
        }),
      );
    } catch (error) {
      if (isInvitationEmailConflict(error)) {
        throw new ConflictError(
          `Undangan untuk "${email}" di workspace ini sudah ada.`,
        );
      }
      throw error;
    }

    return toInvitationRecord(invitation);
  },

  /**
   * Public token-based lookup (T-093.1) — wrapped in its own transaction to
   * `SET LOCAL app.invite_lookup_token` (code review follow-up migration
   * `20260831044328_t093_code_review_rls_hardening`) before querying, so the
   * `workspace_invitations_public_pending_lookup` RLS policy can compare
   * against the EXACT token being looked up rather than permitting every
   * `pending` row in the table. Deliberately its own transaction (not
   * `withCurrentUser`, which sets a DIFFERENT GUC for the membership-based
   * case) — the invitee has no membership anywhere yet, so
   * `app.current_user_id` doesn't apply here.
   */
  async findInvitationByToken(token) {
    const invitation = await prisma.$transaction(async (tx) => {
      await setInviteLookupToken(tx, token);
      return tx.workspaceInvitation.findUnique({ where: { token } });
    });

    return invitation ? toInvitationRecord(invitation) : null;
  },

  /** Sama pola tanpa `withCurrentUser` seperti `findInvitationByToken` (lihat catatan interface). */
  async findUserByEmail(email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, createdAt: true },
    });

    return user ? { id: asUserId(user.id), createdAt: user.createdAt } : null;
  },

  /**
   * T-110.2 — sama pola transaksi + GUC seperti `findInvitationByToken`
   * (invitee anonim, tidak ada `app.current_user_id`). `updateMany` +
   * guard `status: pending` (compare-and-swap, pola sama
   * `revokeInvitation`/`acceptInvitation`) — kalau tidak match (race:
   * invitation sudah di-revoke/accept/expired persis di antara service-layer
   * check dan panggilan ini), lempar `ConflictError` generik.
   */
  async setInvitationVerificationCode(token, { codeHash, expiresAt }) {
    await prisma.$transaction(async (tx) => {
      await setInviteLookupToken(tx, token);
      const updated = await tx.workspaceInvitation.updateMany({
        where: { token, status: InvitationStatus.Pending },
        data: {
          verificationCodeHash: codeHash,
          verificationCodeExpiresAt: expiresAt,
          verificationAttempts: 0,
        },
      });
      if (updated.count === 0) {
        throw new ConflictError(
          "Undangan ini sudah tidak berlaku — tidak bisa mengirim kode verifikasi.",
        );
      }
    });
  },

  /** T-110.3 — single-use: clear hash+expiry sekaligus set `emailVerifiedAt`. Pola compare-and-swap sama `setInvitationVerificationCode`. */
  async markInvitationEmailVerified(token) {
    await prisma.$transaction(async (tx) => {
      await setInviteLookupToken(tx, token);
      const updated = await tx.workspaceInvitation.updateMany({
        where: { token, status: InvitationStatus.Pending },
        data: {
          emailVerifiedAt: new Date(),
          verificationCodeHash: null,
          verificationCodeExpiresAt: null,
        },
      });
      if (updated.count === 0) {
        throw new ConflictError(
          "Undangan ini sudah tidak berlaku — tidak bisa mengonfirmasi verifikasi.",
        );
      }
    });
  },

  /**
   * Code-review PR #142 finding — `updateMany` (bukan `update`, alasan
   * sama seperti sebelumnya: P2025 avoidance) sekarang JUGA menyertakan
   * `verificationAttempts: { lt: maxAttempts }` di `WHERE` supaya cap
   * ditegakkan ATOMIC oleh Postgres (UPDATE pada baris yang sama
   * di-serialize — request konkuren yang mencoba increment setelah slot
   * terakhir terisi akan gagal match `WHERE` begitu melihat versi baris
   * ter-commit terbaru), bukan dicek terpisah dari increment seperti
   * sebelumnya (celah race: N request konkuren bisa sama-sama baca
   * attempts lama sebelum salah satu commit). `updated.count === 0` bisa
   * berarti DUA hal berbeda — disambiguasi lewat read-back status: kalau
   * invitation sudah tidak `pending` sama sekali → `ConflictError` (pola
   * lama tetap berlaku); kalau masih `pending` tapi `count === 0` berarti
   * cap sudah tercapai (termasuk race ini) → return sentinel
   * `maxAttempts + 1` (lihat docstring `IWorkspaceRepository`).
   */
  async incrementInvitationVerificationAttempts(token, maxAttempts) {
    return prisma.$transaction(async (tx) => {
      await setInviteLookupToken(tx, token);
      const updated = await tx.workspaceInvitation.updateMany({
        where: {
          token,
          status: InvitationStatus.Pending,
          verificationAttempts: { lt: maxAttempts },
        },
        data: { verificationAttempts: { increment: 1 } },
      });

      if (updated.count === 0) {
        const invitation = await tx.workspaceInvitation.findUnique({
          where: { token },
          select: { status: true },
        });
        if (!invitation || invitation.status !== InvitationStatus.Pending) {
          throw new ConflictError(
            "Undangan ini sudah tidak berlaku — tidak bisa mencatat percobaan verifikasi.",
          );
        }
        return maxAttempts + 1;
      }

      const invitation = await tx.workspaceInvitation.findUnique({
        where: { token },
        select: { verificationAttempts: true },
      });
      return invitation?.verificationAttempts ?? maxAttempts;
    });
  },

  async acceptInvitation({ workspaceId, invitationId, userId, role }) {
    return prisma.$transaction(async (tx) => {
      // RLS chicken-and-egg (KI-026), sama seperti `createWithOwner`: baris
      // membership baru ini belum ada saat insert dieksekusi, jadi
      // `app.current_user_id` di-set ke user yang menerima undangan (bukan
      // aktor lain) — pola `setCurrentUserId` bukan `withCurrentUser` karena
      // transaksi ini sudah dibuka manual di atas.
      await setCurrentUserId(tx, userId);

      // Flip status atomik `pending` -> `accepted`; `count === 0` berarti
      // invitation sudah tidak `pending` lagi (dipakai/dibatalkan di antara
      // `findInvitationByToken` di service dan transaksi ini) — race guard
      // supaya token tidak bisa dipakai dua kali (T-093.4).
      const flipped = await tx.workspaceInvitation.updateMany({
        where: { id: invitationId, status: InvitationStatus.Pending },
        data: { status: InvitationStatus.Accepted, acceptedAt: new Date() },
      });
      if (flipped.count === 0) {
        throw new ConflictError(
          "Undangan ini sudah pernah dipakai atau dibatalkan.",
        );
      }

      // `create` murni, bukan `upsert` — `removeMember` hard-delete baris
      // `workspace_members` dan `WorkspaceInvitation` `@@unique([workspaceId,
      // email])` mencegah invitation kedua untuk email yang sama di
      // workspace ini, jadi baris `(workspaceId, userId)` tidak pernah ada
      // sebelum titik ini. Kalau nanti ada fitur cancel-invitation atau
      // soft-delete member (RLS `workspace_members` saat ini cuma
      // meng-cover INSERT lewat `has_accepted_invitation`, tidak UPDATE),
      // jalur reaktivasi perlu migrasi RLS baru dulu, bukan cukup upsert.
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId,
          role,
          status: MemberStatus.Active,
          joinedAt: new Date(),
        },
      });

      return toMemberRecord(member);
    });
  },

  /** Ordered by `createdAt` ascending — sama urutan invitation dibuat, konsisten dengan `listMembers` (`joinedAt` ascending). */
  async listPendingInvitations(workspaceId, actingUserId) {
    const invitations = await withCurrentUser(actingUserId, (tx) =>
      tx.workspaceInvitation.findMany({
        where: {
          workspaceId,
          status: InvitationStatus.Pending,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      }),
    );

    return invitations.map(toInvitationRecord);
  },

  async revokeInvitation(workspaceId, invitationId, actingUserId) {
    await withCurrentUser(actingUserId, async (tx) => {
      // Flip status atomik `pending` -> `revoked` dalam satu statement —
      // sama pola race guard seperti `acceptInvitation` (compare-and-swap
      // lewat `updateMany` + cek `count`, bukan SELECT-lalu-UPDATE terpisah).
      // Ini mencegah race dengan `acceptInvitation`: kalau invitee accept
      // duluan (status sudah `accepted`), `updateMany` di sini tidak akan
      // match apa pun, jadi tidak menimpa status yang sudah benar. `expiresAt`
      // juga di-guard di where-clause supaya invitation yang sudah lewat
      // masa berlaku (tapi status-nya masih `pending`, tidak ada proses yang
      // secara aktif menandainya expired) tidak ikut ke-flip jadi `revoked`.
      const revoked = await tx.workspaceInvitation.updateMany({
        where: {
          id: invitationId,
          workspaceId,
          status: InvitationStatus.Pending,
          expiresAt: { gt: new Date() },
        },
        data: { status: InvitationStatus.Revoked },
      });
      if (revoked.count === 0) {
        // Update tidak kena — tidak dibedakan lagi NotFound vs Conflict
        // vs expired lewat query kedua (round-trip tambahan untuk pesan
        // yang lebih presisi tidak sepadan di jalur double-click ini).
        throw new ConflictError(
          "Undangan tidak ditemukan, sudah dipakai/dibatalkan, atau sudah kedaluwarsa.",
        );
      }
    });
  },

  async saveChannelOrder({ workspaceId, userId, orderedConnectedAccountIds }) {
    // `tx` di dalam `withCurrentUser` sudah berupa interactive transaction
    // client (Prisma.TransactionClient) — tidak mengekspos `$transaction`
    // untuk nested batch, jadi deleteMany+createMany dijalankan sequential
    // di sini (tetap atomik karena keduanya ada di dalam transaksi yang
    // sama, bukan dua transaksi independen seperti sebelumnya).
    await withCurrentUser(userId, async (tx) => {
      await tx.workspaceChannelOrder.deleteMany({
        where: { workspaceId, userId },
      });
      await tx.workspaceChannelOrder.createMany({
        data: orderedConnectedAccountIds.map(
          (connectedAccountId, position) => ({
            workspaceId,
            userId,
            connectedAccountId,
            position,
          }),
        ),
      });
    });
  },

  async getChannelOrder(workspaceId, userId) {
    const rows = await withCurrentUser(userId, (tx) =>
      tx.workspaceChannelOrder.findMany({
        where: { workspaceId, userId },
        orderBy: { position: "asc" },
      }),
    );

    return rows.map((row) => asConnectedAccountId(row.connectedAccountId));
  },

  /**
   * `prisma.workspace.delete` — `workspaces` bukan tabel RLS-protected
   * (lihat catatan "Tables intentionally WITHOUT workspace-isolation RLS"
   * di migration `20260813045625_t017_add_rls_policies`), tapi tetap
   * dibungkus `withCurrentUser` supaya `app.current_user_id` ikut ter-set
   * untuk cascade delete ke tabel anak yang RLS-protected (mis.
   * `workspace_members`, `notifications`) dalam transaksi yang sama.
   */
  async deleteWorkspace(workspaceId, actingUserId) {
    try {
      await withCurrentUser(actingUserId, (tx) =>
        tx.workspace.delete({ where: { id: workspaceId } }),
      );
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundError("Workspace tidak ditemukan.");
      }
      throw error;
    }
  },

  async setPendingOwnerTransfer(workspaceId, targetUserId, actingUserId) {
    try {
      await withCurrentUser(actingUserId, (tx) =>
        tx.workspace.update({
          where: { id: workspaceId },
          data: { pendingOwnerTransferTo: targetUserId },
        }),
      );
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundError("Workspace tidak ditemukan.");
      }
      throw error;
    }
  },

  async clearPendingOwnerTransfer(workspaceId, actingUserId) {
    try {
      await withCurrentUser(actingUserId, (tx) =>
        tx.workspace.update({
          where: { id: workspaceId },
          data: { pendingOwnerTransferTo: null },
        }),
      );
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundError("Workspace tidak ditemukan.");
      }
      throw error;
    }
  },

  async acceptOwnershipTransfer({
    workspaceId,
    currentOwnerMemberId,
    targetMemberId,
    newOwnerUserId,
  }) {
    try {
      await withCurrentUser(newOwnerUserId, async (tx) => {
        await tx.workspaceMember.update({
          where: { id: currentOwnerMemberId, workspaceId },
          data: { role: MemberRole.Admin },
        });
        await tx.workspaceMember.update({
          where: { id: targetMemberId, workspaceId },
          data: { role: MemberRole.Owner },
        });
        await tx.workspace.update({
          where: { id: workspaceId },
          data: {
            ownerId: newOwnerUserId,
            pendingOwnerTransferTo: null,
          },
        });
      });
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundError("Workspace atau anggota tidak ditemukan.");
      }
      throw error;
    }
  },

  async renameWorkspace(workspaceId, name, actingUserId) {
    try {
      const workspace = await withCurrentUser(actingUserId, (tx) =>
        tx.workspace.update({
          where: { id: workspaceId },
          data: { name },
          select: {
            id: true,
            name: true,
            slug: true,
            pendingOwnerTransferTo: true,
          },
        }),
      );

      return {
        id: asWorkspaceId(workspace.id),
        name: workspace.name,
        slug: workspace.slug,
        pendingOwnerTransferTo: workspace.pendingOwnerTransferTo
          ? asUserId(workspace.pendingOwnerTransferTo)
          : null,
      };
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundError("Workspace tidak ditemukan.");
      }
      throw error;
    }
  },

  async markAccountReconnectRequired(outstandAccountId) {
    const lookup =
      await lookupAccountOwnerByOutstandAccountId(outstandAccountId);
    if (!lookup) {
      return null;
    }
    const { workspaceId, connectedAccountId, ownerUserId } = lookup;

    // Write path tetap RLS-safe seperti method lain di file ini —
    // `ownerUserId` (Owner workspace ini, dibaca lewat bypass di atas)
    // dijamin member aktif di workspace-nya sendiri, jadi `withCurrentUser`
    // di sini tidak butuh bypass tambahan.
    // `status: { not: "disconnected" }` — akun yang sudah di-disconnect
    // manual (T-014) tidak boleh dihidupkan lagi jadi "Perlu Reconnect"
    // hanya karena webhook Outstand telat/independen dari disconnect lokal.
    await withCurrentUser(ownerUserId, (tx) =>
      tx.workspaceConnectedAccount.updateMany({
        where: {
          id: connectedAccountId,
          workspaceId,
          status: { not: "disconnected" },
        },
        data: { reconnectRequired: true },
      }),
    );

    return { workspaceId, connectedAccountId, ownerUserId };
  },

  async findAccountOwnerByOutstandAccountId(outstandAccountId) {
    // Read-only (T-051, JOB-03) — lihat catatan lengkap di interface
    // method ini untuk kenapa `engagement` butuh lookup ini. Reuse HELPER
    // yang sama dengan `markAccountReconnectRequired`, TANPA langkah tulis
    // `reconnectRequired` (beda tujuan pemanggilan sepenuhnya).
    //
    // Eskalasi review Ridwan (T-051, disconnect→reconnect job leak) —
    // `disconnectAccount` tidak pernah membatalkan chain self-reschedule
    // `engagement.sync` yang sedang berjalan untuk akun itu (tidak ada
    // mekanisme cancel/deleteByCriteria di `IJobScheduler`/
    // `background-job-store.ts`). Fix-nya di sini, bukan menambah cancel
    // job baru: akun berstatus BUKAN `active` (mis. `disconnected`)
    // diperlakukan SAMA seperti "akun tidak ditemukan" — return `null`
    // supaya `EngagementSyncJobHandler.handle` throw SEBELUM memanggil
    // `SyncCommentsUseCase.sync` dan SEBELUM self-reschedule (jalur
    // dead-letter yang SUDAH ada & sudah ditest, lihat docstring class
    // `EngagementSyncJobHandler`) — chain job untuk akun yang di-disconnect
    // mati sendiri begitu invocation berikutnya berjalan, tanpa pernah
    // menyentuh Outstand lagi atau memicu notifikasi `engagement_new`.
    // `markAccountReconnectRequired` (webhook path, T-026.5) TIDAK
    // dipengaruhi — ia memakai helper yang sama tapi tidak memeriksa field
    // `status` ini sama sekali, jadi behaviornya persis seperti sebelumnya.
    // `reconnectRequired` bisa true sementara `status` masih `active`
    // (token expired lewat webhook, `markAccountReconnectRequired` tidak
    // mengubah `status`) — diperlakukan sama seperti "tidak ditemukan"
    // supaya JOB-03 berhenti sync akun yang butuh reconnect, bukan terus
    // memanggil Outstand dengan token yang sudah ditolak.
    const lookup =
      await lookupAccountOwnerByOutstandAccountId(outstandAccountId);
    if (!lookup || lookup.status !== "active" || lookup.reconnectRequired) {
      return null;
    }
    return {
      workspaceId: lookup.workspaceId,
      connectedAccountId: lookup.connectedAccountId,
      ownerUserId: lookup.ownerUserId,
      handle: lookup.handle,
    };
  },

  async disconnectAccount(workspaceId, connectedAccountId, actingUserId) {
    await withCurrentUser(actingUserId, async (tx) => {
      const result = await tx.workspaceConnectedAccount.updateMany({
        where: {
          id: connectedAccountId,
          workspaceId,
          status: { not: "disconnected" },
        },
        data: { status: "disconnected", reconnectRequired: false },
      });
      if (result.count > 0) return;

      // Update tidak kena — tidak dibedakan lagi NotFound vs Conflict lewat
      // query kedua (round-trip tambahan untuk pesan yang lebih presisi
      // tidak sepadan di jalur double-click ini), sama pola seperti
      // `revokeInvitation`.
      throw new ConflictError(
        "Akun terhubung tidak ditemukan atau sudah terputus.",
      );
    });
  },

  async findConnectedAccountById(
    workspaceId,
    connectedAccountId,
    actingUserId,
  ) {
    const account = await withCurrentUser(actingUserId, (tx) =>
      tx.workspaceConnectedAccount.findFirst({
        where: { id: connectedAccountId, workspaceId },
      }),
    );
    return account ? toConnectedAccountRecord(account) : null;
  },

  async findConnectedAccountByOutstandId(
    workspaceId,
    outstandAccountId,
    actingUserId,
  ) {
    const account = await withCurrentUser(actingUserId, (tx) =>
      tx.workspaceConnectedAccount.findUnique({
        where: {
          workspaceId_outstandAccountId: { workspaceId, outstandAccountId },
        },
      }),
    );
    return account ? toConnectedAccountRecord(account) : null;
  },

  async isConnectedAccountWithinWindow(
    connectedAccountId,
    windowMs,
    actingUserId,
  ) {
    // Perbandingan waktu di sisi Postgres (`now() - connected_at`), BUKAN
    // `Date.now()` di Node (code review PR #139) — menghindari drift jam
    // app-server (Railway) vs database (Supabase). `make_interval(secs =>
    // ...)` menerima pecahan detik jadi `windowMs` bisa langsung dibagi
    // 1000 tanpa pembulatan.
    const rows = await withCurrentUser(
      actingUserId,
      (tx) =>
        tx.$queryRaw<{ within_window: boolean }[]>`
        SELECT (now() - connected_at) <= make_interval(secs => ${windowMs / 1000}::float8) AS within_window
        FROM "workspace_connected_accounts"
        WHERE id = ${connectedAccountId}::uuid
      `,
    );
    return rows[0]?.within_window ?? false;
  },

  async createConnectedAccount({
    workspaceId,
    platform,
    outstandAccountId,
    handle,
    avatarUrl,
    actingUserId,
  }) {
    try {
      const account = await withCurrentUser(actingUserId, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId,
            platform,
            outstandAccountId,
            handle,
            avatarUrl: avatarUrl ?? null,
            status: "active",
          },
        }),
      );
      return toConnectedAccountRecord(account);
    } catch (error) {
      if (isConnectedAccountConflict(error)) {
        throw new ConflictError("Akun ini sudah terhubung di workspace ini.");
      }
      throw error;
    }
  },

  async createConnectedAccounts({ workspaceId, actingUserId, accounts }) {
    return withCurrentUser(actingUserId, async (tx) => {
      const existing = await tx.workspaceConnectedAccount.findMany({
        where: {
          workspaceId,
          outstandAccountId: {
            in: accounts.map((account) => account.outstandAccountId),
          },
        },
        select: { outstandAccountId: true },
      });
      const existingIds = new Set(
        existing.map((account) => account.outstandAccountId),
      );

      const created = [];
      for (const account of accounts) {
        if (existingIds.has(account.outstandAccountId)) continue;
        const row = await tx.workspaceConnectedAccount.create({
          data: {
            workspaceId,
            platform: account.platform,
            outstandAccountId: account.outstandAccountId,
            handle: account.handle,
            avatarUrl: account.avatarUrl ?? null,
            status: "active",
          },
        });
        created.push(toConnectedAccountRecord(row));
      }
      return created;
    });
  },

  async reconnectAccount({
    workspaceId,
    connectedAccountId,
    outstandAccountId,
    handle,
    avatarUrl,
    actingUserId,
  }) {
    return withCurrentUser(actingUserId, async (tx) => {
      // Compare-and-swap (`updateMany` dengan guard `workspaceId`) — pola
      // sama seperti `disconnectAccount`/`markAccountReconnectRequired` di
      // atas, bukan `update` langsung by id (defense-in-depth terhadap
      // `connectedAccountId` yang bukan milik `workspaceId` ini, walau
      // `WorkspaceService` sudah memvalidasi lewat `findConnectedAccountById`
      // sebelum memanggil method ini).
      let result;
      try {
        result = await tx.workspaceConnectedAccount.updateMany({
          where: { id: connectedAccountId, workspaceId },
          data: {
            outstandAccountId,
            handle,
            // `avatarUrl` HANYA ditulis kalau fetch-nya berhasil dapat nilai
            // (bukan `null`/`undefined`) — `fetchSocialAccountAvatarUrl`
            // best-effort mengembalikan `null` untuk DUA kasus yang beda
            // (akun genuinely tidak punya foto, ATAU fetch gagal transient),
            // jadi tulis-selalu di sini bisa menghapus avatar yang sudah
            // benar tersimpan hanya karena satu request avatar gagal saat
            // reconnect. Konsekuensi: avatar lama tetap tampil kalau user
            // BENAR-BENAR menghapus foto profilnya di platform asli — trade-off
            // yang lebih aman daripada silent data loss pada kegagalan network.
            ...(avatarUrl ? { avatarUrl } : {}),
            status: "active",
            reconnectRequired: false,
          },
        });
      } catch (error) {
        // KI-078 follow-up (code review PR #139) — `case "disconnected"`
        // sekarang juga merender `ReconnectButton`, jadi path ini bisa
        // menabrak `[workspaceId, outstandAccountId]` kalau OAuth-nya
        // diarahkan ke akun outstand lain yang SUDAH terhubung di
        // workspace ini (bukan cuma akun `redirectAccountId` itu sendiri).
        // Map ke `ConflictError` yang sama seperti `createConnectedAccount`,
        // bukan biarkan P2002 mentah lolos ke Route Handler (yang cuma
        // menangani `AlreadyConnectedError`/`ApplicationError`).
        if (isConnectedAccountConflict(error)) {
          throw new ConflictError("Akun ini sudah terhubung di workspace ini.");
        }
        throw error;
      }

      if (result.count === 0) {
        throw new NotFoundError("Akun terhubung tidak ditemukan.");
      }

      let updated;
      try {
        updated = await tx.workspaceConnectedAccount.findUniqueOrThrow({
          where: { id: connectedAccountId },
        });
      } catch (error) {
        // Race sangat sempit (row terhapus di antara `updateMany` yang baru
        // saja berhasil dan lookup ini, dalam transaksi yang sama) — map ke
        // `NotFoundError` yang sama seperti guard `result.count === 0` di
        // atas, bukan biarkan P2025 mentah lolos ke pemanggil.
        if (isRecordNotFound(error)) {
          throw new NotFoundError("Akun terhubung tidak ditemukan.");
        }
        throw error;
      }
      return toConnectedAccountRecord(updated);
    });
  },

  async updateImportWatermark({
    connectedAccountId,
    lastImportedUntil,
    lastImportRequestedAt,
    actingUserId,
  }) {
    // Bug fix 2026-10-08 (ditemukan testing end-to-end DB nyata, bukan cuma
    // unit test fake repository) — versi sebelumnya pakai `prisma` plain
    // (bukan `withCurrentUser`) dengan klaim "write murni field watermark
    // tidak membocorkan data lintas tenant, jadi aman tanpa RLS". Klaim itu
    // salah: `workspace_connected_accounts` dijaga RLS policy `FOR ALL`
    // (migration `20260813045625_t017_add_rls_policies`), dan `FOR ALL`
    // tanpa `WITH CHECK` terpisah berarti `USING` berlaku juga untuk
    // `UPDATE` — tanpa `app.current_user_id` di-set, `current_setting`
    // mengembalikan NULL, subquery `workspace_id IN (...)` tidak pernah
    // match, dan `updateMany` match 0 baris SELALU, secara senyap (watermark
    // tidak pernah persisten walau `background_jobs` tercatat `done`).
    // `withCurrentUser` (pola sama `reconnectAccount` di atas) memperbaiki
    // ini. `updateMany` (bukan `update`) tetap dipertahankan supaya
    // `connectedAccountId` yang tidak ditemukan ATAU acting user yang bukan
    // member aktif workspace tersebut adalah no-op senyap (best effort,
    // kegagalan update watermark tidak boleh menggagalkan import yang sudah
    // berhasil diproses).
    await withCurrentUser(actingUserId, (tx) =>
      tx.workspaceConnectedAccount.updateMany({
        where: { id: connectedAccountId },
        data: {
          ...(lastImportedUntil !== undefined ? { lastImportedUntil } : {}),
          ...(lastImportRequestedAt !== undefined
            ? { lastImportRequestedAt }
            : {}),
        },
      }),
    );
  },
};

/** Row shape returned by the raw SQL call above — snake_case, mirrors the SQL function's RETURNS TABLE. */
interface AccountOwnerLookupRow {
  workspace_id: string;
  connected_account_id: string;
  owner_user_id: string;
  /**
   * `WorkspaceConnectedAccount.status` (T-051 fix, migration
   * `20260922110000_t051_filter_active_status_engagement_sync_lookup`) —
   * ditambahkan sebagai kolom output SQL function, TIDAK mengubah SELECT-nya
   * (masih mengembalikan akun status apa pun). Konsumen yang butuh guard
   * status (`findAccountOwnerByOutstandAccountId`) memeriksa field ini
   * sendiri; `markAccountReconnectRequired` mengabaikannya (behavior tidak
   * berubah).
   */
  status: string;
  /**
   * `WorkspaceConnectedAccount.reconnectRequired` — flag terpisah dari
   * `status` (token expired bisa terjadi sambil `status` masih `active`,
   * lihat `markAccountReconnectRequired`). `findAccountOwnerByOutstandAccountId`
   * ikut memeriksa ini supaya JOB-03 tidak terus sync akun yang butuh
   * reconnect.
   */
  reconnect_required: boolean;
  /**
   * Redesain KI-068/ADR-113 — kolom baru (migration
   * `20260924090000_ki068_add_handle_to_account_owner_lookup`), dipakai
   * `findAccountOwnerByOutstandAccountId` untuk menyuplai `accountUsername`
   * ke `SyncCommentsUseCase`. `markAccountReconnectRequired` mengabaikannya
   * (behavior tidak berubah).
   */
  handle: string;
}

/**
 * Helper bersama `markAccountReconnectRequired` (T-026.5) DAN
 * `findAccountOwnerByOutstandAccountId` (T-051, JOB-03) — keduanya butuh
 * lookup identik (SECURITY DEFINER SQL function
 * `webhook_find_account_owner_by_outstand_account_id`), beda hanya di
 * langkah SETELAHNYA (satu menulis `reconnectRequired`, satu lagi murni
 * baca). Diekstrak supaya guard "outstand_account_id cocok >1 workspace"
 * tidak diduplikasi.
 */
async function lookupAccountOwnerByOutstandAccountId(
  outstandAccountId: string,
): Promise<{
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  ownerUserId: UserId;
  status: string;
  reconnectRequired: boolean;
  handle: string;
} | null> {
  const rows = await prisma.$queryRaw<AccountOwnerLookupRow[]>`
    SELECT * FROM "public"."webhook_find_account_owner_by_outstand_account_id"(${outstandAccountId})
  `;

  if (rows.length === 0) {
    return null;
  }

  // `outstand_account_id` cuma unique PER WORKSPACE — kalau akun yang sama
  // kebetulan ter-connect di lebih dari satu workspace (skenario agency),
  // fungsi SQL di atas mengembalikan SEMUA baris (tidak lagi `LIMIT 1`).
  // Jangan tebak salah satu secara diam-diam — refuse dan biarkan caller
  // menandai kegagalan (defense-in-depth yang sama dengan guard di
  // `publishingRepository.findPostTargetsByOutstandPostId`).
  const distinctWorkspaceIds = new Set(rows.map((row) => row.workspace_id));
  if (distinctWorkspaceIds.size > 1) {
    throw new Error(
      `lookupAccountOwnerByOutstandAccountId: outstandAccountId=${outstandAccountId} cocok dengan ${distinctWorkspaceIds.size} workspace berbeda — menolak menebak salah satu.`,
    );
  }

  const [row] = rows;
  return {
    workspaceId: asWorkspaceId(row.workspace_id),
    connectedAccountId: asConnectedAccountId(row.connected_account_id),
    ownerUserId: asUserId(row.owner_user_id),
    status: row.status,
    reconnectRequired: row.reconnect_required,
    handle: row.handle,
  };
}
