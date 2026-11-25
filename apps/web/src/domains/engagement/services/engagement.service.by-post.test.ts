import {
  asConnectedAccountId,
  asPageCursor,
  asPostId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
  type CursorPage,
  type IOutstandAdapter,
  type PostId,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/utils/errors";
import type { IEngagementRepository } from "../repositories/engagement.repository";
import type {
  EngagementInboxItemRecord,
  InboxItemFilter,
  InboxItemsPageRequest,
  InboxPostGroupFilter,
  InboxPostGroupsPageRequest,
  InboxPostGroupSummary,
} from "../types";
import { EngagementService } from "./engagement.service";

/**
 * Service halaman daftar Engage (T-303, ADR-166): halaman kelompok posting
 * (posting berkomentar dari repository, lalu posting tanpa komentar, lalu
 * "Tanpa posting") dan halaman komentar. Repository adalah double lokal
 * (AGENTS.md aturan 11); pengelompokan SQL dan cursor-nya dibuktikan tes
 * integrasi repository.
 */

const WS = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const ACC_IG = asConnectedAccountId("00000000-0000-4000-8000-0000000000a1");
const ACC_FB = asConnectedAccountId("00000000-0000-4000-8000-0000000000b2");
const NOW = new Date("2026-11-06T00:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const postUuid = (n: number) =>
  asPostId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);

function summary(
  postId: PostId | null,
  overrides: Partial<InboxPostGroupSummary> = {},
): InboxPostGroupSummary {
  return {
    postId,
    connectedAccountId: ACC_IG,
    platform: SocialPlatform.Instagram,
    connectedAccountIds: [ACC_IG],
    totalCount: 2,
    unrepliedCount: 1,
    handledCount: 1,
    repliedCount: 0,
    latestReceivedAt: day(1),
    oldestReceivedAt: day(2),
    statuses: ["unread"],
    ...overrides,
  };
}

interface RepoState {
  numbered: InboxPostGroupSummary[];
  noPost: InboxPostGroupSummary | null;
  commented: PostId[];
  groupCalls: {
    filter: InboxPostGroupFilter;
    scope: string;
    request: InboxPostGroupsPageRequest;
  }[];
  countCalls: InboxPostGroupFilter[];
  itemCalls: { filter: InboxItemFilter; request: InboxItemsPageRequest }[];
  itemCountCalls: InboxItemFilter[];
  items: EngagementInboxItemRecord[];
}

/** Repository double: halaman memotong `numbered` dengan cursor indeks. */
function makeRepo(state: Partial<RepoState> = {}) {
  const s: RepoState = {
    numbered: [],
    noPost: null,
    commented: [],
    groupCalls: [],
    countCalls: [],
    itemCalls: [],
    itemCountCalls: [],
    items: [],
    ...state,
  };
  const repository = {
    listInboxPostGroups: async (
      filter: InboxPostGroupFilter,
      scope: "numbered" | "none",
      request: InboxPostGroupsPageRequest,
    ): Promise<CursorPage<InboxPostGroupSummary>> => {
      s.groupCalls.push({ filter, scope, request });
      if (scope === "none") {
        return { items: s.noPost ? [s.noPost] : [], nextCursor: null };
      }
      const all = filter.postId
        ? s.numbered.filter((group) => group.postId === filter.postId)
        : s.numbered;
      const start = request.cursor ? Number(request.cursor) : 0;
      const end = start + request.limit;
      return {
        items: all.slice(start, end),
        nextCursor: end < all.length ? asPageCursor(String(end)) : null,
      };
    },
    countInboxPostGroups: async (filter: InboxPostGroupFilter) => {
      s.countCalls.push(filter);
      return { postCount: s.numbered.length, unrepliedCount: 9 };
    },
    findPostIdsWithInboxItems: async () => s.commented,
    listInboxItemsPage: async (
      filter: InboxItemFilter,
      request: InboxItemsPageRequest,
    ) => {
      s.itemCalls.push({ filter, request });
      return { items: s.items, nextCursor: asPageCursor("next-items") };
    },
    countInboxItems: async (filter: InboxItemFilter) => {
      s.itemCountCalls.push(filter);
      return { total: 236, unread: 14 };
    },
  } as unknown as IEngagementRepository;
  return { repository, state: s };
}

function makeService(
  state: Partial<RepoState> = {},
  opts: {
    syncable?: Record<string, PostId[]>;
    captions?: Record<string, string>;
  } = {},
) {
  const { repository, state: s } = makeRepo(state);
  const snapshotCalls: PostId[] = [];
  const service = new EngagementService(
    repository,
    {} as IOutstandAdapter,
    {
      findPostOutstandId: async () => null,
      findPostSnapshotForEngagement: async ({ postId }: { postId: PostId }) => {
        snapshotCalls.push(postId);
        const caption = opts.captions?.[postId];
        return caption === undefined
          ? null
          : { caption, mediaIds: [], platformPostUrl: null };
      },
      listSyncablePostsByConnectedAccount: async ({
        connectedAccountId,
      }: {
        connectedAccountId: string;
      }) =>
        (opts.syncable?.[connectedAccountId] ?? []).map((postId) => ({
          postId,
          outstandPostId: `o-${postId}`,
          platform: SocialPlatform.Instagram,
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
  return { service, state: s, snapshotCalls };
}

const numbered = (count: number) =>
  Array.from({ length: count }, (_, i) => summary(postUuid(i + 1)));

let itemSeq = 0;
function item(
  overrides: Partial<EngagementInboxItemRecord>,
): EngagementInboxItemRecord {
  itemSeq += 1;
  return {
    id: `item-${itemSeq}` as EngagementInboxItemRecord["id"],
    workspaceId: WS,
    connectedAccountId: ACC_IG,
    platform: SocialPlatform.Instagram,
    type: "comment",
    externalId: `ext-${itemSeq}`,
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

describe("EngagementService.listInboxPostGroupsPage", () => {
  it("memuat 20 kelompok per halaman tanpa batas jumlah, dengan cursor ke halaman berikutnya", async () => {
    const { service, state, snapshotCalls } = makeService({
      numbered: numbered(45),
    });

    const first = await service.listInboxPostGroupsPage(
      { workspaceId: WS },
      USER,
      NOW,
    );
    expect(first.groups).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    // Snapshot hanya untuk kelompok pada halaman ini, bukan seluruh 45.
    expect(snapshotCalls).toHaveLength(20);
    expect(state.groupCalls[0].request).toMatchObject({
      sort: "unreplied_first",
      limit: 20,
    });

    const second = await service.listInboxPostGroupsPage(
      { workspaceId: WS, cursor: first.nextCursor },
      USER,
      NOW,
    );
    const third = await service.listInboxPostGroupsPage(
      { workspaceId: WS, cursor: second.nextCursor },
      USER,
      NOW,
    );
    expect(second.groups).toHaveLength(20);
    expect(third.groups).toHaveLength(5);
    expect(third.nextCursor).toBeNull();
    const ids = [...first.groups, ...second.groups, ...third.groups].map(
      (g) => g.postId,
    );
    expect(new Set(ids).size).toBe(45);
  });

  it("menaruh kelompok Tanpa posting di dasar halaman terakhir, bukan di halaman kedua yang kosong", async () => {
    const noPost = summary(null, { totalCount: 1 });
    const { service } = makeService({ numbered: numbered(3), noPost });

    const page = await service.listInboxPostGroupsPage(
      { workspaceId: WS, limit: 4 },
      USER,
      NOW,
    );

    expect(page.groups.map((g) => g.postId)).toEqual([
      postUuid(1),
      postUuid(2),
      postUuid(3),
      null,
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it("halaman yang tepat penuh oleh posting tetap menyisakan kelompok Tanpa posting di halaman berikutnya", async () => {
    const noPost = summary(null, { totalCount: 1 });
    const { service } = makeService({ numbered: numbered(2), noPost });

    const first = await service.listInboxPostGroupsPage(
      { workspaceId: WS, limit: 2 },
      USER,
      NOW,
    );
    expect(first.groups).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await service.listInboxPostGroupsPage(
      { workspaceId: WS, limit: 2, cursor: first.nextCursor },
      USER,
      NOW,
    );
    expect(second.groups.map((g) => g.postId)).toEqual([null]);
    expect(second.nextCursor).toBeNull();
  });

  it("posting tanpa komentar mengikuti posting berkomentar, dipaging, tanpa menggandakan yang berkomentar", async () => {
    const e1 = postUuid(101);
    const e2 = postUuid(102);
    const e3 = postUuid(103);
    const commented = postUuid(1);
    const { service } = makeService(
      { numbered: [summary(commented)], commented: [commented] },
      { syncable: { [ACC_IG]: [commented, e1, e2, e3] } },
    );

    const first = await service.listInboxPostGroupsPage(
      { workspaceId: WS, includeEmpty: true, limit: 3 },
      USER,
      NOW,
    );
    expect(first.groups.map((g) => g.postId)).toEqual([commented, e1, e2]);
    expect(first.groups[1]).toMatchObject({
      totalCount: 0,
      latestReceivedAt: null,
    });

    const second = await service.listInboxPostGroupsPage(
      {
        workspaceId: WS,
        includeEmpty: true,
        limit: 3,
        cursor: first.nextCursor,
      },
      USER,
      NOW,
    );
    expect(second.groups.map((g) => g.postId)).toEqual([e3]);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects a B cursor naming a post that is not an empty post (no restart at 0)", async () => {
    const e1 = postUuid(101);
    const gone = postUuid(199);
    const { service } = makeService(
      { numbered: [], commented: [] },
      { syncable: { [ACC_IG]: [e1] } },
    );
    await expect(
      service.listInboxPostGroupsPage(
        {
          workspaceId: WS,
          includeEmpty: true,
          cursor: asPageCursor(`B.${gone}`),
        },
        USER,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.listInboxPostGroupsPage(
        { workspaceId: WS, cursor: asPageCursor(`B.${e1}`) },
        USER,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("includeEmpty diabaikan saat filter status aktif", async () => {
    const { service } = makeService(
      { numbered: [summary(postUuid(1))] },
      { syncable: { [ACC_IG]: [postUuid(101)] } },
    );
    const page = await service.listInboxPostGroupsPage(
      { workspaceId: WS, includeEmpty: true, status: "unread" },
      USER,
      NOW,
    );
    expect(page.groups.map((g) => g.postId)).toEqual([postUuid(1)]);
  });

  it("hitungan sebenarnya dari count query, ditambah posting kosong, hanya bila diminta", async () => {
    const { service, state } = makeService(
      { numbered: numbered(45) },
      { syncable: { [ACC_IG]: [postUuid(101), postUuid(102)] } },
    );

    const without = await service.listInboxPostGroupsPage(
      { workspaceId: WS },
      USER,
      NOW,
    );
    expect(without.counts).toBeNull();
    expect(state.countCalls).toHaveLength(0);

    const withCounts = await service.listInboxPostGroupsPage(
      { workspaceId: WS, withCounts: true, includeEmpty: true },
      USER,
      NOW,
    );
    // 45 berkomentar (count query, bukan 20 termuat) + 2 posting kosong.
    expect(withCounts.counts).toEqual({ postCount: 47, unrepliedCount: 9 });
  });

  it("satu kelompok: posting tertentu, atau Tanpa posting lewat postId null", async () => {
    const noPost = summary(null, { totalCount: 1 });
    const { service, state } = makeService({ numbered: numbered(30), noPost });

    const one = await service.listInboxPostGroupsPage(
      { workspaceId: WS, postId: postUuid(25) },
      USER,
      NOW,
    );
    expect(one.groups.map((g) => g.postId)).toEqual([postUuid(25)]);
    expect(state.groupCalls[0].filter.postId).toBe(postUuid(25));

    const none = await service.listInboxPostGroupsPage(
      { workspaceId: WS, postId: null },
      USER,
      NOW,
    );
    expect(none.groups.map((g) => g.postId)).toEqual([null]);
    expect(state.groupCalls[1].scope).toBe("none");
  });

  it("meneruskan filter dan rentang tanggal ke repository", async () => {
    const { service, state } = makeService({ numbered: numbered(1) });
    await service.listInboxPostGroupsPage(
      {
        workspaceId: WS,
        connectedAccountId: ACC_FB,
        platform: SocialPlatform.Facebook,
        status: "replied",
        sort: "oldest",
        dateRange: "30d",
      },
      USER,
      NOW,
    );
    const call = state.groupCalls[0];
    expect(call.filter).toMatchObject({
      connectedAccountId: ACC_FB,
      platform: SocialPlatform.Facebook,
      status: "replied",
      receivedSince: day(30),
    });
    expect(call.request.sort).toBe("oldest");
  });

  it("menolak filter dan cursor tidak valid sebelum menyentuh repository", async () => {
    const { service, state } = makeService();
    const bad = (input: object) =>
      service.listInboxPostGroupsPage({ workspaceId: WS, ...input }, USER, NOW);

    await expect(bad({ sort: "random" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(bad({ dateRange: "1y" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(bad({ status: "done" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      bad({ connectedAccountId: "bukan-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(bad({ platform: "myspace" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(bad({ postId: "bukan-uuid" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      bad({ cursor: asPageCursor("Z.sembarang") }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      bad({ cursor: asPageCursor("B.bukan-uuid") }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(state.groupCalls).toHaveLength(0);
  });
});

describe("EngagementService.listInboxPage", () => {
  it("meminta satu halaman dengan sort, filter postId (id, null, atau tanpa), dan cursor", async () => {
    const { service, state } = makeService({ items: [item({})] });

    const page = await service.listInboxPage(
      {
        workspaceId: WS,
        sort: "newest",
        status: "unread",
        postId: postUuid(1),
        cursor: asPageCursor("c1"),
        dateRange: "7d",
      },
      USER,
      NOW,
    );
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe("next-items");
    expect(state.itemCalls[0].request).toEqual({
      sort: "newest",
      cursor: "c1",
      limit: 20,
    });
    expect(state.itemCalls[0].filter).toMatchObject({
      status: "unread",
      postId: postUuid(1),
      receivedSince: day(7),
    });

    await service.listInboxPage({ workspaceId: WS, postId: null }, USER, NOW);
    expect(state.itemCalls[1].filter.postId).toBeNull();
    expect(state.itemCalls[1].request.sort).toBe("unreplied_first");

    await service.listInboxPage({ workspaceId: WS }, USER, NOW);
    expect(state.itemCalls[2].filter).not.toHaveProperty("postId");
  });

  it("hitungan sebenarnya hanya bila diminta, bukan panjang halaman", async () => {
    const { service, state } = makeService({ items: [item({})] });

    const without = await service.listInboxPage({ workspaceId: WS }, USER, NOW);
    expect(without.counts).toBeNull();
    expect(state.itemCountCalls).toHaveLength(0);

    const withCounts = await service.listInboxPage(
      { workspaceId: WS, withCounts: true },
      USER,
      NOW,
    );
    expect(withCounts.counts).toEqual({ total: 236, unread: 14 });
  });

  it("caption posting asal satu panggilan per posting, hanya bila diminta", async () => {
    const { service, snapshotCalls } = makeService(
      {
        items: [
          item({ postId: postUuid(1) }),
          item({ postId: postUuid(1) }),
          item({ postId: postUuid(2) }),
          item({ postId: null }),
        ],
      },
      { captions: { [postUuid(1)]: "Caption satu" } },
    );

    const without = await service.listInboxPage({ workspaceId: WS }, USER, NOW);
    expect(without.postCaptions).toEqual({});
    expect(snapshotCalls).toHaveLength(0);

    const page = await service.listInboxPage(
      { workspaceId: WS, includePostCaptions: true },
      USER,
      NOW,
    );
    expect(page.postCaptions).toEqual({ [postUuid(1)]: "Caption satu" });
    expect(snapshotCalls).toHaveLength(2);
  });

  it("menolak filter tidak valid", async () => {
    const { service, state } = makeService();
    await expect(
      service.listInboxPage(
        { workspaceId: WS, postId: "x" as PostId },
        USER,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(state.itemCalls).toHaveLength(0);
  });
});
