import {
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
  type IOutstandAdapter,
  type PostId,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/utils/errors";
import type { IEngagementRepository } from "../repositories/engagement.repository";
import type { EngagementInboxItemRecord, InboxAggregateFilter } from "../types";
import { EngagementService } from "./engagement.service";

const WS = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const ACC_IG = asConnectedAccountId("acc-ig");
const ACC_FB = asConnectedAccountId("acc-fb");
const NOW = new Date("2026-11-06T00:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

let seq = 0;
function item(
  overrides: Partial<EngagementInboxItemRecord>,
): EngagementInboxItemRecord {
  seq += 1;
  return {
    id: `item-${seq}` as EngagementInboxItemRecord["id"],
    workspaceId: WS,
    connectedAccountId: ACC_IG,
    platform: SocialPlatform.Instagram,
    type: "comment",
    externalId: `ext-${seq}`,
    authorHandle: "@a",
    content: "hi",
    status: "unread",
    postId: null,
    receivedAt: day(1),
    readAt: null,
    createdAt: day(1),
    updatedAt: day(1),
    ...overrides,
  };
}

/** Repository double: mengagregasi tabel item seperti `GROUP BY` di database. */
function repositoryOver(items: EngagementInboxItemRecord[]) {
  const calls: InboxAggregateFilter[] = [];
  const repository = {
    aggregateInboxByPost: async (filter: InboxAggregateFilter) => {
      calls.push(filter);
      const rows = new Map<string, import("../types").InboxAggregateRow>();
      for (const it of items) {
        if (it.workspaceId !== filter.workspaceId) continue;
        if (
          filter.connectedAccountId &&
          it.connectedAccountId !== filter.connectedAccountId
        )
          continue;
        if (filter.platform && it.platform !== filter.platform) continue;
        if (filter.receivedSince && it.receivedAt < filter.receivedSince)
          continue;
        const key = [
          it.postId,
          it.connectedAccountId,
          it.platform,
          it.status,
        ].join("|");
        const existing = rows.get(key);
        if (existing) {
          existing.count += 1;
          if (it.receivedAt > existing.latestReceivedAt)
            existing.latestReceivedAt = it.receivedAt;
        } else {
          rows.set(key, {
            postId: it.postId,
            connectedAccountId: it.connectedAccountId,
            platform: it.platform,
            status: it.status,
            count: 1,
            latestReceivedAt: it.receivedAt,
          });
        }
      }
      return [...rows.values()];
    },
  } as unknown as IEngagementRepository;
  return { repository, calls };
}

function makeService(
  items: EngagementInboxItemRecord[],
  opts: {
    snapshots?: Record<
      string,
      {
        caption: string;
        mediaIds: ReturnType<typeof asMediaId>[];
        platformPostUrl: string | null;
      }
    >;
    syncable?: Record<string, PostId[]>;
  } = {},
) {
  const { repository, calls } = repositoryOver(items);
  const service = new EngagementService(
    repository,
    {} as IOutstandAdapter,
    {
      findPostOutstandId: async () => null,
      findPostSnapshotForEngagement: async ({ postId }: { postId: PostId }) =>
        opts.snapshots?.[postId] ?? null,
      listSyncablePostsByConnectedAccount: async ({
        connectedAccountId,
      }: {
        connectedAccountId: string;
      }) =>
        (opts.syncable?.[connectedAccountId] ?? []).map((postId) => ({
          postId,
          outstandPostId: `o-${postId}`,
          platform:
            connectedAccountId === ACC_FB
              ? SocialPlatform.Facebook
              : SocialPlatform.Instagram,
        })),
    },
    {
      listConnectedAccounts: async () => [
        { id: ACC_IG, platform: SocialPlatform.Instagram },
        { id: ACC_FB, platform: SocialPlatform.Facebook },
      ],
      findConnectedAccountById: async () => ({ handle: "@x" }),
    },
  );
  return { service, calls };
}

const P1 = asPostId("post-1");
const P2 = asPostId("post-2");
const P3 = asPostId("post-3");

describe("EngagementService.listInboxByPost", () => {
  it("mengelompokkan per posting dengan hitungan dan snapshot, kelompok tanpa posting terpisah", async () => {
    const { service } = makeService(
      [
        item({ postId: P1, status: "unread" }),
        item({ postId: P1, status: "resolved", receivedAt: day(3) }),
        item({ postId: P1, status: "replied", receivedAt: day(4) }),
        item({ postId: null, status: "unread" }),
      ],
      {
        snapshots: {
          [P1]: {
            caption: "Caption satu",
            mediaIds: [asMediaId("m1")],
            platformPostUrl: null,
          },
        },
      },
    );

    const groups = await service.listInboxByPost(
      { workspaceId: WS },
      USER,
      NOW,
    );

    const post = groups.find((g) => g.postId === P1);
    expect(post).toMatchObject({
      totalCount: 3,
      unrepliedCount: 1,
      handledCount: 2,
      latestReceivedAt: day(1),
      postSnapshot: { caption: "Caption satu" },
    });
    const none = groups.find((g) => g.postId === null);
    expect(none).toMatchObject({ totalCount: 1, postSnapshot: null });
  });

  it("urutan bawaan menaruh posting dengan komentar belum dibalas terbanyak lebih dulu", async () => {
    const { service } = makeService([
      item({ postId: P1, receivedAt: day(1) }),
      item({ postId: P2, receivedAt: day(5) }),
      item({ postId: P2, receivedAt: day(6) }),
      item({ postId: P3, status: "resolved", receivedAt: day(0.5) }),
    ]);

    const groups = await service.listInboxByPost(
      { workspaceId: WS },
      USER,
      NOW,
    );
    expect(groups.map((g) => g.postId)).toEqual([P2, P1, P3]);

    const newest = await service.listInboxByPost(
      { workspaceId: WS, sort: "newest" },
      USER,
      NOW,
    );
    expect(newest.map((g) => g.postId)).toEqual([P3, P1, P2]);
    const oldest = await service.listInboxByPost(
      { workspaceId: WS, sort: "oldest" },
      USER,
      NOW,
    );
    expect(oldest.map((g) => g.postId)).toEqual([P2, P1, P3]);
  });

  it("rentang tanggal atas receivedAt: bawaan 12 bulan, komentar di luar rentang tidak dihitung", async () => {
    const { service } = makeService([
      item({ postId: P1, receivedAt: day(2) }),
      item({ postId: P1, receivedAt: day(20) }),
      item({ postId: P2, receivedAt: day(400) }),
    ]);

    const week = await service.listInboxByPost(
      { workspaceId: WS, dateRange: "7d" },
      USER,
      NOW,
    );
    expect(week.map((g) => [g.postId, g.totalCount])).toEqual([[P1, 1]]);

    const month = await service.listInboxByPost(
      { workspaceId: WS, dateRange: "30d" },
      USER,
      NOW,
    );
    expect(month[0].totalCount).toBe(2);

    const byDefault = await service.listInboxByPost(
      { workspaceId: WS },
      USER,
      NOW,
    );
    expect(byDefault.map((g) => g.postId)).toEqual([P1]);
  });

  it("filter akun dan platform membatasi komentar yang dihitung", async () => {
    const { service } = makeService([
      item({ postId: P1, connectedAccountId: ACC_IG }),
      item({
        postId: P1,
        connectedAccountId: ACC_FB,
        platform: SocialPlatform.Facebook,
      }),
      item({
        postId: P2,
        connectedAccountId: ACC_FB,
        platform: SocialPlatform.Facebook,
      }),
    ]);

    const byAccount = await service.listInboxByPost(
      { workspaceId: WS, connectedAccountId: ACC_IG },
      USER,
      NOW,
    );
    expect(byAccount.map((g) => [g.postId, g.totalCount])).toEqual([[P1, 1]]);

    const byPlatform = await service.listInboxByPost(
      { workspaceId: WS, platform: SocialPlatform.Facebook },
      USER,
      NOW,
    );
    expect(byPlatform.map((g) => g.postId).sort()).toEqual([P1, P2]);
  });

  it("filter status hanya menampilkan posting yang punya komentar berstatus itu, hitungan tetap lengkap", async () => {
    const { service } = makeService([
      item({ postId: P1, status: "unread" }),
      item({ postId: P1, status: "resolved" }),
      item({ postId: P2, status: "resolved" }),
    ]);

    const groups = await service.listInboxByPost(
      { workspaceId: WS, status: "unread" },
      USER,
      NOW,
    );
    expect(groups.map((g) => [g.postId, g.totalCount])).toEqual([[P1, 2]]);
  });

  it("posting tanpa komentar disembunyikan bawaan dan muncul dengan includeEmpty", async () => {
    const { service } = makeService([item({ postId: P1 })], {
      syncable: { [ACC_IG]: [P1, P2], [ACC_FB]: [P3] },
    });

    const hidden = await service.listInboxByPost(
      { workspaceId: WS },
      USER,
      NOW,
    );
    expect(hidden.map((g) => g.postId)).toEqual([P1]);

    const all = await service.listInboxByPost(
      { workspaceId: WS, includeEmpty: true },
      USER,
      NOW,
    );
    expect(all.map((g) => g.postId)).toEqual([P1, P2, P3]);
    expect(all.find((g) => g.postId === P2)).toMatchObject({
      totalCount: 0,
      latestReceivedAt: null,
      connectedAccountId: ACC_IG,
    });

    const fbOnly = await service.listInboxByPost(
      { workspaceId: WS, includeEmpty: true, connectedAccountId: ACC_FB },
      USER,
      NOW,
    );
    expect(fbOnly.map((g) => g.postId)).toEqual([P3]);
  });

  it("menolak sort, rentang tanggal, atau status yang tidak dikenal", async () => {
    const { service } = makeService([]);
    await expect(
      service.listInboxByPost(
        { workspaceId: WS, sort: "random" as never },
        USER,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.listInboxByPost(
        { workspaceId: WS, dateRange: "3y" as never },
        USER,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.listInboxByPost(
        { workspaceId: WS, status: "done" as never },
        USER,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
