import {
  asConnectedAccountId,
  asPostId,
  asPostMetricsId,
  asPostTargetId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  MemberRole,
  type PostId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { PostMetricsRecord } from "@/domains/analytics";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "@/lib/utils/errors";
import type {
  CalendarItemRecord,
  HistoryItemRecord,
  IPublishingRepository,
  PublishingPostRecord,
  QueueItemRecord,
} from "../repositories/publishing.repository";
import { PublishingService } from "./publishing.service";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const AUTHOR_ID = asUserId("user-1");

function createFakeRepository(
  overrides: Partial<IPublishingRepository> = {},
): IPublishingRepository {
  return {
    createDraft: async ({
      workspaceId,
      authorId,
      caption,
    }): Promise<PublishingPostRecord> => ({
      id: asPostId("post-1"),
      workspaceId,
      authorId,
      caption,
      status: ContentStatus.Draft,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }),
    listDrafts: async () => [],
    findDraftById: async () => null,
    updateDraftCaption: async () => null,
    schedulePost: async () => null,
    publishNow: async () => null,
    updateTargetOutcome: async () => undefined,
    setOutstandPostId: async () => undefined,
    countScheduledByAccount: async () => new Map(),
    listQueue: async () => [],
    listCalendarPosts: async () => [],
    getCalendarPostById: async () => null,
    listHistory: async () => [],
    getHistoryById: async () => null,
    getHistoryPostById: async () => null,
    cancelSchedule: async () => null,
    markPostFailed: async () => undefined,
    markPostPublished: async () => undefined,
    getRetryTarget: async () => null,
    resetTargetForRetry: async () => undefined,
    setRetryOutstandPostId: async () => undefined,
    reconcilePostStatusAfterRetry: async () => undefined,
    findPostTargetsByOutstandPostId: async () => null,
    softDeletePost: async () => null,
    listSyncablePostsByConnectedAccount: async () => [],
    findPostOutstandId: async () => null,
    findPostSnapshotForEngagement: async () => null,
    upsertImportedPosts: async () => ({
      insertedCount: 0,
      skippedDuplicateCount: 0,
    }),
    ...overrides,
  };
}

describe("PublishingService.saveDraft", () => {
  it("delegates to the repository with a trimmed caption", async () => {
    let received: Parameters<IPublishingRepository["createDraft"]>[0] | null =
      null;
    const service = new PublishingService(
      createFakeRepository({
        createDraft: async (input) => {
          received = input;
          return {
            id: asPostId("post-1"),
            workspaceId: input.workspaceId,
            authorId: input.authorId,
            caption: input.caption,
            status: ContentStatus.Draft,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          };
        },
      }),
    );

    await service.saveDraft({
      workspaceId: WORKSPACE_ID,
      authorId: AUTHOR_ID,
      caption: "  Hello world  ",
    });

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      authorId: AUTHOR_ID,
      caption: "Hello world",
    });
  });

  it("allows an empty caption", async () => {
    const service = new PublishingService(createFakeRepository());

    const post = await service.saveDraft({
      workspaceId: WORKSPACE_ID,
      authorId: AUTHOR_ID,
      caption: "   ",
    });

    expect(post.caption).toBe("");
    expect(post.status).toBe(ContentStatus.Draft);
  });
});

