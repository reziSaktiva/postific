import { asPostId, asUserId, SocialPlatform } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_SYNC_JOB_TYPE,
  ANALYTICS_SYNC_SCOPE_WORKSPACE,
  AnalyticsSyncJobHandler,
  resolveAnalyticsSnapshotWindow,
  type AnalyticsSyncAccountsPort,
  type AnalyticsSyncOwnerLookupPort,
  type AnalyticsSyncPostsPort,
} from "./analytics-sync-job-handler";
import type { AnalyticsIngestionUseCase } from "./analytics-ingestion.use-case";

const PAYLOAD = {
  workspaceId: "workspace-1",
  connectedAccountId: "account-1",
  outstandAccountId: "outstand-account-1",
};

const NOW = new Date("2026-10-12T15:30:00.000Z");

function createOwnerLookup(
  overrides: Partial<AnalyticsSyncOwnerLookupPort> = {},
): AnalyticsSyncOwnerLookupPort {
  return {
    findAccountOwnerByOutstandAccountId: async () => ({
      workspaceId: PAYLOAD.workspaceId,
      connectedAccountId: PAYLOAD.connectedAccountId,
      ownerUserId: asUserId("owner-1"),
    }),
    ...overrides,
  };
}

function createPosts(
  overrides: Partial<AnalyticsSyncPostsPort> = {},
): AnalyticsSyncPostsPort {
  return {
    listSyncablePostsByConnectedAccount: async () => [
      {
        postId: asPostId("post-1"),
        outstandPostId: "outstand-post-1",
        platform: SocialPlatform.Instagram,
      },
    ],
    ...overrides,
  };
}

function createAccounts(
  overrides: Partial<AnalyticsSyncAccountsPort> = {},
): AnalyticsSyncAccountsPort {
  return {
    listActiveConnectedAccountsForSync: async () => [
      {
        workspaceId: PAYLOAD.workspaceId,
        connectedAccountId: PAYLOAD.connectedAccountId,
        outstandAccountId: PAYLOAD.outstandAccountId,
      },
      {
        workspaceId: PAYLOAD.workspaceId,
        connectedAccountId: "account-2",
        outstandAccountId: "outstand-account-2",
      },
      {
        workspaceId: "workspace-other",
        connectedAccountId: "account-other",
        outstandAccountId: "outstand-other",
      },
    ],
    ...overrides,
  };
}

