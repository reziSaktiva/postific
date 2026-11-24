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

import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * T-291 item 2 on a real Postgres: `analyticsRepository.findBestTimeSamples`
 * (raw SQL) returns one row per (post, account) with publish time,
 * engagement rate and reach, for `published` AND `imported` posts in the
 * window only, without soft-deleted posts, other statuses or other
 * workspaces, and nothing for a non-member (RLS through `withCurrentUser`).
 *
 * Opt-in like the other DB integration tests: needs a real `DATABASE_URL`
 * AND `ANALYTICS_DB_TEST=1`; otherwise the suite is skipped. Fixtures use a
 * random suffix, are removed in `afterAll` through the workspace cascade, and
 * the test FAILS when anything is left. No real workspace, no Outstand call.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.ANALYTICS_DB_TEST === "1";

describe.skipIf(!enabled)("findBestTimeSamples (Postgres, T-291)", () => {
  const suffix = randomUUID().slice(0, 8);
  const prefix = `t-best-time-${suffix}`;
  const owner: UserId = asUserId(`${prefix}-owner`);
  const otherOwner: UserId = asUserId(`${prefix}-other-owner`);

  let prisma: typeof prismaClient;
  let withCurrentUser: typeof import("@/lib/prisma/with-current-user").withCurrentUser;
  let analyticsRepository: typeof import("@/lib/repositories/analytics").analyticsRepository;
  let wsA: WorkspaceId;
  let wsB: WorkspaceId;
  let instagram: string;
  let facebook: string;
  let foreign: string;

  const since = new Date(Date.UTC(2026, 8, 1));
  const until = new Date(Date.UTC(2026, 10, 30));
  const day = (n: number, hour = 9) => new Date(Date.UTC(2026, 8, 1 + n, hour));

  async function createPost(options: {
    workspace: WorkspaceId;
    actor: UserId;
    status: string;
    publishedAt: Date | null;
    deletedAt?: Date;
    metrics: {
      accountId: string;
      platform: SocialPlatform;
      engagementRate: string;
      reach: number;
    }[];
  }) {
    return withCurrentUser(options.actor, async (tx) => {
      const post = await tx.publishingPost.create({
        data: {
          workspaceId: options.workspace,
          authorId:
            options.status === ContentStatus.Imported ? null : options.actor,
          status: options.status,
          publishedAt: options.publishedAt,
          deletedAt: options.deletedAt ?? null,
          targets: {
            create: options.metrics.map((metric) => ({
              connectedAccountId: metric.accountId,
              platform: metric.platform,
              status: "published",
            })),
          },
        },
      });
      for (const metric of options.metrics) {
        await tx.analyticsPostMetric.create({
          data: {
            postId: post.id,
            connectedAccountId: metric.accountId,
            platform: metric.platform,
            reach: metric.reach,
            engagementRate: metric.engagementRate,
            fetchedAt: new Date(),
          },
        });
      }
      return post.id;
    });
  }

  const samples = (workspace: WorkspaceId, actor: UserId) =>
    analyticsRepository.findBestTimeSamples(workspace, { since, until }, actor);

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma/client"));
    ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
    ({ analyticsRepository } = await import("@/lib/repositories/analytics"));

    const a = await prisma.workspace.create({
      data: {
        name: `T-BESTTIME-DB-TEST ${suffix} A`,
        slug: `${prefix}-a`,
        ownerId: owner,
      },
    });
    const b = await prisma.workspace.create({
      data: {
        name: `T-BESTTIME-DB-TEST ${suffix} B`,
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
    instagram = await account(a.id, owner, SocialPlatform.Instagram, "ig");
    facebook = await account(a.id, owner, SocialPlatform.Facebook, "fb");
    foreign = await account(b.id, otherOwner, SocialPlatform.Instagram, "x");
  });

  // Each test seeds its own posts.
  // Deleted as each workspace's owner: posts sit behind RLS.
  beforeEach(async () => {
    for (const [workspaceId, actor] of [
      [wsA, owner],
      [wsB, otherOwner],
    ] as const) {
      await withCurrentUser(actor, (tx) =>
        tx.publishingPost.deleteMany({ where: { workspaceId } }),
      );
    }
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    const ids = [wsA, wsB].filter(Boolean);
    if (ids.length > 0) {
      // FK cascade: members, accounts, posts, targets, metrics.
      await prisma.workspace.deleteMany({ where: { id: { in: ids } } });
    }
    const [workspaces, members, accounts, posts] = await Promise.all([
      prisma.workspace.count({
        where: { name: { startsWith: `T-BESTTIME-DB-TEST ${suffix}` } },
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
    console.info(`[best-time-db-test ${suffix}] leftover test data:`, leftover);
    expect(Object.values(leftover).every((count) => count === 0)).toBe(true);
  });

  it("returns published and imported posts in the window, one row per account, oldest first", async () => {
    await createPost({
      workspace: wsA,
      actor: owner,
      status: ContentStatus.Imported,
      publishedAt: day(10, 14),
      metrics: [
        {
          accountId: instagram,
          platform: SocialPlatform.Instagram,
          engagementRate: "0.0525",
          reach: 900,
        },
      ],
    });
    await createPost({
      workspace: wsA,
      actor: owner,
      status: ContentStatus.Published,
      publishedAt: day(3, 9),
      metrics: [
        {
          accountId: instagram,
          platform: SocialPlatform.Instagram,
          engagementRate: "0.0310",
          reach: 400,
        },
        {
          accountId: facebook,
          platform: SocialPlatform.Facebook,
          engagementRate: "0.0100",
          reach: 120,
        },
      ],
    });

    const rows = await samples(wsA, owner);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.publishedAt.toISOString())).toEqual([
      day(3, 9).toISOString(),
      day(3, 9).toISOString(),
      day(10, 14).toISOString(),
    ]);
    expect(rows).toContainEqual({
      connectedAccountId: instagram,
      platform: SocialPlatform.Instagram,
      publishedAt: day(10, 14),
      engagementRate: 0.0525,
      reach: 900,
    });
    expect(rows).toContainEqual({
      connectedAccountId: facebook,
      platform: SocialPlatform.Facebook,
      publishedAt: day(3, 9),
      engagementRate: 0.01,
      reach: 120,
    });
  });

  it("leaves out other statuses, soft-deleted posts and posts outside the window", async () => {
    const metric = [
      {
        accountId: instagram,
        platform: SocialPlatform.Instagram,
        engagementRate: "0.0400",
        reach: 300,
      },
    ];
    await createPost({
      workspace: wsA,
      actor: owner,
      status: ContentStatus.Published,
      publishedAt: day(20),
      metrics: metric,
    });
    for (const status of [
      ContentStatus.Draft,
      ContentStatus.Scheduled,
      ContentStatus.Failed,
    ]) {
      await createPost({
        workspace: wsA,
        actor: owner,
        status,
        publishedAt: day(21),
        metrics: metric,
      });
    }
    await createPost({
      workspace: wsA,
      actor: owner,
      status: ContentStatus.Published,
      publishedAt: day(22),
      deletedAt: day(23),
      metrics: metric,
    });
    await createPost({
      workspace: wsA,
      actor: owner,
      status: ContentStatus.Imported,
      publishedAt: new Date(since.getTime() - 60_000),
      metrics: metric,
    });
    await createPost({
      workspace: wsA,
      actor: owner,
      status: ContentStatus.Published,
      publishedAt: new Date(until.getTime() + 60_000),
      metrics: metric,
    });

    const rows = await samples(wsA, owner);
    expect(rows).toHaveLength(1);
    expect(rows[0].publishedAt).toEqual(day(20));
  });

  it("does not leak another workspace, and a non-member sees nothing (RLS)", async () => {
    await createPost({
      workspace: wsA,
      actor: owner,
      status: ContentStatus.Published,
      publishedAt: day(5),
      metrics: [
        {
          accountId: instagram,
          platform: SocialPlatform.Instagram,
          engagementRate: "0.0200",
          reach: 200,
        },
      ],
    });
    await createPost({
      workspace: wsB,
      actor: otherOwner,
      status: ContentStatus.Published,
      publishedAt: day(6),
      metrics: [
        {
          accountId: foreign,
          platform: SocialPlatform.Instagram,
          engagementRate: "0.0900",
          reach: 999,
        },
      ],
    });

    const a = await samples(wsA, owner);
    expect(a.map((row) => row.connectedAccountId)).toEqual([instagram]);
    const b = await samples(wsB, otherOwner);
    expect(b.map((row) => row.connectedAccountId)).toEqual([foreign]);
    // Owner A is not a member of B: RLS hides every post of B.
    await expect(samples(wsB, owner)).resolves.toEqual([]);
  });
});