describe("PublishingService.listDrafts", () => {
  it("delegates to the repository", async () => {
    const drafts: PublishingPostRecord[] = [
      {
        id: asPostId("post-1"),
        workspaceId: WORKSPACE_ID,
        authorId: AUTHOR_ID,
        caption: "Hello",
        status: ContentStatus.Draft,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ];
    const service = new PublishingService(
      createFakeRepository({ listDrafts: async () => drafts }),
    );

    await expect(service.listDrafts(WORKSPACE_ID, AUTHOR_ID)).resolves.toBe(
      drafts,
    );
  });
});

describe("PublishingService.getDraftById", () => {
  it("throws NotFoundError when the repository returns null", async () => {
    const service = new PublishingService(createFakeRepository());

    await expect(
      service.getDraftById(WORKSPACE_ID, asPostId("post-1"), AUTHOR_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it("returns the draft when found", async () => {
    const draft: PublishingPostRecord = {
      id: asPostId("post-1"),
      workspaceId: WORKSPACE_ID,
      authorId: AUTHOR_ID,
      caption: "Hello",
      status: ContentStatus.Draft,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const service = new PublishingService(
      createFakeRepository({ findDraftById: async () => draft }),
    );

    await expect(
      service.getDraftById(WORKSPACE_ID, asPostId("post-1"), AUTHOR_ID),
    ).resolves.toBe(draft);
  });
});

describe("PublishingService.updateDraft", () => {
  it("trims the caption before delegating to the repository", async () => {
    let received:
      Parameters<IPublishingRepository["updateDraftCaption"]>[0] | null = null;
    const service = new PublishingService(
      createFakeRepository({
        updateDraftCaption: async (input) => {
          received = input;
          return {
            id: input.postId,
            workspaceId: input.workspaceId,
            authorId: AUTHOR_ID,
            caption: input.caption,
            status: ContentStatus.Draft,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          };
        },
      }),
    );

    await service.updateDraft(
      {
        workspaceId: WORKSPACE_ID,
        postId: asPostId("post-1"),
        caption: "  Hello world  ",
      },
      AUTHOR_ID,
    );

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      postId: asPostId("post-1"),
      caption: "Hello world",
    });
  });

  it("throws NotFoundError when the repository returns null", async () => {
    const service = new PublishingService(createFakeRepository());

    await expect(
      service.updateDraft(
        {
          workspaceId: WORKSPACE_ID,
          postId: asPostId("post-1"),
          caption: "Hello",
        },
        AUTHOR_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("PublishingService.countScheduledByAccount", () => {
  it("returns an empty Map without calling the repository when input is empty", async () => {
    let calls = 0;
    const service = new PublishingService(
      createFakeRepository({
        countScheduledByAccount: async () => {
          calls += 1;
          return new Map();
        },
      }),
    );

    const result = await service.countScheduledByAccount(
      WORKSPACE_ID,
      [],
      AUTHOR_ID,
    );

    expect(result).toEqual(new Map());
    expect(calls).toBe(0);
  });

  it("delegates to the repository for non-empty input", async () => {
    const connectedAccountIds = [
      asConnectedAccountId("conn-1"),
      asConnectedAccountId("conn-2"),
    ];
    const expected = new Map([
      [connectedAccountIds[0]!, 3],
      [connectedAccountIds[1]!, 0],
    ]);
    let received:
      Parameters<IPublishingRepository["countScheduledByAccount"]>[0] | null =
      null;
    const service = new PublishingService(
      createFakeRepository({
        countScheduledByAccount: async (input) => {
          received = input;
          return expected;
        },
      }),
    );

    const result = await service.countScheduledByAccount(
      WORKSPACE_ID,
      connectedAccountIds,
      AUTHOR_ID,
    );

    expect(result).toBe(expected);
    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      connectedAccountIds,
    });
  });
});

function createQueueItem(
  overrides: Partial<QueueItemRecord> = {},
): QueueItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    scheduledAt: new Date("2026-07-14T10:00:00Z"),
    createdAt: new Date("2026-07-13T00:00:00Z"),
    targets: [
      {
        id: asPostTargetId("target-1"),
        connectedAccountId: asConnectedAccountId("conn-1"),
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
        accountHandle: "@raka",
      },
    ],
    ...overrides,
  };
}

describe("PublishingService.listQueue", () => {
  it("mengembalikan array kosong kalau tidak ada post terjadwal", async () => {
    const service = new PublishingService(
      createFakeRepository({ listQueue: async () => [] }),
    );

    await expect(service.listQueue(WORKSPACE_ID, AUTHOR_ID)).resolves.toEqual(
      [],
    );
  });

  it("mengelompokkan beberapa item dalam satu tanggal ke satu grup", async () => {
    const itemA = createQueueItem({
      id: asPostId("post-1"),
      scheduledAt: new Date("2026-07-14T09:00:00Z"),
    });
    const itemB = createQueueItem({
      id: asPostId("post-2"),
      scheduledAt: new Date("2026-07-14T15:00:00Z"),
    });
    const service = new PublishingService(
      createFakeRepository({ listQueue: async () => [itemA, itemB] }),
    );

    const groups = await service.listQueue(WORKSPACE_ID, AUTHOR_ID);

    expect(groups).toEqual([{ date: "2026-07-14", items: [itemA, itemB] }]);
  });

  it("mengelompokkan item ke beberapa grup tanggal terpisah, urutan ascending", async () => {
    const itemDay1 = createQueueItem({
      id: asPostId("post-1"),
      scheduledAt: new Date("2026-07-14T09:00:00Z"),
    });
    const itemDay2 = createQueueItem({
      id: asPostId("post-2"),
      scheduledAt: new Date("2026-07-15T09:00:00Z"),
    });
    let received: Parameters<IPublishingRepository["listQueue"]>[0] | null =
      null;
    const service = new PublishingService(
      createFakeRepository({
        listQueue: async (input) => {
          received = input;
          return [itemDay1, itemDay2];
        },
      }),
    );

    const groups = await service.listQueue(WORKSPACE_ID, AUTHOR_ID);

    expect(groups).toEqual([
      { date: "2026-07-14", items: [itemDay1] },
      { date: "2026-07-15", items: [itemDay2] },
    ]);
    expect(received).toEqual({ workspaceId: WORKSPACE_ID });
  });
});

function createCalendarItem(
  overrides: Partial<CalendarItemRecord> = {},
): CalendarItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    status: ContentStatus.Scheduled,
    scheduledAt: new Date("2026-07-14T10:00:00Z"),
    publishedAt: null,
    createdAt: new Date("2026-07-13T00:00:00Z"),
    updatedAt: new Date("2026-07-13T00:00:00Z"),
    targets: [
      {
        id: asPostTargetId("target-1"),
        connectedAccountId: asConnectedAccountId("conn-1"),
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
        accountHandle: "@raka",
        platformPostUrl: null,
      },
    ],
    ...overrides,
  };
}

const FROM = new Date("2026-07-13T00:00:00Z");
const TO = new Date("2026-07-20T00:00:00Z");

describe("PublishingService.listCalendarPosts", () => {
  it("mengembalikan array kosong kalau tidak ada post dalam rentang", async () => {
    const service = new PublishingService(
      createFakeRepository({ listCalendarPosts: async () => [] }),
    );

    await expect(
      service.listCalendarPosts(
        { workspaceId: WORKSPACE_ID, from: FROM, to: TO },
        AUTHOR_ID,
      ),
    ).resolves.toEqual([]);
  });

  it("meneruskan input apa adanya ke repository saat caller tidak eksplisit memfilter statuses (T-090, rancangan Imported sudah dikunci — tidak lagi exclude Imported dari default, lihat tasks/v02-publishing-mvp.md § T-090)", async () => {
    let received:
      Parameters<IPublishingRepository["listCalendarPosts"]>[0] | null = null;
    const service = new PublishingService(
      createFakeRepository({
        listCalendarPosts: async (input) => {
          received = input;
          return [];
        },
      }),
    );

    await service.listCalendarPosts(
      { workspaceId: WORKSPACE_ID, from: FROM, to: TO },
      AUTHOR_ID,
    );

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      from: FROM,
      to: TO,
    });
  });

  it("meneruskan input rentang + filter apa adanya ke repository", async () => {
    let received:
      Parameters<IPublishingRepository["listCalendarPosts"]>[0] | null = null;
    const connectedAccountIds = [asConnectedAccountId("conn-1")];
    const statuses = [ContentStatus.Scheduled, ContentStatus.Published];
    const service = new PublishingService(
      createFakeRepository({
        listCalendarPosts: async (input) => {
          received = input;
          return [];
        },
      }),
    );

    await service.listCalendarPosts(
      {
        workspaceId: WORKSPACE_ID,
        from: FROM,
        to: TO,
        connectedAccountIds,
        statuses,
      },
      AUTHOR_ID,
    );

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      from: FROM,
      to: TO,
      connectedAccountIds,
      statuses,
    });
  });

  it("mengurutkan hasil ascending berdasar tanggal efektif", async () => {
    const later = createCalendarItem({
      id: asPostId("post-later"),
      scheduledAt: new Date("2026-07-16T00:00:00Z"),
    });
    const earlier = createCalendarItem({
      id: asPostId("post-earlier"),
      scheduledAt: new Date("2026-07-14T00:00:00Z"),
    });
    const service = new PublishingService(
      createFakeRepository({
        listCalendarPosts: async () => [later, earlier],
      }),
    );

    const result = await service.listCalendarPosts(
      { workspaceId: WORKSPACE_ID, from: FROM, to: TO },
      AUTHOR_ID,
    );

    expect(result.map((item) => item.id)).toEqual([earlier.id, later.id]);
  });

  it("metrics selalu null untuk post non-Published, walau ada PostMetricsPort", async () => {
    const draft = createCalendarItem({
      id: asPostId("post-draft"),
      status: ContentStatus.Draft,
    });
    let portCalled = false;
    const service = new PublishingService(
      createFakeRepository({ listCalendarPosts: async () => [draft] }),
      {
        getPostMetricsByPosts: async () => {
          portCalled = true;
          return new Map();
        },
      },
    );

    const result = await service.listCalendarPosts(
      { workspaceId: WORKSPACE_ID, from: FROM, to: TO },
      AUTHOR_ID,
    );

    expect(result).toEqual([{ ...draft, metrics: null }]);
    // Tidak ada post Published — port tidak perlu dipanggil sama sekali.
    expect(portCalled).toBe(false);
  });

  it("metrics [] untuk post Published tanpa PostMetricsPort disuplai", async () => {
    const published = createCalendarItem({
      id: asPostId("post-published"),
      status: ContentStatus.Published,
      scheduledAt: null,
      publishedAt: new Date("2026-07-14T00:00:00Z"),
    });
    const service = new PublishingService(
      createFakeRepository({ listCalendarPosts: async () => [published] }),
    );

    const result = await service.listCalendarPosts(
      { workspaceId: WORKSPACE_ID, from: FROM, to: TO },
      AUTHOR_ID,
    );

    expect(result).toEqual([{ ...published, metrics: [] }]);
  });

  it("metrics diisi dari PostMetricsPort untuk post Published, batch bukan per-post", async () => {
    const publishedA = createCalendarItem({
      id: asPostId("post-a"),
      status: ContentStatus.Published,
      scheduledAt: null,
      publishedAt: new Date("2026-07-14T00:00:00Z"),
    });
    const publishedB = createCalendarItem({
      id: asPostId("post-b"),
      status: ContentStatus.Published,
      scheduledAt: null,
      publishedAt: new Date("2026-07-15T00:00:00Z"),
    });
    const scheduled = createCalendarItem({
      id: asPostId("post-c"),
      status: ContentStatus.Scheduled,
      scheduledAt: new Date("2026-07-16T00:00:00Z"),
    });
    const metricA: PostMetricsRecord = {
      id: asPostMetricsId("metric-a"),
      postId: publishedA.id,
      connectedAccountId: asConnectedAccountId("conn-1"),
      platform: SocialPlatform.Instagram,
      impressions: 100,
      reach: 80,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1625,
      fetchedAt: new Date(0),
    };

    let receivedPostIds: PostId[] | null = null;
    let callCount = 0;
    const service = new PublishingService(
      createFakeRepository({
        listCalendarPosts: async () => [publishedA, publishedB, scheduled],
      }),
      {
        getPostMetricsByPosts: async (postIds) => {
          callCount += 1;
          receivedPostIds = postIds;
          return new Map([[publishedA.id, [metricA]]]);
        },
      },
    );

    const result = await service.listCalendarPosts(
      { workspaceId: WORKSPACE_ID, from: FROM, to: TO },
      AUTHOR_ID,
    );

    // Batch: satu kali panggilan port untuk seluruh post Published,
    // bukan satu panggilan per post (anti N+1).
    expect(callCount).toBe(1);
    expect(receivedPostIds).toEqual([publishedA.id, publishedB.id]);

    const byId = new Map(result.map((item) => [item.id, item]));
    expect(byId.get(publishedA.id)?.metrics).toEqual([metricA]);
    expect(byId.get(publishedB.id)?.metrics).toEqual([]);
    expect(byId.get(scheduled.id)?.metrics).toBeNull();
  });
});

