import {
  asConnectedAccountId,
  asPostId,
  asPostTargetId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  SocialPlatform,
} from "@postific/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/utils/errors";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import type { IJobScheduler } from "../adapters/job-scheduler";
import { PublishingDomainError } from "../errors";
import type {
  IPublishingRepository,
  PublishingPostRecord,
  PublishingScheduleRecord,
} from "../repositories/publishing.repository";
import { SchedulePostsUseCase } from "./schedule-posts.use-case";

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

function createFakeOutstandAdapter(
  overrides: Partial<IOutstandAdapter> = {},
): IOutstandAdapter {
  return {
    connectAccount: async () => ({ redirectUrl: "/unused" }),
    listPendingFacebookPages: async () => ({ pages: [] }),
    confirmFacebookPagesConnection: async () => ({ accounts: [] }),
    listPinterestBoards: async () => [],
    uploadMediaWorkingCopy: async () => ({
      outstandMediaId: "unused",
      outstandMediaUrl: "https://fake.outstand.local/media/unused",
      expiresAt: new Date(),
    }),
    resolveConnectCallback: async () => ({
      outstandAccountId: "unused",
      platform: "instagram" as never,
      handle: "unused",
      status: "active",
    }),
    schedulePost: async () => ({ outstandPostId: "fake-post" }),
    publishNow: async () => ({ outstandPostId: "fake-post" }),
    fetchPostOutcome: async () => [],
    cancelScheduledPost: async () => undefined,
    deletePost: async () => undefined,
    fetchPostMetrics: async () => ({
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: null,
      engagementRate: 0,
    }),
    fetchWorkspaceMetrics: async () => ({
      totalPosts: 0,
      totalReach: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
    }),
    fetchComments: async () => ({ comments: [], nextCursor: null }),
    replyToComment: async () => ({ outstandReplyId: "fake-reply" }),
    importPosts: async () => ({ importJobId: "fake-import-job" }),
    fetchImportJobStatus: async () => ({
      status: "completed" as const,
      posts: [],
      error: null,
    }),
    ...overrides,
  };
}

function createFakeJobScheduler(
  overrides: Partial<IJobScheduler> = {},
): IJobScheduler {
  return {
    scheduleJob: async () => undefined,
    ...overrides,
  };
}

