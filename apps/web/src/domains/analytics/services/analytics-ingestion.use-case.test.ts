import {
  asConnectedAccountId,
  asPostId,
  asPostMetricsId,
  asUserId,
  asWorkspaceId,
  asWorkspaceSnapshotId,
  type IOutstandAdapter,
  type UserId,
  type WorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { noopFetchAllPostIdMappings } from "@/lib/testing/outstand-post-id-backfill-stubs";
import type {
  IAnalyticsRepository,
  PostMetricsRecord,
  UpsertPostMetricInput,
  UpsertWorkspaceSnapshotInput,
  WorkspaceSnapshotRecord,
} from "../repositories/analytics.repository";
import {
  AnalyticsIngestionUseCase,
  type TerminalPostsCountPort,
} from "./analytics-ingestion.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const POST_ID = asPostId("post-1");
const CONNECTED_ACCOUNT_1 = asConnectedAccountId("conn-1");
const CONNECTED_ACCOUNT_2 = asConnectedAccountId("conn-2");
const ACTING_USER_ID = asUserId("user-1");

function createFakeRepository(
  overrides: Partial<IAnalyticsRepository> = {},
): IAnalyticsRepository {
  return {
    findMetricsByPosts: async () => [],
    findLatestWorkspaceSnapshot: async () => null,
    upsertPostMetrics: async (input) =>
      ({
        id: asPostMetricsId(
          `metric-${input.postId}-${input.connectedAccountId}`,
        ),
        ...input,
      }) as PostMetricsRecord,
    upsertWorkspaceSnapshot: async (input) =>
      ({
        id: asWorkspaceSnapshotId(
          `snapshot-${input.workspaceId}-${input.period}`,
        ),
        createdAt: new Date(0),
        ...input,
      }) as WorkspaceSnapshotRecord,
    ...overrides,
  };
}

/** Adapter fake mendukung skenario deterministik ala `fakeOutstandAdapter`. */
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
      impressions: 1000,
      reach: 700,
      likes: 50,
      comments: 10,
      shares: 5,
      clicks: null,
      engagementRate: 0.0929,
    }),
    fetchWorkspaceMetrics: async () => ({
      totalPosts: 5,
      totalReach: 2000,
      totalEngagements: 200,
      avgEngagementRate: 0.1,
    }),
    fetchComments: async () => ({ comments: [], nextCursor: null }),
    replyToComment: async () => ({ outstandReplyId: "fake-reply" }),
    importPosts: async () => ({ importJobId: "fake-import-job" }),
    fetchImportJobStatus: async () => ({
      status: "completed" as const,
      posts: [],
      error: null,
    }),
    fetchAllPostIdMappings: noopFetchAllPostIdMappings,
    ...overrides,
  };
}

/**
 * Fake `TerminalPostsCountPort` (T-130/KI-093) — default mengembalikan 0
 * supaya test `syncPostMetrics` (tidak memakai port ini sama sekali) tidak
 * perlu peduli nilainya. Test `syncWorkspaceSnapshot` meng-override
 * `countTerminalPosts` untuk membuktikan `totalPosts` snapshot sekarang
 * datang dari sini, bukan dari `fetchWorkspaceMetrics` Outstand.
 */
function createFakeTerminalPostsPort(
  overrides: Partial<TerminalPostsCountPort> = {},
): TerminalPostsCountPort {
  return {
    countTerminalPosts: async () => 0,
    ...overrides,
  };
}