describe("PublishingService.getCalendarPostById", () => {
  it("mengembalikan null kalau repository tidak menemukan post (T-092.3, ADR-094 poin 5)", async () => {
    const service = new PublishingService(
      createFakeRepository({ getCalendarPostById: async () => null }),
    );

    await expect(
      service.getCalendarPostById(WORKSPACE_ID, asPostId("post-x"), AUTHOR_ID),
    ).resolves.toBeNull();
  });

  it("metrics null untuk post non-Published", async () => {
    const draft = createCalendarItem({
      id: asPostId("post-draft"),
      status: ContentStatus.Draft,
    });
    const service = new PublishingService(
      createFakeRepository({ getCalendarPostById: async () => draft }),
    );

    const result = await service.getCalendarPostById(
      WORKSPACE_ID,
      draft.id,
      AUTHOR_ID,
    );

    expect(result).toEqual({ ...draft, metrics: null });
  });

  it("metrics diisi dari PostMetricsPort untuk post Published — satu panggilan, bukan batch semua post workspace", async () => {
    const published = createCalendarItem({
      id: asPostId("post-published"),
      status: ContentStatus.Published,
      scheduledAt: null,
      publishedAt: new Date("2026-07-14T00:00:00Z"),
    });
    const metric: PostMetricsRecord = {
      id: asPostMetricsId("metric-a"),
      postId: published.id,
      connectedAccountId: asConnectedAccountId("conn-1"),
      platform: SocialPlatform.Instagram,
      impressions: 100,
      reach: 80,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1625,
      fetchedAt: new Date(0),
    };
    let receivedPostIds: PostId[] | null = null;
    const service = new PublishingService(
      createFakeRepository({ getCalendarPostById: async () => published }),
      {
        getPostMetricsByPosts: async (postIds) => {
          receivedPostIds = postIds;
          return new Map([[published.id, [metric]]]);
        },
      },
    );

    const result = await service.getCalendarPostById(
      WORKSPACE_ID,
      published.id,
      AUTHOR_ID,
    );

    expect(receivedPostIds).toEqual([published.id]);
    expect(result).toEqual({ ...published, metrics: [metric] });
  });

  it("metrics [] untuk post Published tanpa PostMetricsPort disuplai", async () => {
    const published = createCalendarItem({
      id: asPostId("post-published"),
      status: ContentStatus.Published,
      scheduledAt: null,
      publishedAt: new Date("2026-07-14T00:00:00Z"),
    });
    const service = new PublishingService(
      createFakeRepository({ getCalendarPostById: async () => published }),
    );

    const result = await service.getCalendarPostById(
      WORKSPACE_ID,
      published.id,
      AUTHOR_ID,
    );

    expect(result).toEqual({ ...published, metrics: [] });
  });

  it("mengembalikan post berstatus Imported apa adanya (T-090, rancangan Imported sudah dikunci — jalur Realtime-patch sekarang konsisten dengan listCalendarPosts yang juga tidak lagi exclude Imported, lihat tasks/v02-publishing-mvp.md § T-090)", async () => {
    const imported = createCalendarItem({
      id: asPostId("post-imported"),
      status: ContentStatus.Imported,
      scheduledAt: null,
      publishedAt: new Date("2026-07-14T00:00:00Z"),
    });
    const service = new PublishingService(
      createFakeRepository({ getCalendarPostById: async () => imported }),
    );

    const result = await service.getCalendarPostById(
      WORKSPACE_ID,
      imported.id,
      AUTHOR_ID,
    );

    expect(result).toEqual({ ...imported, metrics: null });
  });
});

function createHistoryItem(
  overrides: Partial<HistoryItemRecord> = {},
): HistoryItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    status: ContentStatus.Published,
    scheduledAt: null,
    publishedAt: new Date("2026-07-14T10:00:00Z"),
    createdAt: new Date("2026-07-13T00:00:00Z"),
    updatedAt: new Date("2026-07-14T10:00:00Z"),
    mediaIds: [],
    targets: [
      {
        id: asPostTargetId("target-1"),
        connectedAccountId: asConnectedAccountId("conn-1"),
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
        accountHandle: "@raka",
        status: "published",
        platformPostUrl: "https://instagram.com/p/xyz",
        error: null,
      },
    ],
    ...overrides,
  };
}

describe("PublishingService.listHistory", () => {
  it("mengembalikan array kosong kalau tidak ada riwayat", async () => {
    const service = new PublishingService(
      createFakeRepository({ listHistory: async () => [] }),
    );

    await expect(
      service.listHistory({ workspaceId: WORKSPACE_ID }, AUTHOR_ID),
    ).resolves.toEqual([]);
  });

  it("default statuses ke [Published, Failed] kalau tidak diisi caller", async () => {
    let received: Parameters<IPublishingRepository["listHistory"]>[0] | null =
      null;
    const service = new PublishingService(
      createFakeRepository({
        listHistory: async (input) => {
          received = input;
          return [];
        },
      }),
    );

    await service.listHistory({ workspaceId: WORKSPACE_ID }, AUTHOR_ID);

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      statuses: [ContentStatus.Published, ContentStatus.Failed],
    });
  });

  it("meneruskan connectedAccountIds apa adanya ke repository", async () => {
    let received: Parameters<IPublishingRepository["listHistory"]>[0] | null =
      null;
    const connectedAccountIds = [asConnectedAccountId("conn-1")];
    const service = new PublishingService(
      createFakeRepository({
        listHistory: async (input) => {
          received = input;
          return [];
        },
      }),
    );

    await service.listHistory(
      { workspaceId: WORKSPACE_ID, connectedAccountIds },
      AUTHOR_ID,
    );

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      connectedAccountIds,
      statuses: [ContentStatus.Published, ContentStatus.Failed],
    });
  });

  it("meng-clamp statuses ke subset terminal (Published/Failed) sebelum memanggil repository", async () => {
    let received: Parameters<IPublishingRepository["listHistory"]>[0] | null =
      null;
    const service = new PublishingService(
      createFakeRepository({
        listHistory: async (input) => {
          received = input;
          return [];
        },
      }),
    );

    await service.listHistory(
      {
        workspaceId: WORKSPACE_ID,
        statuses: [
          ContentStatus.Draft,
          ContentStatus.Published,
          ContentStatus.Scheduled,
        ],
      },
      AUTHOR_ID,
    );

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      statuses: [ContentStatus.Published],
    });
  });

  it("tidak memanggil repository sama sekali kalau semua status yang diminta bukan status terminal", async () => {
    let calls = 0;
    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => {
          calls += 1;
          return [];
        },
      }),
    );

    const result = await service.listHistory(
      { workspaceId: WORKSPACE_ID, statuses: [ContentStatus.Draft] },
      AUTHOR_ID,
    );

    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  it("mengembalikan hasil repository apa adanya (sudah terurut, tanpa post-processing)", async () => {
    const items = [
      createHistoryItem(),
      createHistoryItem({ id: asPostId("post-2") }),
    ];
    const service = new PublishingService(
      createFakeRepository({ listHistory: async () => items }),
    );

    await expect(
      service.listHistory({ workspaceId: WORKSPACE_ID }, AUTHOR_ID),
    ).resolves.toBe(items);
  });
});

