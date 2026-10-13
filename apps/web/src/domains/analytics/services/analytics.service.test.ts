import {
  asConnectedAccountId,
  asPostId,
  asPostMetricsId,
  asUserId,
  asWorkspaceId,
  asWorkspaceSnapshotId,
  type PostId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type {
  IAnalyticsRepository,
  PostMetricsRecord,
  WorkspaceSnapshotRecord,
} from "../repositories/analytics.repository";
import { AnalyticsService } from "./analytics.service";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const POST_ID = asPostId("post-1");
const USER_ID = asUserId("user-1");

function createFakeRepository(
  overrides: Partial<IAnalyticsRepository> = {},
): IAnalyticsRepository {
  return {
    findMetricsByPost: async () => [],
    findMetricsByPosts: async () => [],
    findLatestWorkspaceSnapshot: async () => null,
    upsertPostMetrics: async (input) => ({
      id: asPostMetricsId("metric-stub"),
      ...input,
    }),
    upsertWorkspaceSnapshot: async (input) => ({
      id: asWorkspaceSnapshotId("snapshot-stub"),
      createdAt: new Date(0),
      ...input,
    }),
    ...overrides,
  };
}

describe("AnalyticsService.getPostMetrics", () => {
  it("delegates to the repository", async () => {
    const metrics: PostMetricsRecord[] = [
      {
        id: asPostMetricsId("metric-1"),
        postId: POST_ID,
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
      },
    ];
    let received: PostId | null = null;
    const service = new AnalyticsService(
      createFakeRepository({
        findMetricsByPost: async (postId) => {
          received = postId;
          return metrics;
        },
      }),
    );

    await expect(service.getPostMetrics(POST_ID)).resolves.toBe(metrics);
    expect(received).toBe(POST_ID);
  });

  it("returns an empty array when the repository has no metrics for the post", async () => {
    const service = new AnalyticsService(createFakeRepository());

    await expect(service.getPostMetrics(POST_ID)).resolves.toEqual([]);
  });
});

describe("AnalyticsService.getPostMetricsByPosts", () => {
  it("returns an empty Map without calling the repository when input is empty", async () => {
    let calls = 0;
    const service = new AnalyticsService(
      createFakeRepository({
        findMetricsByPosts: async () => {
          calls += 1;
          return [];
        },
      }),
    );

    const result = await service.getPostMetricsByPosts([]);

    expect(result).toEqual(new Map());
    expect(calls).toBe(0);
  });

  it("groups metrics rows by postId", async () => {
    const postA = asPostId("post-a");
    const postB = asPostId("post-b");
    const metricA1: PostMetricsRecord = {
      id: asPostMetricsId("metric-a1"),
      postId: postA,
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
    const metricA2: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-a2"),
      connectedAccountId: asConnectedAccountId("conn-2"),
    };
    const metricB1: PostMetricsRecord = {
      ...metricA1,
      id: asPostMetricsId("metric-b1"),
      postId: postB,
    };
    let received: PostId[] | null = null;
    const service = new AnalyticsService(
      createFakeRepository({
        findMetricsByPosts: async (postIds) => {
          received = postIds;
          return [metricA1, metricA2, metricB1];
        },
      }),
    );

    const result = await service.getPostMetricsByPosts([postA, postB]);

    expect(result).toEqual(
      new Map([
        [postA, [metricA1, metricA2]],
        [postB, [metricB1]],
      ]),
    );
    expect(received).toEqual([postA, postB]);
  });
});

describe("AnalyticsService.getWorkspaceSnapshot", () => {
  it("returns null when no snapshot exists yet (empty state, T-042.4)", async () => {
    const service = new AnalyticsService(createFakeRepository());

    await expect(
      service.getWorkspaceSnapshot(WORKSPACE_ID, "weekly"),
    ).resolves.toBeNull();
  });

  it("delegates workspaceId and period to the repository", async () => {
    const snapshot: WorkspaceSnapshotRecord = {
      id: asWorkspaceSnapshotId("snapshot-1"),
      workspaceId: WORKSPACE_ID,
      period: "monthly",
      periodStart: new Date(0),
      periodEnd: new Date(1),
      totalPosts: 5,
      totalReach: 1000,
      totalEngagements: 120,
      avgEngagementRate: 0.12,
      topPostId: POST_ID,
      createdAt: new Date(0),
    };
    let received: { workspaceId: typeof WORKSPACE_ID; period: string } | null =
      null;
    const service = new AnalyticsService(
      createFakeRepository({
        findLatestWorkspaceSnapshot: async (workspaceId, period) => {
          received = { workspaceId, period };
          return snapshot;
        },
      }),
    );

    await expect(
      service.getWorkspaceSnapshot(WORKSPACE_ID, "monthly"),
    ).resolves.toBe(snapshot);
    expect(received).toEqual({ workspaceId: WORKSPACE_ID, period: "monthly" });
  });
});

describe("AnalyticsService.getDashboardSummary", () => {
  const snapshot: WorkspaceSnapshotRecord = {
    id: asWorkspaceSnapshotId("snapshot-1"),
    workspaceId: WORKSPACE_ID,
    period: "weekly",
    periodStart: new Date(0),
    periodEnd: new Date(1),
    totalPosts: 5,
    totalReach: 1000,
    totalEngagements: 120,
    avgEngagementRate: 0.12,
    topPostId: POST_ID,
    createdAt: new Date(0),
  };

  it("returns null when no snapshot exists yet (empty state, T-042.4) without calling the active accounts port", async () => {
    let called = false;
    const service = new AnalyticsService(createFakeRepository(), {
      countActiveConnectedAccounts: async () => {
        called = true;
        return 3;
      },
    });

    await expect(
      service.getDashboardSummary(WORKSPACE_ID, "weekly", USER_ID),
    ).resolves.toBeNull();
    expect(called).toBe(false);
  });

  it("combines snapshot totals with activeAccounts from the port", async () => {
    const service = new AnalyticsService(
      createFakeRepository({
        findLatestWorkspaceSnapshot: async () => snapshot,
      }),
      { countActiveConnectedAccounts: async () => 4 },
    );

    await expect(
      service.getDashboardSummary(WORKSPACE_ID, "weekly", USER_ID),
    ).resolves.toEqual({
      totalPosts: 5,
      totalEngagements: 120,
      avgEngagementRate: 0.12,
      activeAccounts: 4,
    });
  });

  it("throws when no ActiveAccountsPort is supplied, instead of silently reporting 0", async () => {
    const service = new AnalyticsService(
      createFakeRepository({
        findLatestWorkspaceSnapshot: async () => snapshot,
      }),
    );

    await expect(
      service.getDashboardSummary(WORKSPACE_ID, "weekly", USER_ID),
    ).rejects.toThrow(/ActiveAccountsPort/);
  });
});
