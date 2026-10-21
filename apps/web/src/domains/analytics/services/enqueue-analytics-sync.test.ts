import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_SYNC_JOB_TYPE,
  analyticsWorkspaceSnapshotPayload,
} from "./analytics-sync-job-handler";
import {
  EnqueueAnalyticsSyncUseCase,
  type EnqueueAnalyticsSyncJobsPort,
} from "./enqueue-analytics-sync";

const NOW = new Date("2026-10-12T00:00:00.000Z");
const AFTERNOON = new Date("2026-10-12T15:30:00.000Z");

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

function createJobs(
  overrides: {
    hasAccountJob?: EnqueueAnalyticsSyncJobsPort["hasAccountJob"];
    hasWorkspaceSnapshot?: EnqueueAnalyticsSyncJobsPort["hasWorkspaceSnapshot"];
  } = {},
): EnqueueAnalyticsSyncJobsPort & {
  scheduleJob: ReturnType<
    typeof vi.fn<EnqueueAnalyticsSyncJobsPort["scheduleJob"]>
  >;
  hasAccountJob: ReturnType<
    typeof vi.fn<EnqueueAnalyticsSyncJobsPort["hasAccountJob"]>
  >;
  hasWorkspaceSnapshot: ReturnType<
    typeof vi.fn<EnqueueAnalyticsSyncJobsPort["hasWorkspaceSnapshot"]>
  >;
} {
  const scheduleJob = vi.fn<EnqueueAnalyticsSyncJobsPort["scheduleJob"]>(
    async () => undefined,
  );
  const hasAccountJob = vi.fn<EnqueueAnalyticsSyncJobsPort["hasAccountJob"]>(
    overrides.hasAccountJob ?? (async () => false),
  );
  const hasWorkspaceSnapshot = vi.fn<
    EnqueueAnalyticsSyncJobsPort["hasWorkspaceSnapshot"]
  >(overrides.hasWorkspaceSnapshot ?? (async () => false));
  return { scheduleJob, hasAccountJob, hasWorkspaceSnapshot };
}

describe("EnqueueAnalyticsSyncUseCase", () => {
  it("enqueues one post job per idle account and one snapshot job per workspace", async () => {
    const jobs = createJobs({
      hasAccountJob: async (connectedAccountId) =>
        connectedAccountId === "account-2",
    });
    const useCase = new EnqueueAnalyticsSyncUseCase(
      { listActiveConnectedAccountsForSync: async () => ACCOUNTS },
      jobs,
      () => NOW,
    );

    const result = await useCase.execute();

    expect(result).toEqual({ enqueued: 2 });
    expect(jobs.scheduleJob).toHaveBeenCalledTimes(2);
    expect(jobs.scheduleJob).toHaveBeenNthCalledWith(1, {
      type: ANALYTICS_SYNC_JOB_TYPE,
      payload: {
        workspaceId: "workspace-1",
        connectedAccountId: "account-1",
        outstandAccountId: "outstand-1",
      },
      scheduledAt: NOW,
    });
    expect(jobs.scheduleJob).toHaveBeenNthCalledWith(2, {
      type: ANALYTICS_SYNC_JOB_TYPE,
      payload: analyticsWorkspaceSnapshotPayload("workspace-1"),
      scheduledAt: NOW,
    });
  });

  it("enqueueForAccounts seeds the new account and its workspace snapshot", async () => {
    const jobs = createJobs();
    const useCase = new EnqueueAnalyticsSyncUseCase(
      { listActiveConnectedAccountsForSync: async () => [] },
      jobs,
      () => NOW,
    );

    const enqueued = await useCase.enqueueForAccounts([ACCOUNTS[0]!]);

    expect(enqueued).toBe(2);
    expect(jobs.scheduleJob).toHaveBeenCalledTimes(2);
    expect(jobs.hasAccountJob).toHaveBeenCalledWith("account-1", undefined);
  });

  it("executeIfDue skips accounts and workspaces that already have a job today", async () => {
    const jobs = createJobs({
      hasAccountJob: async () => true,
      hasWorkspaceSnapshot: async () => true,
    });
    const useCase = new EnqueueAnalyticsSyncUseCase(
      { listActiveConnectedAccountsForSync: async () => ACCOUNTS },
      jobs,
      () => AFTERNOON,
    );

    const result = await useCase.executeIfDue();

    expect(result).toEqual({ enqueued: 0, skipped: true });
    expect(jobs.scheduleJob).not.toHaveBeenCalled();
    expect(jobs.hasAccountJob).toHaveBeenCalledWith(
      "account-1",
      new Date("2026-10-12T00:00:00.000Z"),
    );
    expect(jobs.hasWorkspaceSnapshot).toHaveBeenCalledWith(
      "workspace-1",
      new Date("2026-10-12T00:00:00.000Z"),
    );
  });

  it("executeIfDue still enqueues an account that has no job yet today", async () => {
    const jobs = createJobs({
      hasAccountJob: async (connectedAccountId) =>
        connectedAccountId === "account-2",
      hasWorkspaceSnapshot: async () => true,
    });
    const useCase = new EnqueueAnalyticsSyncUseCase(
      { listActiveConnectedAccountsForSync: async () => ACCOUNTS },
      jobs,
      () => AFTERNOON,
    );

    const result = await useCase.executeIfDue();

    expect(result).toEqual({ enqueued: 1, skipped: false });
    expect(jobs.scheduleJob).toHaveBeenCalledTimes(1);
    expect(jobs.scheduleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ connectedAccountId: "account-1" }),
      }),
    );
  });

  describe("enqueueWorkspaceSnapshot (T-134, KI-094)", () => {
    it("enqueues a workspace snapshot job for disconnect-triggered recompute", async () => {
      const jobs = createJobs();
      const useCase = new EnqueueAnalyticsSyncUseCase(
        { listActiveConnectedAccountsForSync: async () => [] },
        jobs,
        () => NOW,
      );

      const enqueued = await useCase.enqueueWorkspaceSnapshot("workspace-1");

      expect(enqueued).toBe(1);
      expect(jobs.scheduleJob).toHaveBeenCalledTimes(1);
      expect(jobs.scheduleJob).toHaveBeenCalledWith({
        type: ANALYTICS_SYNC_JOB_TYPE,
        payload: analyticsWorkspaceSnapshotPayload("workspace-1"),
        scheduledAt: NOW,
      });
      expect(jobs.hasWorkspaceSnapshot).toHaveBeenCalledWith(
        "workspace-1",
        undefined,
      );
    });

    it("skips scheduling when a pending/running snapshot job already exists", async () => {
      const jobs = createJobs({ hasWorkspaceSnapshot: async () => true });
      const useCase = new EnqueueAnalyticsSyncUseCase(
        { listActiveConnectedAccountsForSync: async () => [] },
        jobs,
        () => NOW,
      );

      const enqueued = await useCase.enqueueWorkspaceSnapshot("workspace-1");

      expect(enqueued).toBe(0);
      expect(jobs.scheduleJob).not.toHaveBeenCalled();
    });
  });
});