describe("PublishingService.getHistoryById", () => {
  it("throws NotFoundError when the repository returns null", async () => {
    const service = new PublishingService(createFakeRepository());

    await expect(
      service.getHistoryById(WORKSPACE_ID, asPostId("post-1"), AUTHOR_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it("returns the history item when found (Failed, tanpa PostMetricsPort disuplai)", async () => {
    const item = createHistoryItem({ status: ContentStatus.Failed });
    const service = new PublishingService(
      createFakeRepository({ getHistoryById: async () => item }),
    );

    await expect(
      service.getHistoryById(WORKSPACE_ID, asPostId("post-1"), AUTHOR_ID),
    ).resolves.toEqual({ ...item, metrics: null });
  });

  // T-043.3 — reuse semantik `PostMetricsPort` yang sama dengan
  // `listCalendarPosts`/`getCalendarPostById` (KSP-02-F08): `null` untuk
  // non-Published (tidak pernah di-fetch), `[]` untuk Published tanpa data
  // ter-ingest, array berisi kalau sudah ada.
  it("metrics null untuk post Failed, PostMetricsPort tidak pernah dipanggil", async () => {
    const failed = createHistoryItem({ status: ContentStatus.Failed });
    let calls = 0;
    const service = new PublishingService(
      createFakeRepository({ getHistoryById: async () => failed }),
      {
        getPostMetricsByPosts: async () => {
          calls += 1;
          return new Map();
        },
      },
    );

    const result = await service.getHistoryById(
      WORKSPACE_ID,
      failed.id,
      AUTHOR_ID,
    );

    expect(result).toEqual({ ...failed, metrics: null });
    expect(calls).toBe(0);
  });

  it("metrics [] untuk post Published tanpa PostMetricsPort disuplai", async () => {
    const published = createHistoryItem({ status: ContentStatus.Published });
    const service = new PublishingService(
      createFakeRepository({ getHistoryById: async () => published }),
    );

    const result = await service.getHistoryById(
      WORKSPACE_ID,
      published.id,
      AUTHOR_ID,
    );

    expect(result).toEqual({ ...published, metrics: [] });
  });

  it("metrics diisi dari PostMetricsPort untuk post Published", async () => {
    const published = createHistoryItem({ status: ContentStatus.Published });
    const metric: PostMetricsRecord = {
      id: asPostMetricsId("metric-a"),
      postId: published.id,
      connectedAccountId: asConnectedAccountId("conn-1"),
      platform: SocialPlatform.Instagram,
      impressions: 100,
      reach: 80,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1625,
      fetchedAt: new Date(0),
    };
    let receivedPostIds: PostId[] | null = null;
    const service = new PublishingService(
      createFakeRepository({ getHistoryById: async () => published }),
      {
        getPostMetricsByPosts: async (postIds) => {
          receivedPostIds = postIds;
          return new Map([[published.id, [metric]]]);
        },
      },
    );

    const result = await service.getHistoryById(
      WORKSPACE_ID,
      published.id,
      AUTHOR_ID,
    );

    expect(receivedPostIds).toEqual([published.id]);
    expect(result).toEqual({ ...published, metrics: [metric] });
  });
});

// T-043.1 — dipindahkan dari `AnalyticsService.getPostPerformance`
// (2026-09-18, refactor Temuan 1 Ridwan Architecture Reviewer, circular
// dependency `analytics` <-> `publishing`). Rentang tanggal dihitung
// relatif ke `Date.now()` saat test berjalan (weekly = 7 hari terakhir) —
// bukan tanggal hardcode — konsisten dengan
// `resolvePostPerformancePeriodRange` yang tidak menerima override `now`
// dari `getPostPerformance` (lihat catatan keputusan di
// `post-performance-period-range.ts`).
describe("PublishingService.getPostPerformance", () => {
  const NOW = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WITHIN_WEEK = new Date(NOW - 3 * DAY_MS);
  const OUTSIDE_WEEK = new Date(NOW - 10 * DAY_MS);

  it("throws when no PostMetricsPort is supplied", async () => {
    const service = new PublishingService(
      createFakeRepository({ listHistory: async () => [] }),
    );

    await expect(
      service.getPostPerformance(WORKSPACE_ID, "weekly", AUTHOR_ID),
    ).rejects.toThrow(/PostMetricsPort/);
  });

  it("returns an empty array when no history item falls inside the period range", async () => {
    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: asPostId("post-outside-range"),
            publishedAt: OUTSIDE_WEEK,
          }),
          createHistoryItem({
            id: asPostId("post-failed"),
            status: ContentStatus.Failed,
            publishedAt: null,
          }),
        ],
      }),
      { getPostMetricsByPosts: async () => new Map() },
    );

    await expect(
      service.getPostPerformance(WORKSPACE_ID, "weekly", AUTHOR_ID),
    ).resolves.toEqual([]);
  });

  it("maps caption + accountHandle with reach/engagementRate per post and account, sorted by reach descending", async () => {
    const postA = asPostId("post-a");
    const postB = asPostId("post-b");
    const connA1 = asConnectedAccountId("conn-a1");
    const connA2 = asConnectedAccountId("conn-a2");
    const connB1 = asConnectedAccountId("conn-b1");

    const metricA1: PostMetricsRecord = {
      id: asPostMetricsId("metric-a1"),
      postId: postA,
      connectedAccountId: connA1,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 200,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1,
      fetchedAt: new Date(0),
    };
    const metricA2: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-a2"),
      connectedAccountId: connA2,
      platform: SocialPlatform.TikTok,
      reach: 900,
      engagementRate: 0.3,
    };
    const metricB1: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-b1"),
      postId: postB,
      connectedAccountId: connB1,
      reach: 50,
      engagementRate: 0.05,
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postA,
            caption: "Caption post A",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-a1"),
                connectedAccountId: connA1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-a1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
              {
                id: asPostTargetId("target-a2"),
                connectedAccountId: connA2,
                platform: SocialPlatform.TikTok,
                contentFormat: ContentFormat.Reel,
                accountHandle: "@akun-a2",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
          createHistoryItem({
            id: postB,
            caption: "Caption post B",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-b1"),
                connectedAccountId: connB1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-b1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      {
        getPostMetricsByPosts: async () =>
          new Map([
            [postA, [metricA1, metricA2]],
            [postB, [metricB1]],
          ]),
      },
    );

    const result = await service.getPostPerformance(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual([
      {
        postId: postA,
        connectedAccountId: connA2,
        caption: "Caption post A",
        platform: SocialPlatform.TikTok,
        accountHandle: "@akun-a2",
        reach: 900,
        engagementRate: 0.3,
        likes: 10,
        comments: 2,
      },
      {
        postId: postA,
        connectedAccountId: connA1,
        caption: "Caption post A",
        platform: SocialPlatform.Instagram,
        accountHandle: "@akun-a1",
        reach: 200,
        engagementRate: 0.1,
        likes: 10,
        comments: 2,
      },
      {
        postId: postB,
        connectedAccountId: connB1,
        caption: "Caption post B",
        platform: SocialPlatform.Instagram,
        accountHandle: "@akun-b1",
        reach: 50,
        engagementRate: 0.05,
        likes: 10,
        comments: 2,
      },
    ]);
  });

  it("includes a target without an ingested AnalyticsPostMetric yet, with reach/engagementRate null instead of skipping the row (T-043.4)", async () => {
    const postC = asPostId("post-c");
    const connC1 = asConnectedAccountId("conn-c1");
    const connC2 = asConnectedAccountId("conn-c2");

    const metricC1: PostMetricsRecord = {
      id: asPostMetricsId("metric-c1"),
      postId: postC,
      connectedAccountId: connC1,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 300,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.2,
      fetchedAt: new Date(0),
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postC,
            caption: "Caption post C",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-c1"),
                connectedAccountId: connC1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-c1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
              {
                id: asPostTargetId("target-c2"),
                connectedAccountId: connC2,
                platform: SocialPlatform.TikTok,
                contentFormat: ContentFormat.Reel,
                accountHandle: "@akun-c2",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      {
        // Hanya conn-c1 yang sudah di-ingest — conn-c2 belum sama sekali,
        // mensimulasikan job cron metrik (KI-003) yang belum sempat jalan
        // untuk target akun ini.
        getPostMetricsByPosts: async () => new Map([[postC, [metricC1]]]),
      },
    );

    const result = await service.getPostPerformance(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual([
      {
        postId: postC,
        connectedAccountId: connC1,
        caption: "Caption post C",
        platform: SocialPlatform.Instagram,
        accountHandle: "@akun-c1",
        reach: 300,
        engagementRate: 0.2,
        likes: 10,
        comments: 2,
      },
      {
        postId: postC,
        connectedAccountId: connC2,
        caption: "Caption post C",
        platform: SocialPlatform.TikTok,
        accountHandle: "@akun-c2",
        reach: null,
        engagementRate: null,
        likes: null,
        comments: null,
      },
    ]);
  });

  // T-045.1 — `asOf` dipakai `getComparativeReport` untuk menghitung rentang
  // "periode sebelumnya". Test langsung ke method yang di-extend (bukan
  // cuma lewat `getComparativeReport`), memverifikasi rentang yang dihasilkan
  // benar: `asOf` jadi titik akhir rentang (bukan `now` real), sehingga post
  // yang jatuh dalam window "weekly" relatif ke `asOf` disertakan, post yang
  // di luar window itu (baik lebih tua maupun lebih baru, termasuk post yang
  // justru masuk window "weekly" relatif ke `now` sungguhan) dikecualikan.
  it("uses asOf as the end of the range instead of the real now, when supplied", async () => {
    const NOW = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const asOf = new Date(NOW - 10 * DAY_MS);

    const postWithinAsOfWindow = asPostId("post-within-asof-window");
    const postOutsideAsOfWindow = asPostId("post-outside-asof-window");
    const postWithinRealNowButNotAsOf = asPostId(
      "post-within-real-now-not-asof",
    );
    const conn1 = asConnectedAccountId("conn-asof");

    function target(id: string) {
      return {
        id: asPostTargetId(id),
        connectedAccountId: conn1,
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
        accountHandle: "@akun-asof",
        status: "published" as const,
        platformPostUrl: null,
        error: null,
      };
    }

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          // 12 hari sebelum `now` sungguhan = 2 hari sebelum `asOf` — di
          // dalam window "weekly" relatif ke `asOf` ([asOf-7d, asOf]).
          createHistoryItem({
            id: postWithinAsOfWindow,
            publishedAt: new Date(NOW - 12 * DAY_MS),
            targets: [target("target-within-asof")],
          }),
          // 20 hari sebelum `now` sungguhan — di luar window "weekly"
          // relatif ke `asOf` mana pun (lebih tua dari `asOf - 7 hari`).
          createHistoryItem({
            id: postOutsideAsOfWindow,
            publishedAt: new Date(NOW - 20 * DAY_MS),
            targets: [target("target-outside-asof")],
          }),
          // 3 hari sebelum `now` sungguhan — DI DALAM window "weekly"
          // relatif ke `now` real, TAPI setelah `asOf` (NOW - 10d), jadi
          // HARUS dikecualikan ketika `asOf` dipakai sebagai titik akhir.
          createHistoryItem({
            id: postWithinRealNowButNotAsOf,
            publishedAt: new Date(NOW - 3 * DAY_MS),
            targets: [target("target-within-real-now")],
          }),
        ],
      }),
      { getPostMetricsByPosts: async () => new Map() },
    );

    const result = await service.getPostPerformance(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
      asOf,
    );

    expect(result.map((row) => row.postId)).toEqual([postWithinAsOfWindow]);
  });
});