describe("SchedulePostsUseCase.execute", () => {
  // T-108.2 (KI-044): `assertScheduledAtNotInPast` membandingkan `SCHEDULED_AT`
  // di bawah terhadap `new Date()` sungguhan. `SCHEDULED_AT` adalah tanggal
  // tetap (fixture lama, dari sebelum T-108 ada) — tanpa fake timers, fixture
  // itu perlahan jadi "masa lalu" seiring waktu berjalan dan seluruh test di
  // file ini gagal karena guard yang baru ditambah, bukan karena regresi
  // sungguhan. `beforeAll`/`afterAll` mengunci "now" ke satu titik SEBELUM
  // `SCHEDULED_AT` supaya deterministik selamanya.
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  const POST_ID = asPostId("post-1");
  const SCHEDULED_AT = new Date("2026-08-10T10:00:00Z");
  const CONNECTED_ACCOUNT_1 = asConnectedAccountId("conn-1");
  const CONNECTED_ACCOUNT_2 = asConnectedAccountId("conn-2");
  // Akun ini sengaja TIDAK ada di "owned set" repository palsu di bawah —
  // mensimulasikan connectedAccountId yang sebenarnya milik workspace lain
  // (skenario IDOR, temuan review Ridwan Architecture Reviewer).
  const FOREIGN_CONNECTED_ACCOUNT = asConnectedAccountId("conn-foreign");

  function baseScheduleRecord(
    targets: PublishingScheduleRecord["targets"],
  ): PublishingScheduleRecord {
    return {
      id: POST_ID,
      workspaceId: WORKSPACE_ID,
      authorId: AUTHOR_ID,
      caption: "Hello world",
      status: ContentStatus.Scheduled,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      targets,
    };
  }

  it("happy path: schedules 2 valid targets with ONE adapter call for all targets, persists the shared outstandPostId, and marks each target scheduled", async () => {
    const scheduleRecord = baseScheduleRecord([
      {
        id: asPostTargetId("target-1"),
        connectedAccountId: CONNECTED_ACCOUNT_1,
      },
      {
        id: asPostTargetId("target-2"),
        connectedAccountId: CONNECTED_ACCOUNT_2,
      },
    ]);

    const outcomes: Parameters<
      IPublishingRepository["updateTargetOutcome"]
    >[0][] = [];
    const outstandPostIdCalls: Parameters<
      IPublishingRepository["setOutstandPostId"]
    >[0][] = [];
    let schedulePostCallCount = 0;
    const repository = createFakeRepository({
      schedulePost: async () => scheduleRecord,
      updateTargetOutcome: async (input) => {
        outcomes.push(input);
      },
      setOutstandPostId: async (input) => {
        outstandPostIdCalls.push(input);
      },
    });
    const adapter = createFakeOutstandAdapter({
      schedulePost: async ({ targets }) => {
        schedulePostCallCount += 1;
        expect(targets).toHaveLength(2);
        return { outstandPostId: "fake-post-shared" };
      },
    });
    const scheduledJobs: Parameters<IJobScheduler["scheduleJob"]>[0][] = [];
    const jobScheduler = createFakeJobScheduler({
      scheduleJob: async (input) => {
        scheduledJobs.push(input);
      },
    });

    const useCase = new SchedulePostsUseCase(repository, adapter, jobScheduler);

    const result = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      scheduledAt: SCHEDULED_AT,
      targets: [
        {
          connectedAccountId: CONNECTED_ACCOUNT_1,
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Post,
          outstandAccountId: "outstand-acc-1",
        },
        {
          connectedAccountId: CONNECTED_ACCOUNT_2,
          platform: SocialPlatform.Facebook,
          contentFormat: ContentFormat.Reel,
          outstandAccountId: "outstand-acc-2",
        },
      ],
      actingUserId: AUTHOR_ID,
    });

    expect(result).toBe(scheduleRecord);
    // SATU call ke adapter untuk semua target (redesain 2026-08-26) —
    // bukan 1 call per target seperti model lama.
    expect(schedulePostCallCount).toBe(1);
    expect(outstandPostIdCalls).toEqual([
      {
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        outstandPostId: "fake-post-shared",
      },
    ]);
    expect(outcomes).toEqual(
      expect.arrayContaining([
        { postTargetId: asPostTargetId("target-1"), status: "scheduled" },
        { postTargetId: asPostTargetId("target-2"), status: "scheduled" },
      ]),
    );
    expect(outcomes).toHaveLength(2);
    // T-027.5 — job polling outcome di-enqueue SEKALI, payload
    // `outstandPostId` (bukan `postId`), `scheduledAt` job = `scheduledAt`
    // post (lihat catatan panjang di `SchedulePostsUseCase`).
    expect(scheduledJobs).toEqual([
      {
        type: "publishing.scheduled_post.resolve_outcome",
        payload: { outstandPostId: "fake-post-shared" },
        scheduledAt: SCHEDULED_AT,
      },
    ]);
  });

  it("bug fix (review Ridwan Architecture Reviewer): does NOT mark the post/targets failed when the Outstand call succeeds but enqueueing the outcome job throws — the post really is scheduled on Outstand's side", async () => {
    const scheduleRecord = baseScheduleRecord([
      {
        id: asPostTargetId("target-1"),
        connectedAccountId: CONNECTED_ACCOUNT_1,
      },
      {
        id: asPostTargetId("target-2"),
        connectedAccountId: CONNECTED_ACCOUNT_2,
      },
    ]);
    const outcomes: Parameters<
      IPublishingRepository["updateTargetOutcome"]
    >[0][] = [];
    const markPostFailed = vi.fn(async () => undefined);
    const repository = createFakeRepository({
      schedulePost: async () => scheduleRecord,
      updateTargetOutcome: async (input) => {
        outcomes.push(input);
      },
      markPostFailed,
    });
    const adapter = createFakeOutstandAdapter({
      schedulePost: async () => ({ outstandPostId: "fake-post-shared" }),
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const jobScheduler = createFakeJobScheduler({
      scheduleJob: async () => {
        throw new Error("BackgroundJob insert failed — DB unreachable");
      },
    });
    const useCase = new SchedulePostsUseCase(repository, adapter, jobScheduler);

    const result = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      scheduledAt: SCHEDULED_AT,
      targets: [
        {
          connectedAccountId: CONNECTED_ACCOUNT_1,
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Post,
          outstandAccountId: "outstand-acc-1",
        },
        {
          connectedAccountId: CONNECTED_ACCOUNT_2,
          platform: SocialPlatform.Facebook,
          contentFormat: ContentFormat.Reel,
          outstandAccountId: "outstand-acc-2",
        },
      ],
      actingUserId: AUTHOR_ID,
    });

    // Post/target TETAP "scheduled" — enqueue job gagal bukan berarti
    // publish/schedule gagal (bug lama: exception ini sebelumnya tertangkap
    // oleh catch yang sama dengan kegagalan adapter, jadi salah menandai
    // post/target `failed` walau Outstand sudah benar-benar menjadwalkannya).
    expect(result).toBe(scheduleRecord);
    expect(outcomes).toEqual(
      expect.arrayContaining([
        { postTargetId: asPostTargetId("target-1"), status: "scheduled" },
        { postTargetId: asPostTargetId("target-2"), status: "scheduled" },
      ]),
    );
    expect(outcomes).toHaveLength(2);
    expect(markPostFailed).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("gagal enqueue job resolve-outcome"),
    );

    consoleErrorSpy.mockRestore();
  });

  it("all targets are marked failed and the post is marked Failed when the single adapter call rejects", async () => {
    const scheduleRecord = baseScheduleRecord([
      {
        id: asPostTargetId("target-1"),
        connectedAccountId: CONNECTED_ACCOUNT_1,
      },
      {
        id: asPostTargetId("target-2"),
        connectedAccountId: CONNECTED_ACCOUNT_2,
      },
    ]);
    const outcomes: Parameters<
      IPublishingRepository["updateTargetOutcome"]
    >[0][] = [];
    let markPostFailedCalled = false;
    const repository = createFakeRepository({
      schedulePost: async () => scheduleRecord,
      updateTargetOutcome: async (input) => {
        outcomes.push(input);
      },
      markPostFailed: async () => {
        markPostFailedCalled = true;
      },
    });
    const adapter = createFakeOutstandAdapter({
      schedulePost: async () => {
        throw new Error("Outstand unreachable");
      },
    });
    const scheduleJob = vi.fn(async () => undefined);
    const useCase = new SchedulePostsUseCase(
      repository,
      adapter,
      createFakeJobScheduler({ scheduleJob }),
    );

    await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      scheduledAt: SCHEDULED_AT,
      targets: [
        {
          connectedAccountId: CONNECTED_ACCOUNT_1,
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Post,
          outstandAccountId: "outstand-acc-1",
        },
        {
          connectedAccountId: CONNECTED_ACCOUNT_2,
          platform: SocialPlatform.Facebook,
          contentFormat: ContentFormat.Reel,
          outstandAccountId: "outstand-acc-2",
        },
      ],
      actingUserId: AUTHOR_ID,
    });

    expect(outcomes).toEqual(
      expect.arrayContaining([
        {
          postTargetId: asPostTargetId("target-1"),
          status: "failed",
          error: "Outstand unreachable",
        },
        {
          postTargetId: asPostTargetId("target-2"),
          status: "failed",
          error: "Outstand unreachable",
        },
      ]),
    );
    expect(markPostFailedCalled).toBe(true);
    // T-027.5 — tidak ada yang perlu di-poll kalau adapter call-nya sendiri
    // sudah gagal (all-or-nothing, sudah `markPostFailed` di atas).
    expect(scheduleJob).not.toHaveBeenCalled();
  });

  it("rejects a content format not allowed for the platform before calling repository or adapter", async () => {
    let repositoryCalled = false;
    let adapterCalled = false;
    const repository = createFakeRepository({
      schedulePost: async () => {
        repositoryCalled = true;
        return null;
      },
    });
    const adapter = createFakeOutstandAdapter({
      schedulePost: async () => {
        adapterCalled = true;
        return { outstandPostId: "should-not-happen" };
      },
    });
    const useCase = new SchedulePostsUseCase(
      repository,
      adapter,
      createFakeJobScheduler(),
    );

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        scheduledAt: SCHEDULED_AT,
        targets: [
          {
            connectedAccountId: CONNECTED_ACCOUNT_1,
            // TikTok tidak termasuk Instagram/Facebook/Pinterest di matriks
            // ADR-039 — hanya Post yang diizinkan, Story harus ditolak.
            platform: SocialPlatform.TikTok,
            contentFormat: ContentFormat.Story,
            outstandAccountId: "outstand-acc-1",
          },
        ],
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(PublishingDomainError);

    expect(repositoryCalled).toBe(false);
    expect(adapterCalled).toBe(false);
  });

  it("T-108.2 (KI-044): rejects a scheduledAt already in the past before calling repository or adapter", async () => {
    let repositoryCalled = false;
    let adapterCalled = false;
    const repository = createFakeRepository({
      schedulePost: async () => {
        repositoryCalled = true;
        return null;
      },
    });
    const adapter = createFakeOutstandAdapter({
      schedulePost: async () => {
        adapterCalled = true;
        return { outstandPostId: "should-not-happen" };
      },
    });
    const useCase = new SchedulePostsUseCase(
      repository,
      adapter,
      createFakeJobScheduler(),
    );

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        // "now" terkunci ke 2026-08-01 (lihat beforeAll di atas) — tanggal
        // ini sudah lewat relatif terhadap itu.
        scheduledAt: new Date("2026-07-01T08:00:00Z"),
        targets: [
          {
            connectedAccountId: CONNECTED_ACCOUNT_1,
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Post,
            outstandAccountId: "outstand-acc-1",
          },
        ],
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(PublishingDomainError);

    expect(repositoryCalled).toBe(false);
    expect(adapterCalled).toBe(false);
  });

  it("throws when the repository guard rejects the post (not Draft/ReadyToSchedule)", async () => {
    const repository = createFakeRepository({
      schedulePost: async () => null,
    });
    const adapter = createFakeOutstandAdapter();
    const useCase = new SchedulePostsUseCase(
      repository,
      adapter,
      createFakeJobScheduler(),
    );

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        scheduledAt: SCHEDULED_AT,
        targets: [
          {
            connectedAccountId: CONNECTED_ACCOUNT_1,
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Post,
            outstandAccountId: "outstand-acc-1",
          },
        ],
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects when a connectedAccountId does not belong to the workspace (IDOR guard) — no target inserted, adapter never called", async () => {
    // Repository palsu ini meniru guard ownership yang sebenarnya hidup di
    // publishing.repository.ts (Prisma): kalau salah satu connectedAccountId
    // di targets bukan bagian dari "owned set" workspace ini, transaksi
    // dibatalkan dan schedulePost mengembalikan null — sama seperti guard
    // status Draft/ReadyToSchedule yang gagal.
    const ownedAccountIds = new Set([CONNECTED_ACCOUNT_1]);
    let adapterCalled = false;
    let updateTargetOutcomeCalled = false;
    const repository = createFakeRepository({
      schedulePost: async ({ targets }) => {
        const allOwned = targets.every((target) =>
          ownedAccountIds.has(target.connectedAccountId),
        );
        if (!allOwned) {
          return null;
        }
        return {
          id: POST_ID,
          workspaceId: WORKSPACE_ID,
          authorId: AUTHOR_ID,
          caption: "Hello world",
          status: ContentStatus.Scheduled,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          targets: [
            {
              id: asPostTargetId("target-1"),
              connectedAccountId: CONNECTED_ACCOUNT_1,
            },
          ],
        };
      },
      updateTargetOutcome: async () => {
        updateTargetOutcomeCalled = true;
      },
    });
    const adapter = createFakeOutstandAdapter({
      schedulePost: async () => {
        adapterCalled = true;
        return { outstandPostId: "should-not-happen" };
      },
    });
    const useCase = new SchedulePostsUseCase(
      repository,
      adapter,
      createFakeJobScheduler(),
    );

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        scheduledAt: SCHEDULED_AT,
        targets: [
          {
            connectedAccountId: CONNECTED_ACCOUNT_1,
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Post,
            outstandAccountId: "outstand-acc-1",
          },
          {
            // Milik workspace lain — harus membuat seluruh permintaan ditolak,
            // bukan hanya target ini.
            connectedAccountId: FOREIGN_CONNECTED_ACCOUNT,
            platform: SocialPlatform.Facebook,
            contentFormat: ContentFormat.Post,
            outstandAccountId: "outstand-acc-foreign",
          },
        ],
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(ConflictError);

    expect(adapterCalled).toBe(false);
    expect(updateTargetOutcomeCalled).toBe(false);
  });
});
