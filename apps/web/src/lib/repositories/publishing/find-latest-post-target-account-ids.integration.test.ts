import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asUserId,
  asWorkspaceId,
  ContentStatus,
  MemberRole,
  MemberStatus,
  SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import type { Prisma } from "@/generated/prisma/client";
import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * Bukti T-201.2 di Postgres sungguhan: pintasan "Terakhir dipakai" Draft
 * Editor memakai `publishingRepository.findLatestPostTargetAccountIds`. Tes
 * unit hanya memeriksa argumen `findFirst` dengan mock; di sini yang diuji
 * hasil SQL-nya (urutan `createdAt`, filter `Imported`, soft delete, post tanpa
 * target, isolasi workspace, RLS lewat `withCurrentUser`).
 *
 * Opt-in ganda seperti tes integrasi MCP: butuh `DATABASE_URL` sungguhan DAN
 * `PUBLISHING_DB_TEST=1`; tanpa itu seluruh suite di-skip. Semua fixture
 * (dua workspace, member, akun, post) memakai suffix acak, dihapus di
 * `afterAll` lewat cascade workspace, dan tes GAGAL bila ada sisa. Tidak
 * menyentuh workspace nyata dan tidak memanggil Outstand.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.PUBLISHING_DB_TEST === "1";

describe.skipIf(!enabled)(
  "findLatestPostTargetAccountIds (Postgres, T-201.2)",
  () => {
    const suffix = randomUUID().slice(0, 8);
    const prefix = `t-last-used-${suffix}`;
    const owner: UserId = asUserId(`${prefix}-owner`);
    const teammate: UserId = asUserId(`${prefix}-teammate`);
    const otherOwner: UserId = asUserId(`${prefix}-other-owner`);

    let prisma: typeof prismaClient;
    let withCurrentUser: typeof import("@/lib/prisma/with-current-user").withCurrentUser;
    let publishingRepository: typeof import("@/lib/repositories/publishing").publishingRepository;
    let wsA: WorkspaceId;
    let wsB: WorkspaceId;
    let facebook: string;
    let instagram: string;
    let pinterest: string;
    let foreign: string;

    const base = Date.UTC(2026, 0, 1);
    /** `createdAt` deterministik: semakin besar `n`, semakin baru. */
    const at = (n: number) => new Date(base + n * 60_000);

    async function createPost(options: {
      workspace: WorkspaceId;
      actor: UserId;
      createdAt: Date;
      status?: string;
      deletedAt?: Date;
      accounts: { id: string; platform: SocialPlatform; delayMs?: number }[];
    }) {
      return withCurrentUser(options.actor, (tx: Prisma.TransactionClient) =>
        tx.publishingPost.create({
          data: {
            workspaceId: options.workspace,
            authorId:
              options.status === ContentStatus.Imported ? null : options.actor,
            status: options.status ?? ContentStatus.Draft,
            createdAt: options.createdAt,
            deletedAt: options.deletedAt ?? null,
            targets: {
              create: options.accounts.map((account, index) => ({
                connectedAccountId: account.id,
                platform: account.platform,
                // Urutan target = urutan `createdAt` target (kontrak query).
                createdAt: new Date(options.createdAt.getTime() + index * 1000),
              })),
            },
          },
        }),
      );
    }

    const latest = (workspace: WorkspaceId, actor: UserId) =>
      publishingRepository.findLatestPostTargetAccountIds(
        { workspaceId: workspace },
        actor,
      );

    beforeAll(async () => {
      ({ prisma } = await import("@/lib/prisma/client"));
      ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
      ({ publishingRepository } =
        await import("@/lib/repositories/publishing"));

      const a = await prisma.workspace.create({
        data: {
          name: `T-LASTUSED-DB-TEST ${suffix} A`,
          slug: `${prefix}-a`,
          ownerId: owner,
        },
      });
      const b = await prisma.workspace.create({
        data: {
          name: `T-LASTUSED-DB-TEST ${suffix} B`,
          slug: `${prefix}-b`,
          ownerId: otherOwner,
        },
      });
      wsA = asWorkspaceId(a.id);
      wsB = asWorkspaceId(b.id);

      const joinedAt = new Date();
      await prisma.workspaceMember.createMany({
        data: [
          {
            workspaceId: a.id,
            userId: owner,
            role: MemberRole.Owner,
            status: MemberStatus.Active,
            joinedAt,
          },
          {
            workspaceId: a.id,
            userId: teammate,
            role: MemberRole.Creator,
            status: MemberStatus.Active,
            joinedAt,
          },
          {
            workspaceId: b.id,
            userId: otherOwner,
            role: MemberRole.Owner,
            status: MemberStatus.Active,
            joinedAt,
          },
        ],
      });

      const account = (
        workspaceId: string,
        actor: UserId,
        platform: SocialPlatform,
        key: string,
      ) =>
        withCurrentUser(actor, (tx) =>
          tx.workspaceConnectedAccount.create({
            data: {
              workspaceId,
              platform,
              outstandAccountId: `${prefix}-${key}`,
              handle: `${prefix}-${key}`,
            },
          }),
        ).then((row) => row.id);
      facebook = await account(a.id, owner, SocialPlatform.Facebook, "fb");
      instagram = await account(a.id, owner, SocialPlatform.Instagram, "ig");
      pinterest = await account(a.id, owner, SocialPlatform.Pinterest, "pin");
      foreign = await account(
        b.id,
        otherOwner,
        SocialPlatform.Facebook,
        "foreign",
      );
    });

    // Tiap tes mandiri: post dikosongkan, tes menyiapkan sendiri datanya.
    beforeEach(async () => {
      await prisma.publishingPost.deleteMany({
        where: { workspaceId: { in: [wsA, wsB] } },
      });
    });

    afterAll(async () => {
      if (!prisma) {
        return;
      }
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length > 0) {
        // FK cascade: member, akun, post, target.
        await prisma.workspace.deleteMany({ where: { id: { in: ids } } });
      }
      const [workspaces, members, accounts, posts] = await Promise.all([
        prisma.workspace.count({
          where: { name: { startsWith: `T-LASTUSED-DB-TEST ${suffix}` } },
        }),
        prisma.workspaceMember.count({
          where: { userId: { startsWith: prefix } },
        }),
        prisma.workspaceConnectedAccount.count({
          where: { outstandAccountId: { startsWith: prefix } },
        }),
        prisma.publishingPost.count({ where: { workspaceId: { in: ids } } }),
      ]);
      const leftover = { workspaces, members, accounts, posts };
      console.info(`[last-used-db-test ${suffix}] sisa data uji:`, leftover);
      expect(Object.values(leftover).every((count) => count === 0)).toBe(true);
    });

    it("workspace tanpa post berisi target mengembalikan daftar kosong", async () => {
      await expect(latest(wsA, owner)).resolves.toEqual([]);
    });

    it("memilih post terbaru menurut createdAt dan mengembalikan akunnya menurut urutan target", async () => {
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(1),
        accounts: [{ id: facebook, platform: SocialPlatform.Facebook }],
      });
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(3),
        accounts: [
          { id: pinterest, platform: SocialPlatform.Pinterest },
          { id: instagram, platform: SocialPlatform.Instagram },
        ],
      });
      // Dibuat belakangan di tabel tetapi createdAt lebih tua: tidak menang.
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(2),
        accounts: [{ id: facebook, platform: SocialPlatform.Facebook }],
      });

      await expect(latest(wsA, owner)).resolves.toEqual([pinterest, instagram]);
    });

    it("post milik rekan dan berstatus apa pun (Scheduled) ikut dihitung", async () => {
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(1),
        accounts: [{ id: instagram, platform: SocialPlatform.Instagram }],
      });
      await createPost({
        workspace: wsA,
        actor: teammate,
        createdAt: at(10),
        status: ContentStatus.Scheduled,
        accounts: [{ id: facebook, platform: SocialPlatform.Facebook }],
      });
      await expect(latest(wsA, owner)).resolves.toEqual([facebook]);
    });

    it("post Imported yang lebih baru dilewati (createdAt-nya waktu sinkron)", async () => {
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(5),
        accounts: [{ id: facebook, platform: SocialPlatform.Facebook }],
      });
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(20),
        status: ContentStatus.Imported,
        accounts: [
          { id: instagram, platform: SocialPlatform.Instagram },
          { id: pinterest, platform: SocialPlatform.Pinterest },
        ],
      });
      await expect(latest(wsA, owner)).resolves.toEqual([facebook]);
    });

    it("post yang dihapus (soft delete) dan post tanpa target yang lebih baru dilewati", async () => {
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(5),
        accounts: [{ id: facebook, platform: SocialPlatform.Facebook }],
      });
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(30),
        deletedAt: at(31),
        accounts: [{ id: instagram, platform: SocialPlatform.Instagram }],
      });
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(32),
        accounts: [],
      });
      await expect(latest(wsA, owner)).resolves.toEqual([facebook]);
    });

    it("post workspace lain yang lebih baru tidak bocor, dan pemakai bukan member tidak melihat apa pun (RLS)", async () => {
      await createPost({
        workspace: wsA,
        actor: owner,
        createdAt: at(5),
        accounts: [{ id: facebook, platform: SocialPlatform.Facebook }],
      });
      await createPost({
        workspace: wsB,
        actor: otherOwner,
        createdAt: at(40),
        accounts: [{ id: foreign, platform: SocialPlatform.Facebook }],
      });
      await expect(latest(wsA, owner)).resolves.toEqual([facebook]);
      await expect(latest(wsB, otherOwner)).resolves.toEqual([foreign]);
      // Owner A bukan member B: konteks RLS menyembunyikan seluruh post B.
      await expect(latest(wsB, owner)).resolves.toEqual([]);
    });
  },
);
