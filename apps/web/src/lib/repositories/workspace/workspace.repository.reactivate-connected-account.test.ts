import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { prisma as prismaClient } from "@/lib/prisma/client";
import type { withCurrentUser as withCurrentUserFn } from "@/lib/prisma/with-current-user";

/**
 * KI-086/ADR-127 — `WorkspaceRepository.createConnectedAccounts` (dipakai
 * `WorkspaceService.confirmFacebookPagesConnection`, flow "Connect Account"
 * multi-Page Facebook) sebelumnya mencocokkan row existing HANYA lewat
 * `outstandAccountId`, mengabaikan `status` — row `disconnected`/
 * `reconnect-required` di-skip diam-diam, identik dengan row yang sudah
 * `active`. Akibatnya reconnect Facebook via jalur ini genuinely dead:
 * user memilih ulang Page yang sama, tidak ada error, tapi row tetap
 * `disconnected`.
 *
 * Fix: lookup existing juga ambil `id`+`status`; row yang BUKAN `active`
 * di-UPDATE (reaktivasi: `status: "active"`, `reconnectRequired: false`,
 * refresh `handle`/`avatarUrl`) alih-alih di-skip. Hanya row yang SUDAH
 * `active` yang tetap di-skip (behavior lama, tidak berubah).
 *
 * Test ini adalah integration test terhadap Postgres REAL (bukan fake
 * repository, rule 19 AGENTS.md) — memverifikasi logic reaktivasi di
 * repository langsung, pola sama `workspace.repository.engagement-sync-
 * lookup.test.ts`.
 */
const hasDb =
  Boolean(process.env.DATABASE_URL) && process.env.SKIP_ENV_VALIDATION !== "1";

describe.skipIf(!hasDb)(
  "WorkspaceRepository.createConnectedAccounts (KI-086 reactivation fix)",
  () => {
    const suffix = randomUUID().slice(0, 8);
    const ownerId = `ki086-test-owner-${suffix}`;

    let prisma: typeof prismaClient;
    let withCurrentUser: typeof withCurrentUserFn;
    let workspaceId: string | null = null;

    afterAll(async () => {
      if (workspaceId && prisma) {
        await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      }
    });

    it("reactivates a disconnected row instead of skipping it, but still skips a row that is already active", async () => {
      ({ prisma } = await import("@/lib/prisma/client"));
      ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
      const { workspaceRepository } = await import("./workspace.repository");

      const workspace = await prisma.workspace.create({
        data: {
          name: `KI-086 Reactivate Connected Account Test ${suffix}`,
          slug: `ki086-reactivate-connected-account-test-${suffix}`,
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

      const disconnectedOutstandId = `ki086-disconnected-${suffix}`;
      const activeOutstandId = `ki086-active-${suffix}`;

      const disconnectedRow = await withCurrentUser(ownerId, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId: workspace.id,
            platform: "facebook",
            outstandAccountId: disconnectedOutstandId,
            handle: `ki086-old-handle-${suffix}`,
            status: "disconnected",
            reconnectRequired: false,
          },
        }),
      );
      const activeRow = await withCurrentUser(ownerId, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId: workspace.id,
            platform: "facebook",
            outstandAccountId: activeOutstandId,
            handle: `ki086-active-handle-${suffix}`,
            status: "active",
          },
        }),
      );

      const result = await workspaceRepository.createConnectedAccounts({
        workspaceId: workspace.id as never,
        actingUserId: ownerId as never,
        accounts: [
          {
            platform: "facebook" as never,
            outstandAccountId: disconnectedOutstandId,
            handle: `ki086-new-handle-${suffix}`,
            avatarUrl: "https://example.test/avatar.png",
          },
          {
            platform: "facebook" as never,
            outstandAccountId: activeOutstandId,
            // Row sudah active — tetap harus di-skip walau handle/avatar beda.
            handle: `ki086-should-not-overwrite-${suffix}`,
            avatarUrl: "https://example.test/should-not-apply.png",
          },
        ],
      });

      // Row disconnected: direaktivasi (BUKAN di-skip, BUKAN create baru —
      // id harus tetap sama dengan row lama).
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(disconnectedRow.id);
      expect(result[0]?.status).toBe("active");
      expect(result[0]?.handle).toBe(`ki086-new-handle-${suffix}`);
      expect(result[0]?.avatarUrl).toBe("https://example.test/avatar.png");

      // RLS `FOR ALL` di tabel ini mensyaratkan `app.current_user_id` —
      // baca lewat `withCurrentUser` (pola sama query lain di test ini),
      // bukan `prisma` plain yang tidak melewati context itu.
      const reactivated = await withCurrentUser(ownerId, (tx) =>
        tx.workspaceConnectedAccount.findUnique({
          where: { id: disconnectedRow.id },
        }),
      );
      expect(reactivated?.status).toBe("active");
      expect(reactivated?.reconnectRequired).toBe(false);

      // Row active: tetap di-skip, data lama tidak tertimpa.
      const untouched = await withCurrentUser(ownerId, (tx) =>
        tx.workspaceConnectedAccount.findUnique({
          where: { id: activeRow.id },
        }),
      );
      expect(untouched?.handle).toBe(`ki086-active-handle-${suffix}`);
    });
  },
);
