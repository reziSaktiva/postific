import { describe, expect, it, vi } from "vitest";
import { ANALYTICS_SYNC_JOB_TYPE } from "./analytics-sync-job-handler";
import { EnqueueAnalyticsSyncUseCase } from "./enqueue-analytics-sync";

const NOW = new Date("2026-10-12T00:00:00.000Z");

const ACCOUNTS = [
  {
    workspaceId: "workspace-1",
    connectedAccountId: "account-1",
    outstandAccountId: "outstand-1",
  },
  {
    workspaceId: "workspace-1",
    connectedAccountId: "account-2",
    outstandAccountId: "outstand-2",
  },
];

describe("EnqueueAnalyticsSyncUseCase", () => {
  it("enqueues one analytics.sync job per active account that does not already have one", async () => {
    const scheduleJob = vi.fn(async () => undefined);
    const hasActiveJob = vi.fn(async (connectedAccountId: string) => {
      return connectedAccountId === "account-2";
    });
    const useCase = new EnqueueAnalyticsSyncUseCase(
      { listActiveConnectedAccountsForSync: async () => ACCOUNTS },
      { hasActiveJob, scheduleJob },
      () => NOW,
    );

    const result = await useCase.execute();

    expect(result).toEqual({ enqueued: 1 });
    expect(scheduleJob).toHaveBeenCalledTimes(1);
    expect(scheduleJob).toHaveBeenCalledWith({
      type: ANALYTICS_SYNC_JOB_TYPE,
      payload: {
        workspaceId: "workspace-1",
        connectedAccountId: "account-1",
        outstandAccountId: "outstand-1",
      },
      scheduledAt: NOW,
    });
  });

  it("enqueueForAccounts can seed a single newly connected account", async () => {
    const scheduleJob = vi.fn(async () => undefined);
    const useCase = new EnqueueAnalyticsSyncUseCase(
      { listActiveConnectedAccountsForSync: async () => [] },
      { hasActiveJob: async () => false, scheduleJob },
      () => NOW,
    );

    const enqueued = await useCase.enqueueForAccounts([ACCOUNTS[0]!]);

    expect(enqueued).toBe(1);
    expect(scheduleJob).toHaveBeenCalledTimes(1);
  });
});
