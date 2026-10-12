import {
  asConnectedAccountId,
  asPostId,
  asPostMetricsId,
  asWorkspaceId,
  asWorkspaceSnapshotId,
  type IOutstandAdapter,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type {
  IAnalyticsRepository,
  PostMetricsRecord,
  UpsertPostMetricInput,
  UpsertWorkspaceSnapshotInput,
  WorkspaceSnapshotRecord,
} from "../repositories/analytics.repository";
import { AnalyticsIngestionUseCase } from "./analytics-ingestion.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const POST_ID = asPostId("post-1");
const CONNECTED_ACCOUNT_1 = asConnectedAccountId("conn-1");
const CONNECTED_ACCOUNT_2 = asConnectedAccountId("conn-2");

function createFakeRepository(
  overrides: Partial<IAnalyticsRepository> = {},
): IAnalyticsRepository {
  return {
    findMetricsByPost: async () => [],
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
    const useCase = new AnalyticsIngestionUseCase(repository, adapter);

    const results = await useCase.syncPostMetrics([
      {
        postId: POST_ID,
        connectedAccountId: CONNECTED_ACCOUNT_1,
        platform: SocialPlatform.Instagram,
        outstandPostId: "outstand-post-1",
      },
    ]);

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
      findMetricsByPost: async (postId) =>
        Array.from(store.values()).filter((row) => row.postId === postId),
    });
    // Adapter deterministik (mengikuti pola fakeOutstandAdapter) — nilai
    // yang sama untuk outstandPostId yang sama di kedua panggilan.
    const adapter = createFakeOutstandAdapter();
    const useCase = new AnalyticsIngestionUseCase(repository, adapter);

    const target = {
      postId: POST_ID,
      connectedAccountId: CONNECTED_ACCOUNT_1,
      platform: SocialPlatform.Instagram,
      outstandPostId: "outstand-post-1",
    };

    await useCase.syncPostMetrics([target]);
    await useCase.syncPostMetrics([target]);

    const rows = await repository.findMetricsByPost(POST_ID);
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
});

describe("AnalyticsIngestionUseCase.syncWorkspaceSnapshot", () => {
  it("aggregates fetchWorkspaceMetrics across all accounts and recomputes avgEngagementRate from combined totals", async () => {
    const adapter = createFakeOutstandAdapter({
      fetchWorkspaceMetrics: async (outstandAccountId) => {
        if (outstandAccountId === "outstand-acc-1") {
          return {
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
    const useCase = new AnalyticsIngestionUseCase(repository, adapter);

    await useCase.syncWorkspaceSnapshot({
      workspaceId: WORKSPACE_ID,
      period: "weekly",
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-08-07T00:00:00Z"),
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
    });

    expect(capturedInput).toEqual(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        period: "weekly",
        totalPosts: 5,
        totalReach: 4000,
        totalEngagements: 700,
        // 700 / 4000 = 0.175 — bukan rata-rata polos (0.1 + 0.2) / 2 = 0.15.
        avgEngagementRate: 0.175,
        topPostId: null,
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
    const useCase = new AnalyticsIngestionUseCase(repository, adapter);

    await useCase.syncWorkspaceSnapshot({
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
    });

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
    const useCase = new AnalyticsIngestionUseCase(repository, adapter);

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

    await useCase.syncWorkspaceSnapshot(input);
    await useCase.syncWorkspaceSnapshot(input);

    const snapshots = Array.from(store.values());
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual(
      expect.objectContaining({ totalPosts: 5, totalReach: 2000 }),
    );
  });
});