// T-046.1 — Account Overview `/analyze`. Reuse `getPostPerformance` di atas
// (period range + join metrik sudah teruji sendiri), jadi test di sini
// fokus ke agregasi per akun + kriteria "belum ada data" (akun tanpa post
// TETAP disertakan, `totalPosts: 0`/`totalReach: null`, bukan skip/0).
describe("PublishingService.getAccountOverview", () => {
  const NOW = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WITHIN_WEEK = new Date(NOW - 3 * DAY_MS);

  it("throws when no ConnectedAccountsPort is supplied", async () => {
    const service = new PublishingService(
      createFakeRepository({ listHistory: async () => [] }),
      { getPostMetricsByPosts: async () => new Map() },
    );

    await expect(
      service.getAccountOverview(WORKSPACE_ID, "weekly", AUTHOR_ID),
    ).rejects.toThrow(/ConnectedAccountsPort/);
  });

  it("includes an account with zero posts in the period as totalPosts: 0, totalReach: null (not skipped, not 0)", async () => {
    const connWithPost = asConnectedAccountId("conn-with-post");
    const connWithoutPost = asConnectedAccountId("conn-without-post");
    const postA = asPostId("post-a");

    const metricA: PostMetricsRecord = {
      id: asPostMetricsId("metric-a"),
      postId: postA,
      connectedAccountId: connWithPost,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 200,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1,
      fetchedAt: new Date(0),
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postA,
            caption: "Caption post A",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-a"),
                connectedAccountId: connWithPost,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-with-post",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      { getPostMetricsByPosts: async () => new Map([[postA, [metricA]]]) },
      {
        listConnectedAccounts: async () => [
          {
            id: connWithPost,
            platform: SocialPlatform.Instagram,
            handle: "@akun-with-post",
            status: "active",
            reconnectRequired: false,
          },
          {
            id: connWithoutPost,
            platform: SocialPlatform.TikTok,
            handle: "@akun-without-post",
            status: "active",
            reconnectRequired: false,
          },
        ],
      },
    );

    const result = await service.getAccountOverview(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual([
      {
        connectedAccountId: connWithPost,
        platform: SocialPlatform.Instagram,
        accountHandle: "@akun-with-post",
        totalPosts: 1,
        totalReach: 200,
      },
      {
        connectedAccountId: connWithoutPost,
        platform: SocialPlatform.TikTok,
        accountHandle: "@akun-without-post",
        totalPosts: 0,
        totalReach: null,
      },
    ]);
  });

  it("sums reach across multiple posts for the same account and counts distinct posts, sorted by totalReach descending", async () => {
    const conn1 = asConnectedAccountId("conn-1-multi");
    const postA = asPostId("post-multi-a");
    const postB = asPostId("post-multi-b");

    const metricA: PostMetricsRecord = {
      id: asPostMetricsId("metric-multi-a"),
      postId: postA,
      connectedAccountId: conn1,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 100,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1,
      fetchedAt: new Date(0),
    };
    const metricB: PostMetricsRecord = {
      ...metricA,
      id: asPostMetricsId("metric-multi-b"),
      postId: postB,
      reach: 150,
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postA,
            caption: "Post A",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-multi-a"),
                connectedAccountId: conn1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-multi",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
          createHistoryItem({
            id: postB,
            caption: "Post B",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-multi-b"),
                connectedAccountId: conn1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-multi",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      {
        getPostMetricsByPosts: async () =>
          new Map([
            [postA, [metricA]],
            [postB, [metricB]],
          ]),
      },
      {
        listConnectedAccounts: async () => [
          {
            id: conn1,
            platform: SocialPlatform.Instagram,
            handle: "@akun-multi",
            status: "active",
            reconnectRequired: false,
          },
        ],
      },
    );

    const result = await service.getAccountOverview(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual([
      {
        connectedAccountId: conn1,
        platform: SocialPlatform.Instagram,
        accountHandle: "@akun-multi",
        totalPosts: 2,
        totalReach: 250,
      },
    ]);
  });

  it("returns totalReach: null when the account has posts in range but none have an ingested AnalyticsPostMetric yet (distinct from totalPosts: 0)", async () => {
    const conn1 = asConnectedAccountId("conn-no-metric");
    const postA = asPostId("post-no-metric");

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postA,
            caption: "Post A",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-no-metric"),
                connectedAccountId: conn1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-no-metric",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      // Belum ada baris `AnalyticsPostMetric` sama sekali untuk post ini —
      // mensimulasikan job cron ingestion (KI-003 chain) yang belum jalan.
      { getPostMetricsByPosts: async () => new Map() },
      {
        listConnectedAccounts: async () => [
          {
            id: conn1,
            platform: SocialPlatform.Instagram,
            handle: "@akun-no-metric",
            status: "active",
            reconnectRequired: false,
          },
        ],
      },
    );

    const result = await service.getAccountOverview(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual([
      {
        connectedAccountId: conn1,
        platform: SocialPlatform.Instagram,
        accountHandle: "@akun-no-metric",
        totalPosts: 1,
        totalReach: null,
      },
    ]);
  });
});

// T-047.1 — Summary row `/analyze` (3 stat card: Total Posts, Total Reach,
// Engagement Rate). Reuse `getPostPerformance` di atas (period range + join
// metrik sudah teruji sendiri), jadi test di sini fokus ke agregasi flat
// (bukan distinct post count) + kriteria "belum ada data" (null, bukan 0).
describe("PublishingService.getAnalyzeSummary", () => {
  const NOW = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WITHIN_WEEK = new Date(NOW - 3 * DAY_MS);
  const OUTSIDE_WEEK = new Date(NOW - 10 * DAY_MS);

  it("returns totalPosts: 0, totalReach: null, avgEngagementRate: null when no post falls inside the period range", async () => {
    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: asPostId("post-outside-range"),
            publishedAt: OUTSIDE_WEEK,
          }),
        ],
      }),
      { getPostMetricsByPosts: async () => new Map() },
    );

    const result = await service.getAnalyzeSummary(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual({
      totalPosts: 0,
      totalReach: null,
      avgEngagementRate: null,
    });
  });

  it("sums totalPosts flat across post x target rows (not distinct post count), sums totalReach, and averages engagementRate", async () => {
    const postA = asPostId("post-a");
    const postB = asPostId("post-b");
    const connA1 = asConnectedAccountId("conn-a1");
    const connA2 = asConnectedAccountId("conn-a2");
    const connB1 = asConnectedAccountId("conn-b1");

    const metricA1: PostMetricsRecord = {
      id: asPostMetricsId("metric-a1"),
      postId: postA,
      connectedAccountId: connA1,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 200,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1,
      fetchedAt: new Date(0),
    };
    const metricA2: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-a2"),
      connectedAccountId: connA2,
      platform: SocialPlatform.TikTok,
      reach: 900,
      engagementRate: 0.3,
    };
    const metricB1: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-b1"),
      postId: postB,
      connectedAccountId: connB1,
      reach: 50,
      engagementRate: 0.05,
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postA,
            caption: "Caption post A",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-a1"),
                connectedAccountId: connA1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-a1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
              {
                id: asPostTargetId("target-a2"),
                connectedAccountId: connA2,
                platform: SocialPlatform.TikTok,
                contentFormat: ContentFormat.Reel,
                accountHandle: "@akun-a2",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
          createHistoryItem({
            id: postB,
            caption: "Caption post B",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-b1"),
                connectedAccountId: connB1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-b1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      {
        getPostMetricsByPosts: async () =>
          new Map([
            [postA, [metricA1, metricA2]],
            [postB, [metricB1]],
          ]),
      },
    );

    const result = await service.getAnalyzeSummary(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    // totalPosts = 3 baris post x target (postA punya 2 target, postB 1),
    // BUKAN 2 (distinct post) — keputusan T-047.1.
    expect(result).toEqual({
      totalPosts: 3,
      totalReach: 200 + 900 + 50,
      avgEngagementRate: (0.1 + 0.3 + 0.05) / 3,
    });
  });

  it("excludes rows without an ingested AnalyticsPostMetric from totalReach/avgEngagementRate accumulation, but still counts them in totalPosts (T-043.4 pattern)", async () => {
    const postC = asPostId("post-c");
    const connC1 = asConnectedAccountId("conn-c1");
    const connC2 = asConnectedAccountId("conn-c2");

    const metricC1: PostMetricsRecord = {
      id: asPostMetricsId("metric-c1"),
      postId: postC,
      connectedAccountId: connC1,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 300,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.2,
      fetchedAt: new Date(0),
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postC,
            caption: "Caption post C",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-c1"),
                connectedAccountId: connC1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-c1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
              {
                id: asPostTargetId("target-c2"),
                connectedAccountId: connC2,
                platform: SocialPlatform.TikTok,
                contentFormat: ContentFormat.Reel,
                accountHandle: "@akun-c2",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      {
        // Hanya conn-c1 yang sudah di-ingest — conn-c2 belum sama sekali.
        getPostMetricsByPosts: async () => new Map([[postC, [metricC1]]]),
      },
    );

    const result = await service.getAnalyzeSummary(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    // totalPosts tetap 2 (kedua baris target disertakan, T-043.4), tapi
    // totalReach/avgEngagementRate hanya dari baris yang sudah ter-ingest.
    expect(result).toEqual({
      totalPosts: 2,
      totalReach: 300,
      avgEngagementRate: 0.2,
    });
  });
});

// T-044 — card "Engagement Summary" `/analyze` (scope dipersempit lewat
// `AskUserQuestion`, lihat catatan keputusan lengkap di
// `EngagementSummary`/`PublishingService.getEngagementSummary`). Reuse
// `getPostPerformance` di atas (period range + join metrik sudah teruji
// sendiri) — test di sini fokus ke akumulasi null-safe `likes`/`comments`,
// pola SAMA PERSIS `getAnalyzeSummary` di atas.
describe("PublishingService.getEngagementSummary", () => {
  const NOW = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WITHIN_WEEK = new Date(NOW - 3 * DAY_MS);
  const OUTSIDE_WEEK = new Date(NOW - 10 * DAY_MS);

  it("returns totalComments: null, totalLikes: null when no post falls inside the period range", async () => {
    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: asPostId("post-outside-range"),
            publishedAt: OUTSIDE_WEEK,
          }),
        ],
      }),
      { getPostMetricsByPosts: async () => new Map() },
    );

    const result = await service.getEngagementSummary(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual({
      totalComments: null,
      totalLikes: null,
    });
  });

  it("returns totalComments: null, totalLikes: null when posts exist but no AnalyticsPostMetric has been ingested yet", async () => {
    const postA = asPostId("post-a");
    const connA1 = asConnectedAccountId("conn-a1");

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postA,
            caption: "Caption post A",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-a1"),
                connectedAccountId: connA1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-a1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      { getPostMetricsByPosts: async () => new Map() },
    );

    const result = await service.getEngagementSummary(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual({
      totalComments: null,
      totalLikes: null,
    });
  });

  it("sums only the rows with an ingested AnalyticsPostMetric when some targets are not yet ingested (T-043.4 pattern)", async () => {
    const postC = asPostId("post-c");
    const connC1 = asConnectedAccountId("conn-c1");
    const connC2 = asConnectedAccountId("conn-c2");

    const metricC1: PostMetricsRecord = {
      id: asPostMetricsId("metric-c1"),
      postId: postC,
      connectedAccountId: connC1,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 300,
      likes: 15,
      comments: 4,
      shares: 1,
      clicks: null,
      engagementRate: 0.2,
      fetchedAt: new Date(0),
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postC,
            caption: "Caption post C",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-c1"),
                connectedAccountId: connC1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-c1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
              {
                id: asPostTargetId("target-c2"),
                connectedAccountId: connC2,
                platform: SocialPlatform.TikTok,
                contentFormat: ContentFormat.Reel,
                accountHandle: "@akun-c2",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      {
        // Hanya conn-c1 yang sudah di-ingest — conn-c2 belum sama sekali.
        getPostMetricsByPosts: async () => new Map([[postC, [metricC1]]]),
      },
    );

    const result = await service.getEngagementSummary(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual({
      totalComments: 4,
      totalLikes: 15,
    });
  });

  it("sums totalComments/totalLikes flat across post x target rows when everything is ingested", async () => {
    const postA = asPostId("post-a");
    const postB = asPostId("post-b");
    const connA1 = asConnectedAccountId("conn-a1");
    const connA2 = asConnectedAccountId("conn-a2");
    const connB1 = asConnectedAccountId("conn-b1");

    const metricA1: PostMetricsRecord = {
      id: asPostMetricsId("metric-a1"),
      postId: postA,
      connectedAccountId: connA1,
      platform: SocialPlatform.Instagram,
      impressions: 500,
      reach: 200,
      likes: 10,
      comments: 2,
      shares: 1,
      clicks: null,
      engagementRate: 0.1,
      fetchedAt: new Date(0),
    };
    const metricA2: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-a2"),
      connectedAccountId: connA2,
      platform: SocialPlatform.TikTok,
      likes: 20,
      comments: 5,
    };
    const metricB1: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-b1"),
      postId: postB,
      connectedAccountId: connB1,
      likes: 8,
      comments: 1,
    };

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postA,
            caption: "Caption post A",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-a1"),
                connectedAccountId: connA1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-a1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
              {
                id: asPostTargetId("target-a2"),
                connectedAccountId: connA2,
                platform: SocialPlatform.TikTok,
                contentFormat: ContentFormat.Reel,
                accountHandle: "@akun-a2",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
          createHistoryItem({
            id: postB,
            caption: "Caption post B",
            publishedAt: WITHIN_WEEK,
            targets: [
              {
                id: asPostTargetId("target-b1"),
                connectedAccountId: connB1,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-b1",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
        ],
      }),
      {
        getPostMetricsByPosts: async () =>
          new Map([
            [postA, [metricA1, metricA2]],
            [postB, [metricB1]],
          ]),
      },
    );

    const result = await service.getEngagementSummary(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual({
      totalComments: 2 + 5 + 1,
      totalLikes: 10 + 20 + 8,
    });
  });
});

