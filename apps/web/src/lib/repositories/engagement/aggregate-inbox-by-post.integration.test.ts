import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  MemberRole,
  MemberStatus,
  SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * Bukti T-218.5 di Postgres sungguhan: `aggregateInboxByPost` (GROUP BY
 * posting/akun/platform/status), filter `postId`/`receivedSince` pada
 * `listInboxItems`, isolasi workspace, dan RLS lewat `withCurrentUser`. Tes
 * unit hanya memakai tabel in-memory; di sini yang diuji SQL-nya.
 *
 * Opt-in ganda seperti tes integrasi lain: butuh `DATABASE_URL` sungguhan DAN
 * `ENGAGEMENT_DB_TEST=1`; tanpa itu seluruh suite di-skip. Fixture memakai
 * suffix acak, dihapus di `afterAll` lewat cascade workspace, dan tes GAGAL
 * bila ada sisa. Tidak memanggil Outstand.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.ENGAGEMENT_DB_TEST === "1";

describe.skipIf(!enabled)("engagement per posting (Postgres, T-218.5)", () => {
  const suffix = randomUUID().slice(0, 8);
  const prefix = `t-eng-post-${suffix}`;
  const owner: UserId = asUserId(`${prefix}-owner`);
  const otherOwner: UserId = asUserId(`${prefix}-other-owner`);

  let prisma: typeof prismaClient;
  let repo: typeof import("./engagement.repository").engagementRepository;
  let wsA: WorkspaceId;
  let wsB: WorkspaceId;
  let igId: string;
  let fbId: string;
  let foreignId: string;

  const post1 = randomUUID();
  const post2 = randomUUID();
  const at = (iso: string) => new Date(iso);
  let externalSeq = 0;

  async function comment(options: {
    workspace: WorkspaceId;
    account: string;
    platform: SocialPlatform;
    postId: string | null;
    status?: string;
    receivedAt: Date;
  }) {
    externalSeq += 1;
    await prisma.engagementInboxItem.create({
      data: {
        workspaceId: options.workspace,
        connectedAccountId: options.account,
        platform: options.platform,
        externalId: `${prefix}-${externalSeq}`,
        authorHandle: "@tester",
        content: "komentar uji",
        status: options.status ?? "unread",
        postId: options.postId,
        receivedAt: options.receivedAt,
      },
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma/client"));
    ({ engagementRepository: repo } = await import("./engagement.repository"));

    const a = await prisma.workspace.create({
      data: {
        name: `T-ENGPOST-DB-TEST ${suffix} A`,
        slug: `${prefix}-a`,
        ownerId: owner,
      },
    });
    const b = await prisma.workspace.create({
      data: {
        name: `T-ENGPOST-DB-TEST ${suffix} B`,
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
      platform: SocialPlatform,
      key: string,
    ) =>
      prisma.workspaceConnectedAccount
        .create({
          data: {
            workspaceId,
            platform,
            outstandAccountId: `${prefix}-${key}`,
            handle: `${prefix}-${key}`,
          },
        })
        .then((row) => row.id);
    igId = await account(a.id, SocialPlatform.Instagram, "ig");
    fbId = await account(a.id, SocialPlatform.Facebook, "fb");
    foreignId = await account(b.id, SocialPlatform.Instagram, "foreign");
  });

  beforeEach(async () => {
    await prisma.engagementInboxItem.deleteMany({
      where: { workspaceId: { in: [wsA, wsB] } },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    const ids = [wsA, wsB].filter(Boolean);
    if (ids.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: ids } } });
    }
    const [workspaces, members, accounts, items] = await Promise.all([
      prisma.workspace.count({
        where: { name: { startsWith: `T-ENGPOST-DB-TEST ${suffix}` } },
      }),
      prisma.workspaceMember.count({
        where: { userId: { startsWith: prefix } },
      }),
      prisma.workspaceConnectedAccount.count({
        where: { outstandAccountId: { startsWith: prefix } },
      }),
      prisma.engagementInboxItem.count({ where: { workspaceId: { in: ids } } }),
    ]);
    const leftover = { workspaces, members, accounts, items };
    console.info(
      `[engagement-post-db-test ${suffix}] sisa data uji:`,
      leftover,
    );
    expect(Object.values(leftover).every((count) => count === 0)).toBe(true);
  });

  it("mengelompokkan per posting dan status dengan jumlah dan komentar terbaru", async () => {
    const ig = SocialPlatform.Instagram;
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-03T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      status: "resolved",
      receivedAt: at("2026-10-02T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: null,
      receivedAt: at("2026-10-04T00:00:00Z"),
    });
    await comment({
      workspace: wsB,
      account: foreignId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-05T00:00:00Z"),
    });

    const rows = await repo.aggregateInboxByPost({ workspaceId: wsA }, owner);

    const unread = rows.find(
      (r) => r.postId === post1 && r.status === "unread",
    );
    expect(unread).toMatchObject({
      count: 2,
      latestReceivedAt: at("2026-10-03T00:00:00Z"),
    });
    expect(
      rows.find((r) => r.postId === post1 && r.status === "resolved")?.count,
    ).toBe(1);
    expect(rows.find((r) => r.postId === null)?.count).toBe(1);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(4);
  });

  it("memfilter akun, platform, dan rentang tanggal atas receivedAt", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: SocialPlatform.Instagram,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: SocialPlatform.Instagram,
      postId: post1,
      receivedAt: at("2026-05-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: fbId,
      platform: SocialPlatform.Facebook,
      postId: post2,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });

    const byAccount = await repo.aggregateInboxByPost(
      {
        workspaceId: wsA,
        connectedAccountId: asConnectedAccountId(igId),
        receivedSince: at("2026-09-01T00:00:00Z"),
      },
      owner,
    );
    expect(byAccount).toHaveLength(1);
    expect(byAccount[0].count).toBe(1);

    const byPlatform = await repo.aggregateInboxByPost(
      { workspaceId: wsA, platform: SocialPlatform.Facebook },
      owner,
    );
    expect(byPlatform.map((r) => r.postId)).toEqual([post2]);
  });

  it("listInboxItems memfilter satu posting dan kelompok tanpa posting", async () => {
    const ig = SocialPlatform.Instagram;
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post2,
      receivedAt: at("2026-10-02T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: null,
      receivedAt: at("2026-10-03T00:00:00Z"),
    });

    const one = await repo.listInboxItems(
      { workspaceId: wsA, postId: post1 as never },
      owner,
    );
    expect(one.map((i) => i.postId)).toEqual([post1]);
    const none = await repo.listInboxItems(
      { workspaceId: wsA, postId: null },
      owner,
    );
    expect(none.map((i) => i.postId)).toEqual([null]);
    const all = await repo.listInboxItems({ workspaceId: wsA }, owner);
    expect(all).toHaveLength(3);
  });

  it("RLS: user yang bukan member tidak melihat data workspace lain", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: SocialPlatform.Instagram,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    const rows = await repo.aggregateInboxByPost(
      { workspaceId: wsA },
      otherOwner,
    );
    expect(rows).toEqual([]);
  });
});