describe("resolveAnalyticsSnapshotWindow", () => {
  it("buckets periodStart to UTC midnight so the same calendar day upserts one row", () => {
    const weekly = resolveAnalyticsSnapshotWindow("weekly", NOW);
    expect(weekly.periodEnd).toEqual(NOW);
    expect(weekly.periodStart.toISOString()).toBe("2026-10-05T00:00:00.000Z");

    const monthly = resolveAnalyticsSnapshotWindow("monthly", NOW);
    expect(monthly.periodStart.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });
});

describe("AnalyticsSyncJobHandler.handle", () => {
  it("rejects a payload that is missing required fields", async () => {
    const handler = new AnalyticsSyncJobHandler(
      {} as AnalyticsIngestionUseCase,
      createOwnerLookup(),
      createPosts(),
      createAccounts(),
    );

    await expect(handler.handle({ workspaceId: "only" })).rejects.toThrow(
      ANALYTICS_SYNC_JOB_TYPE,
    );
  });

  it("throws when the account is no longer active so the job runner can retry", async () => {
    const syncPostMetrics = vi.fn();
    const handler = new AnalyticsSyncJobHandler(
      { syncPostMetrics } as unknown as AnalyticsIngestionUseCase,
      createOwnerLookup({
        findAccountOwnerByOutstandAccountId: async () => null,
      }),
      createPosts(),
      createAccounts(),
    );

    await expect(handler.handle(PAYLOAD)).rejects.toThrow("tidak aktif");
    expect(syncPostMetrics).not.toHaveBeenCalled();
  });

  it("throws when the lookup owner does not match the payload", async () => {
    const syncPostMetrics = vi.fn();
    const handler = new AnalyticsSyncJobHandler(
      { syncPostMetrics } as unknown as AnalyticsIngestionUseCase,
      createOwnerLookup({
        findAccountOwnerByOutstandAccountId: async () => ({
          workspaceId: "other-workspace",
          connectedAccountId: "other-account",
          ownerUserId: asUserId("owner-1"),
        }),
      }),
      createPosts(),
      createAccounts(),
    );

    await expect(handler.handle(PAYLOAD)).rejects.toThrow("tidak cocok");
    expect(syncPostMetrics).not.toHaveBeenCalled();
  });

  it("syncs published posts for the account without writing the workspace snapshot", async () => {
    const syncPostMetrics = vi.fn<AnalyticsIngestionUseCase["syncPostMetrics"]>(
      async () => [],
    );
    const syncWorkspaceSnapshot = vi.fn();
    const listActiveConnectedAccountsForSync = vi.fn();
    const handler = new AnalyticsSyncJobHandler(
      {
        syncPostMetrics,
        syncWorkspaceSnapshot,
      } as unknown as AnalyticsIngestionUseCase,
      createOwnerLookup(),
      createPosts(),
      {
        listActiveConnectedAccountsForSync,
      },
      () => NOW,
    );

    await handler.handle(PAYLOAD);

    expect(syncPostMetrics).toHaveBeenCalledTimes(1);
    expect(syncPostMetrics).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          postId: "post-1",
          connectedAccountId: PAYLOAD.connectedAccountId,
          outstandPostId: "outstand-post-1",
          platform: SocialPlatform.Instagram,
        }),
      ],
      "owner-1",
    );
    expect(syncWorkspaceSnapshot).not.toHaveBeenCalled();
    expect(listActiveConnectedAccountsForSync).not.toHaveBeenCalled();
  });

  it("does nothing else when the account has no published posts", async () => {
    const syncPostMetrics = vi.fn();
    const syncWorkspaceSnapshot = vi.fn();
    const handler = new AnalyticsSyncJobHandler(
      {
        syncPostMetrics,
        syncWorkspaceSnapshot,
      } as unknown as AnalyticsIngestionUseCase,
      createOwnerLookup(),
      createPosts({
        listSyncablePostsByConnectedAccount: async () => [],
      }),
      createAccounts(),
      () => NOW,
    );

    await handler.handle(PAYLOAD);

    expect(syncPostMetrics).not.toHaveBeenCalled();
    expect(syncWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it("writes weekly and monthly snapshots once for every active account in the workspace", async () => {
    const syncPostMetrics = vi.fn();
    const syncWorkspaceSnapshot = vi.fn<
      AnalyticsIngestionUseCase["syncWorkspaceSnapshot"]
    >(async () => ({}) as never);
    const handler = new AnalyticsSyncJobHandler(
      {
        syncPostMetrics,
        syncWorkspaceSnapshot,
      } as unknown as AnalyticsIngestionUseCase,
      createOwnerLookup(),
      createPosts(),
      createAccounts(),
      () => NOW,
    );

    await handler.handle({
      scope: ANALYTICS_SYNC_SCOPE_WORKSPACE,
      workspaceId: PAYLOAD.workspaceId,
      workspaceSnapshotId: PAYLOAD.workspaceId,
    });

    expect(syncPostMetrics).not.toHaveBeenCalled();
    expect(syncWorkspaceSnapshot).toHaveBeenCalledTimes(2);
    const periods = syncWorkspaceSnapshot.mock.calls.map(
      (call) => call[0].period,
    );
    expect(periods).toEqual(["weekly", "monthly"]);
    for (const [input, actingUserId] of syncWorkspaceSnapshot.mock.calls) {
      expect(input.accounts).toEqual([
        {
          connectedAccountId: PAYLOAD.connectedAccountId,
          outstandAccountId: PAYLOAD.outstandAccountId,
        },
        {
          connectedAccountId: "account-2",
          outstandAccountId: "outstand-account-2",
        },
      ]);
      expect(actingUserId).toBe("owner-1");
    }
  });
});