describe("AnalyticsIngestionUseCase.syncPostMetrics", () => {
  it("fetches metrics from the adapter per target and upserts them via the repository", async () => {
    const upsertCalls: UpsertPostMetricInput[] = [];
    const repository = createFakeRepository({
      upsertPostMetrics: async (input) => {
        upsertCalls.push(input);
        return {
          id: asPostMetricsId("metric-1"),
          ...input,
        };
      },
    });
    const adapter = createFakeOutstandAdapter();
    const useCase = new AnalyticsIngestionUseCase(
      repository,
      adapter,
      createFakeTerminalPostsPort(),
    );

    const results = await useCase.syncPostMetrics(
      [
        {
          postId: POST_ID,
          connectedAccountId: CONNECTED_ACCOUNT_1,
          platform: SocialPlatform.Instagram,
          outstandPostId: "outstand-post-1",
        },
      ],
      ACTING_USER_ID,
    );

    expect(results).toHaveLength(1);
    expect(upsertCalls).toEqual([
      expect.objectContaining({
        postId: POST_ID,
        connectedAccountId: CONNECTED_ACCOUNT_1,
        platform: SocialPlatform.Instagram,
        impressions: 1000,
        reach: 700,
        likes: 50,
        comments: 10,
        shares: 5,
        clicks: null,
        engagementRate: 0.0929,
      }),
    ]);
  });

  it("is idempotent: calling twice for the same target upserts the same values instead of accumulating (T-041.5)", async () => {
    // Simulasi tabel sungguhan: upsert MENIMPA baris yang sama (dikunci per
    // postId+connectedAccountId), bukan menambah baris baru.
    const store = new Map<string, PostMetricsRecord>();
    const repository = createFakeRepository({
      upsertPostMetrics: async (input) => {
        const key = `${input.postId}:${input.connectedAccountId}`;
        const record: PostMetricsRecord = {
          id: asPostMetricsId(`metric-${key}`),
          ...input,
        };
        store.set(key, record);
        return record;
      },
      findMetricsByPosts: async (postIds) =>
        Array.from(store.values()).filter((row) =>
          postIds.includes(row.postId),
        ),
    });
    // Adapter deterministik (mengikuti pola fakeOutstandAdapter) — nilai
    // yang sama untuk outstandPostId yang sama di kedua panggilan.
    const adapter = createFakeOutstandAdapter();
    const useCase = new AnalyticsIngestionUseCase(
      repository,
      adapter,
      createFakeTerminalPostsPort(),
    );

    const target = {
      postId: POST_ID,
      connectedAccountId: CONNECTED_ACCOUNT_1,
      platform: SocialPlatform.Instagram,
      outstandPostId: "outstand-post-1",
    };

    await useCase.syncPostMetrics([target], ACTING_USER_ID);
    await useCase.syncPostMetrics([target], ACTING_USER_ID);

    const rows = await repository.findMetricsByPosts([POST_ID]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        impressions: 1000,
        reach: 700,
        likes: 50,
        comments: 10,
        shares: 5,
        engagementRate: 0.0929,
      }),
    );
  });

  it("fetches distinct posts concurrently so a long account stays inside the job timeout", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const adapter = createFakeOutstandAdapter({
      fetchPostMetrics: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 15));
        inFlight -= 1;
        return {
          impressions: 1,
          reach: 1,
          likes: 1,
          comments: 1,
          shares: 1,
          clicks: null,
          engagementRate: 0,
        };
      },
    });
    const useCase = new AnalyticsIngestionUseCase(
      createFakeRepository(),
      adapter,
      createFakeTerminalPostsPort(),
    );
    const targets = Array.from({ length: 10 }, (_, index) => ({
      postId: asPostId(`post-${index}`),
      connectedAccountId: CONNECTED_ACCOUNT_1,
      platform: SocialPlatform.Instagram,
      outstandPostId: `outstand-post-${index}`,
    }));

    await useCase.syncPostMetrics(targets, ACTING_USER_ID);

    expect(maxInFlight).toBeGreaterThan(1);
  });
});