// T-045.1/T-045.2 — tab "Reports" `/analyze` Comparative Reports. Reuse
// `getPostPerformance` di atas (period range + join metrik sudah teruji
// sendiri) dua kali (current + previous, lewat `asOf`) — test di sini
// fokus ke agregasi current vs previous, null-safety independen per sisi,
// dan kriteria "belum ada data" untuk akun tanpa post di kedua periode.
describe("PublishingService.getComparativeReport", () => {
  const NOW = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  // Rentang "weekly": current = [NOW-7d, NOW], previous = [NOW-14d, NOW-7d]
  // (persis bersebelahan, tanpa gap/overlap — lihat catatan `ComparativeReport`).
  const WITHIN_CURRENT = new Date(NOW - 3 * DAY_MS);
  const WITHIN_PREVIOUS = new Date(NOW - 10 * DAY_MS);
  const OUTSIDE_BOTH = new Date(NOW - 20 * DAY_MS);

  it("throws when no ConnectedAccountsPort is supplied", async () => {
    const service = new PublishingService(
      createFakeRepository({ listHistory: async () => [] }),
      { getPostMetricsByPosts: async () => new Map() },
    );

    await expect(
      service.getComparativeReport(WORKSPACE_ID, "weekly", AUTHOR_ID),
    ).rejects.toThrow(/ConnectedAccountsPort/);
  });

  it("aggregates totalPosts/totalReach/avgEngagementRate and per-account reach independently for current vs previous, sorted by reach.current descending with null-current accounts last", async () => {
    const connA = asConnectedAccountId("conn-a-cmp");
    const connB = asConnectedAccountId("conn-b-cmp");
    const connC = asConnectedAccountId("conn-c-cmp");
    const postCurrentA = asPostId("post-current-a");
    const postPreviousA = asPostId("post-previous-a");
    const postPreviousB = asPostId("post-previous-b");
    const postOld = asPostId("post-old-cmp");

    function metric(
      overrides: Partial<PostMetricsRecord> & {
        postId: PostId;
        connectedAccountId: ReturnType<typeof asConnectedAccountId>;
      },
    ): PostMetricsRecord {
      return {
        id: asPostMetricsId(
          `metric-${overrides.postId}-${overrides.connectedAccountId}`,
        ),
        platform: SocialPlatform.Instagram,
        impressions: 500,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: null,
        engagementRate: 0,
        fetchedAt: new Date(0),
        ...overrides,
      };
    }

    function target(
      id: string,
      connectedAccountId: ReturnType<typeof asConnectedAccountId>,
    ) {
      return {
        id: asPostTargetId(id),
        connectedAccountId,
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
        accountHandle: "@akun-cmp",
        status: "published" as const,
        platformPostUrl: null,
        error: null,
      };
    }

    const metricCurrentA = metric({
      postId: postCurrentA,
      connectedAccountId: connA,
      reach: 100,
      engagementRate: 0.1,
    });
    const metricPreviousA = metric({
      postId: postPreviousA,
      connectedAccountId: connA,
      reach: 50,
      engagementRate: 0.05,
    });
    const metricPreviousB = metric({
      postId: postPreviousB,
      connectedAccountId: connB,
      reach: 30,
      engagementRate: 0.03,
    });
    const metricOld = metric({
      postId: postOld,
      connectedAccountId: connA,
      reach: 999,
      engagementRate: 0.9,
    });

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          createHistoryItem({
            id: postCurrentA,
            publishedAt: WITHIN_CURRENT,
            targets: [target("target-current-a", connA)],
          }),
          createHistoryItem({
            id: postPreviousA,
            publishedAt: WITHIN_PREVIOUS,
            targets: [target("target-previous-a", connA)],
          }),
          createHistoryItem({
            id: postPreviousB,
            publishedAt: WITHIN_PREVIOUS,
            targets: [target("target-previous-b", connB)],
          }),
          // Di luar KEDUA rentang (lebih tua dari previous) — sanity check
          // tidak ikut terhitung di current maupun previous.
          createHistoryItem({
            id: postOld,
            publishedAt: OUTSIDE_BOTH,
            targets: [target("target-old", connA)],
          }),
        ],
      }),
      {
        getPostMetricsByPosts: async () =>
          new Map([
            [postCurrentA, [metricCurrentA]],
            [postPreviousA, [metricPreviousA]],
            [postPreviousB, [metricPreviousB]],
            [postOld, [metricOld]],
          ]),
      },
      {
        listConnectedAccounts: async () => [
          {
            id: connA,
            platform: SocialPlatform.Instagram,
            handle: "@akun-a",
            status: "active",
            reconnectRequired: false,
          },
          {
            id: connB,
            platform: SocialPlatform.TikTok,
            handle: "@akun-b",
            status: "active",
            reconnectRequired: false,
          },
          // connC tidak pernah punya post di period manapun — kriteria
          // "belum ada data" T-045.2, tetap wajib muncul.
          {
            id: connC,
            platform: SocialPlatform.Facebook,
            handle: "@akun-c",
            status: "active",
            reconnectRequired: false,
          },
        ],
      },
    );

    const result = await service.getComparativeReport(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual({
      totalPosts: { current: 1, previous: 2 },
      totalReach: { current: 100, previous: 80 },
      avgEngagementRate: { current: 0.1, previous: (0.05 + 0.03) / 2 },
      accounts: [
        {
          connectedAccountId: connA,
          platform: SocialPlatform.Instagram,
          accountHandle: "@akun-a",
          reach: { current: 100, previous: 50 },
        },
        {
          connectedAccountId: connB,
          platform: SocialPlatform.TikTok,
          accountHandle: "@akun-b",
          reach: { current: null, previous: 30 },
        },
        {
          connectedAccountId: connC,
          platform: SocialPlatform.Facebook,
          accountHandle: "@akun-c",
          reach: { current: null, previous: null },
        },
      ],
    });
  });

  it("returns totalReach/avgEngagementRate null independently for current and previous when nothing is ingested/no post falls in range", async () => {
    const connA = asConnectedAccountId("conn-null-cmp");
    const postCurrent = asPostId("post-null-current");

    const service = new PublishingService(
      createFakeRepository({
        listHistory: async () => [
          // Post ada di current, tapi BELUM ter-ingest AnalyticsPostMetric
          // sama sekali — totalReach/avgEngagementRate current harus null,
          // TAPI totalPosts current tetap terhitung (baris tetap disertakan,
          // T-043.4 pattern).
          createHistoryItem({
            id: postCurrent,
            publishedAt: WITHIN_CURRENT,
            targets: [
              {
                id: asPostTargetId("target-null-current"),
                connectedAccountId: connA,
                platform: SocialPlatform.Instagram,
                contentFormat: ContentFormat.Post,
                accountHandle: "@akun-null",
                status: "published",
                platformPostUrl: null,
                error: null,
              },
            ],
          }),
          // Tidak ada post sama sekali di previous.
        ],
      }),
      { getPostMetricsByPosts: async () => new Map() },
      {
        listConnectedAccounts: async () => [
          {
            id: connA,
            platform: SocialPlatform.Instagram,
            handle: "@akun-null",
            status: "active",
            reconnectRequired: false,
          },
        ],
      },
    );

    const result = await service.getComparativeReport(
      WORKSPACE_ID,
      "weekly",
      AUTHOR_ID,
    );

    expect(result).toEqual({
      totalPosts: { current: 1, previous: 0 },
      totalReach: { current: null, previous: null },
      avgEngagementRate: { current: null, previous: null },
      accounts: [
        {
          connectedAccountId: connA,
          platform: SocialPlatform.Instagram,
          accountHandle: "@akun-null",
          reach: { current: null, previous: null },
        },
      ],
    });
  });
});

