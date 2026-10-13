import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { prisma as prismaClient } from "@/lib/prisma/client";
import type { withCurrentUser as withCurrentUserFn } from "@/lib/prisma/with-current-user";

/**
 * Eskalasi review Ridwan Architecture Reviewer (T-050/T-051/T-052) —
 * `WorkspaceService.disconnectAccount` tidak pernah membatalkan chain
 * self-reschedule `engagement.sync` (JOB-03) yang sedang berjalan untuk
 * akun itu: tidak ada mekanisme cancel/deleteByCriteria di `IJobScheduler`/
 * `background-job-store.ts`, dan lookup SQL yang dipakai
 * `EngagementSyncJobHandler` (`webhook_find_account_owner_by_outstand_account_id`)
 * sebelumnya sama sekali tidak memfilter status — job tetap sukses lanjut
 * sync untuk akun yang statusnya sudah `disconnected`. Digabung dengan
 * seeding chain BARU setiap reconnect (`EngagementSyncSeederPort`), siklus
 * disconnect→reconnect berulang menghasilkan chain paralel yang bertambah
 * tak terbatas.
 *
 * Fix (migration `20260922110000_t051_filter_active_status_engagement_sync_lookup`
 * + `findAccountOwnerByOutstandAccountId` di `workspace.repository.ts`):
 * akun berstatus BUKAN `active` diperlakukan sama seperti "akun tidak
 * ditemukan" — `EngagementSyncJobHandler.handle` (lihat test
 * `engagement-sync-job-handler.test.ts` § "throw (bukan self-reschedule)
 * kalau akun tidak ditemukan") sudah throw SEBELUM `sync()`/self-reschedule
 * untuk kasus ini, jadi tidak perlu mekanisme cancel job baru.
 *
 * Test ini adalah integration test terhadap Postgres REAL (bukan fake
 * repository) — memverifikasi lookup SQL-nya sendiri, bukan cuma logic
 * handler yang sudah ditest lewat fake port.
 */
const hasDb =
  Boolean(process.env.DATABASE_URL) && process.env.SKIP_ENV_VALIDATION !== "1";

describe.skipIf(!hasDb)(
  "WorkspaceRepository.findAccountOwnerByOutstandAccountId (T-051 fix)",
  () => {
    const suffix = randomUUID().slice(0, 8);
    const ownerId = `t051-test-owner-${suffix}`;
    const outstandAccountId = `t051-outstand-account-${suffix}`;

    let prisma: typeof prismaClient;
    let withCurrentUser: typeof withCurrentUserFn;
    let workspaceId: string | null = null;

    afterAll(async () => {
      if (workspaceId && prisma) {
        await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      }
    });

    it("returns the owner lookup while the account is active, then returns null (same as 'not found') once disconnected — closing the JOB-03 self-reschedule leak", async () => {
      ({ prisma } = await import("@/lib/prisma/client"));
      ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
      const { workspaceRepository } = await import("./workspace.repository");

      const workspace = await prisma.workspace.create({
        data: {
          name: `T-051 Engagement Sync Lookup Test ${suffix}`,
          slug: `t051-engagement-sync-lookup-test-${suffix}`,
          ownerId,
        },
      });
      workspaceId = workspace.id;

      await withCurrentUser(ownerId, (tx) =>
        tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: ownerId,
            role: "owner",
            status: "active",
            joinedAt: new Date(),
          },
        }),
      );

      const connectedAccount = await withCurrentUser(ownerId, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId: workspace.id,
            platform: "instagram",
            outstandAccountId,
            handle: `t051-handle-${suffix}`,
            status: "active",
          },
        }),
      );

      // Sebelum disconnect: lookup harus resolve — persis payload yang
      // dibutuhkan `EngagementSyncJobHandler` untuk lanjut sync.
      const beforeDisconnect =
        await workspaceRepository.findAccountOwnerByOutstandAccountId(
          outstandAccountId,
        );
      expect(beforeDisconnect).not.toBeNull();
      expect(beforeDisconnect?.workspaceId).toBe(workspace.id);
      expect(beforeDisconnect?.connectedAccountId).toBe(connectedAccount.id);
      expect(beforeDisconnect?.ownerUserId).toBe(ownerId);

      // Simulasikan disconnect (jalur yang sama dipakai
      // `WorkspaceService.disconnectAccount`).
      await workspaceRepository.disconnectAccount(
        workspace.id as never,
        connectedAccount.id as never,
        ownerId as never,
      );

      // Setelah disconnect: job berikutnya untuk `outstandAccountId` yang
      // SAMA tidak lagi menemukan akun ini — sama seperti "tidak ditemukan",
      // sehingga `EngagementSyncJobHandler.handle` throw sebelum sync/
      // self-reschedule (lihat unit test handler untuk assersi itu).
      const afterDisconnect =
        await workspaceRepository.findAccountOwnerByOutstandAccountId(
          outstandAccountId,
        );
      expect(afterDisconnect).toBeNull();
    });
  },
);