describe("AnalyticsIngestionUseCase.syncWorkspaceSnapshot", () => {
  it(
    "totalReach/totalEngagements tetap dijumlahkan dari fetchWorkspaceMetrics Outstand " +
      "(avgEngagementRate dari total gabungan), totalPosts TIDAK LAGI dari situ (T-130/KI-093)",
    async () => {
      const adapter = createFakeOutstandAdapter({
        fetchWorkspaceMetrics: async (outstandAccountId) => {
          if (outstandAccountId === "outstand-acc-1") {
            return {
              // Sengaja beda jauh dari count port di bawah (7) — kalau
              // implementasi regresi balik menjumlahkan field ini,
              // assertion totalPosts akan gagal.
              totalPosts: 3,
              totalReach: 1000,
              totalEngagements: 100,
              avgEngagementRate: 0.1,
            };
          }
          return {
            totalPosts: 2,
            totalReach: 3000,
            totalEngagements: 600,
            avgEngagementRate: 0.2,
          };
        },
      });
      let capturedInput: UpsertWorkspaceSnapshotInput | null = null;
      const repository = createFakeRepository({
        upsertWorkspaceSnapshot: async (input) => {
          capturedInput = input;
          return {
            id: asWorkspaceSnapshotId("snapshot-1"),
            createdAt: new Date(0),
            ...input,
          };
        },
      });
      const periodStart = new Date("2026-08-01T00:00:00Z");
      const periodEnd = new Date("2026-08-07T00:00:00Z");
      let capturedCountInput: {
        workspaceId: WorkspaceId;
        since: Date;
        until: Date;
      } | null = null;
      let capturedCountUserId: UserId | null = null;
      const terminalPosts = createFakeTerminalPostsPort({
        countTerminalPosts: async (input, userId) => {
          capturedCountInput = input;
          capturedCountUserId = userId;
          return 7;
        },
      });
      const useCase = new AnalyticsIngestionUseCase(
        repository,
        adapter,
        terminalPosts,
      );

      await useCase.syncWorkspaceSnapshot(
        {
          workspaceId: WORKSPACE_ID,
          period: "weekly",
          periodStart,
          periodEnd,
          accounts: [
            {
              connectedAccountId: CONNECTED_ACCOUNT_1,
              outstandAccountId: "outstand-acc-1",
            },
            {
              connectedAccountId: CONNECTED_ACCOUNT_2,
              outstandAccountId: "outstand-acc-2",
            },
          ],
        },
        ACTING_USER_ID,
      );

      // `countTerminalPosts` menerima workspaceId + rentang periode yang
      // SAMA dengan yang dipakai menyimpan snapshot, dan acting user yang
      // sama (RLS).
      expect(capturedCountInput).toEqual({
        workspaceId: WORKSPACE_ID,
        since: periodStart,
        until: periodEnd,
      });
      expect(capturedCountUserId).toBe(ACTING_USER_ID);

      expect(capturedInput).toEqual(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          period: "weekly",
          // Dari port (7), BUKAN jumlah `metrics.totalPosts` Outstand (3 + 2 = 5).
          totalPosts: 7,
          totalReach: 4000,
          totalEngagements: 700,
          // 700 / 4000 = 0.175 — bukan rata-rata polos (0.1 + 0.2) / 2 = 0.15.
          avgEngagementRate: 0.175,
          topPostId: null,
        }),
      );
    },
  );

  it(
    "totalPosts tetap akurat walau akun punya posts_count null/0 dari Outstand " +
      "(mis. Facebook Page — KI-093), karena totalPosts tidak lagi bergantung Outstand sama sekali",
    async () => {
      // Simulasi akun Facebook Page: `posts_count` null → `toNumber(null)`
      // di adapter asli menjadi 0 (lihat real-outstand-adapter.ts:1255).
      // `totalReach`/`totalEngagements` di response yang SAMA tetap valid.
      const adapter = createFakeOutstandAdapter({
        fetchWorkspaceMetrics: async () => ({
          totalPosts: 0,
          totalReach: 4812,
          totalEngagements: 97,
          avgEngagementRate: 0.02,
        }),
      });
      let capturedInput: UpsertWorkspaceSnapshotInput | null = null;
      const repository = createFakeRepository({
        upsertWorkspaceSnapshot: async (input) => {
          capturedInput = input;
          return {
            id: asWorkspaceSnapshotId("snapshot-fb"),
            createdAt: new Date(0),
            ...input,
          };
        },
      });
      // Jumlah post internal sesungguhnya (status Published/Failed/Imported)
      // — 15 post, sama urutan besaran dengan kasus nyata KI-093 ("Cook It
      // Real Good").
      const terminalPosts = createFakeTerminalPostsPort({
        countTerminalPosts: async () => 15,
      });
      const useCase = new AnalyticsIngestionUseCase(
        repository,
        adapter,
        terminalPosts,
      );

      await useCase.syncWorkspaceSnapshot(
        {
          workspaceId: WORKSPACE_ID,
          period: "monthly",
          periodStart: new Date("2026-10-01T00:00:00Z"),
          periodEnd: new Date("2026-10-21T00:00:00Z"),
          accounts: [
            {
              connectedAccountId: CONNECTED_ACCOUNT_1,
              outstandAccountId: "outstand-fb-page",
            },
          ],
        },
        ACTING_USER_ID,
      );

      expect(capturedInput).toEqual(
        expect.objectContaining({
          totalPosts: 15,
          totalReach: 4812,
          totalEngagements: 97,
        }),
      );
    },
  );

  it("totalPosts = 0 kalau workspace belum punya post terminal sama sekali di periode ini", async () => {
    const adapter = createFakeOutstandAdapter({
      fetchWorkspaceMetrics: async () => ({
        totalPosts: 0,
        totalReach: 0,
        totalEngagements: 0,
        avgEngagementRate: 0,
      }),
    });
    let capturedInput: UpsertWorkspaceSnapshotInput | null = null;
    const repository = createFakeRepository({
      upsertWorkspaceSnapshot: async (input) => {
        capturedInput = input;
        return {
          id: asWorkspaceSnapshotId("snapshot-empty"),
          createdAt: new Date(0),
          ...input,
        };
      },
    });
    const terminalPosts = createFakeTerminalPostsPort({
      countTerminalPosts: async () => 0,
    });
    const useCase = new AnalyticsIngestionUseCase(
      repository,
      adapter,
      terminalPosts,
    );

    await useCase.syncWorkspaceSnapshot(
      {
        workspaceId: WORKSPACE_ID,
        period: "weekly",
        periodStart: new Date("2026-08-01T00:00:00Z"),
        periodEnd: new Date("2026-08-07T00:00:00Z"),
        accounts: [
          {
            connectedAccountId: CONNECTED_ACCOUNT_1,
            outstandAccountId: "outstand-acc-1",
          },
        ],
      },
      ACTING_USER_ID,
    );

    expect(capturedInput).toEqual(
      expect.objectContaining({
        totalPosts: 0,
        totalReach: 0,
        totalEngagements: 0,
        avgEngagementRate: 0,
      }),
    );
  });

  it("maps SnapshotPeriod 'monthly' to the Outstand ACL period 'last_30_days'", async () => {
    const receivedPeriods: string[] = [];
    const adapter = createFakeOutstandAdapter({
      fetchWorkspaceMetrics: async (_outstandAccountId, period) => {
        receivedPeriods.push(period);
        return {
          totalPosts: 1,
          totalReach: 100,
          totalEngagements: 10,
          avgEngagementRate: 0.1,
        };
      },
    });
    const repository = createFakeRepository();
    const useCase = new AnalyticsIngestionUseCase(
      repository,
      adapter,
      createFakeTerminalPostsPort(),
    );

    await useCase.syncWorkspaceSnapshot(
      {
        workspaceId: WORKSPACE_ID,
        period: "monthly",
        periodStart: new Date("2026-08-01T00:00:00Z"),
        periodEnd: new Date("2026-08-31T00:00:00Z"),
        accounts: [
          {
            connectedAccountId: CONNECTED_ACCOUNT_1,
            outstandAccountId: "outstand-acc-1",
          },
        ],
      },
      ACTING_USER_ID,
    );

    expect(receivedPeriods).toEqual(["last_30_days"]);
  });

  it("is idempotent: calling twice for the same period upserts the same snapshot instead of accumulating (T-041.5)", async () => {
    const store = new Map<string, WorkspaceSnapshotRecord>();
    const repository = createFakeRepository({
      upsertWorkspaceSnapshot: async (input) => {
        const key = `${input.workspaceId}:${input.period}:${input.periodStart.toISOString()}`;
        const record: WorkspaceSnapshotRecord = {
          id: asWorkspaceSnapshotId(`snapshot-${key}`),
          createdAt: new Date(0),
          ...input,
        };
        store.set(key, record);
        return record;
      },
      findLatestWorkspaceSnapshot: async (workspaceId, period) =>
        Array.from(store.values()).find(
          (row) => row.workspaceId === workspaceId && row.period === period,
        ) ?? null,
    });
    const adapter = createFakeOutstandAdapter();
    const useCase = new AnalyticsIngestionUseCase(
      repository,
      adapter,
      createFakeTerminalPostsPort({ countTerminalPosts: async () => 5 }),
    );

    const input = {
      workspaceId: WORKSPACE_ID,
      period: "weekly" as const,
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-08-07T00:00:00Z"),
      accounts: [
        {
          connectedAccountId: CONNECTED_ACCOUNT_1,
          outstandAccountId: "outstand-acc-1",
        },
      ],
    };

    await useCase.syncWorkspaceSnapshot(input, ACTING_USER_ID);
    await useCase.syncWorkspaceSnapshot(input, ACTING_USER_ID);

    const snapshots = Array.from(store.values());
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual(
      expect.objectContaining({ totalPosts: 5, totalReach: 2000 }),
    );
  });
});