describe("PublishingService.deletePost", () => {
  function draftRecord(
    overrides: Partial<PublishingPostRecord> = {},
  ): PublishingPostRecord {
    return {
      id: asPostId("post-1"),
      workspaceId: WORKSPACE_ID,
      authorId: AUTHOR_ID,
      caption: "Hello",
      status: ContentStatus.Draft,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      ...overrides,
    };
  }

  it("soft delete post Draft — happy path, delegates ke repository lalu mengembalikan post yang sudah dihapus", async () => {
    const existing = draftRecord();
    const deleted: PublishingPostRecord = { ...existing };
    let received:
      Parameters<IPublishingRepository["softDeletePost"]>[0] | null = null;
    const service = new PublishingService(
      createFakeRepository({
        findDraftById: async () => existing,
        softDeletePost: async (input) => {
          received = input;
          return deleted;
        },
      }),
    );

    await expect(
      service.deletePost(
        {
          workspaceId: WORKSPACE_ID,
          postId: asPostId("post-1"),
          actorRole: MemberRole.Creator,
        },
        AUTHOR_ID,
      ),
    ).resolves.toBe(deleted);
    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      postId: asPostId("post-1"),
    });
  });

  it.each([
    ContentStatus.InReview,
    ContentStatus.ReadyToSchedule,
    ContentStatus.Scheduled,
    ContentStatus.Published,
    ContentStatus.Failed,
  ])(
    // Koreksi 2026-09-10: entry point Delete Post HANYA ada di Drafts —
    // King Rezi mengonfirmasi post Scheduled harus di-Cancel Schedule dulu
    // (kembali ke Draft) sebelum bisa dihapus, TIDAK bisa dihapus langsung
    // dari status manapun selain Draft.
    "guard: post berstatus %s DITOLAK ConflictError, TANPA memanggil softDeletePost",
    async (status) => {
      let softDeleteCalls = 0;
      const service = new PublishingService(
        createFakeRepository({
          findDraftById: async () => draftRecord({ status }),
          softDeletePost: async () => {
            softDeleteCalls += 1;
            return null;
          },
        }),
      );

      await expect(
        service.deletePost(
          {
            workspaceId: WORKSPACE_ID,
            postId: asPostId("post-1"),
            actorRole: MemberRole.Owner,
          },
          AUTHOR_ID,
        ),
      ).rejects.toThrow(ConflictError);
      expect(softDeleteCalls).toBe(0);
    },
  );

  it("throws NotFoundError kalau post tidak ditemukan sama sekali (findDraftById null)", async () => {
    const service = new PublishingService(
      createFakeRepository({ findDraftById: async () => null }),
    );

    await expect(
      service.deletePost(
        {
          workspaceId: WORKSPACE_ID,
          postId: asPostId("post-1"),
          actorRole: MemberRole.Admin,
        },
        AUTHOR_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError kalau softDeletePost mengembalikan null walau status sudah dicek Draft (race condition safety net)", async () => {
    const service = new PublishingService(
      createFakeRepository({
        findDraftById: async () => draftRecord(),
        softDeletePost: async () => null,
      }),
    );

    await expect(
      service.deletePost(
        {
          workspaceId: WORKSPACE_ID,
          postId: asPostId("post-1"),
          actorRole: MemberRole.Admin,
        },
        AUTHOR_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError untuk role di luar Owner/Admin/Creator, TANPA memanggil repository", async () => {
    let calls = 0;
    const service = new PublishingService(
      createFakeRepository({
        findDraftById: async () => {
          calls += 1;
          return draftRecord();
        },
      }),
    );

    await expect(
      service.deletePost(
        {
          workspaceId: WORKSPACE_ID,
          postId: asPostId("post-1"),
          // Cast sengaja — menyimulasikan role tidak valid/di luar 3 role
          // kanonikal, sama pola pengujian dengan RBAC lain di domain ini.
          actorRole: "viewer" as MemberRole,
        },
        AUTHOR_ID,
      ),
    ).rejects.toThrow(AuthorizationError);
    expect(calls).toBe(0);
  });
});
