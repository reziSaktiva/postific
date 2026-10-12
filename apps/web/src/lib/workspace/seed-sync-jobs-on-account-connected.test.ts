import { describe, expect, it, vi } from "vitest";
import { seedSyncJobsOnAccountConnected } from "./seed-sync-jobs-on-account-connected";

const ACCOUNT = {
  workspaceId: "workspace-1",
  connectedAccountId: "account-1",
  outstandAccountId: "outstand-1",
};

describe("seedSyncJobsOnAccountConnected", () => {
  it("still enqueues analytics when an engagement job is already active", async () => {
    const scheduleEngagementJob = vi.fn(async () => undefined);
    const enqueueAnalytics = vi.fn(async () => 1);

    await seedSyncJobsOnAccountConnected(ACCOUNT, {
      hasActiveEngagementJob: async () => true,
      scheduleEngagementJob,
      enqueueAnalytics,
    });

    expect(scheduleEngagementJob).not.toHaveBeenCalled();
    expect(enqueueAnalytics).toHaveBeenCalledWith([ACCOUNT]);
  });

  it("seeds engagement and analytics together on a fresh connect", async () => {
    const scheduleEngagementJob = vi.fn(async () => undefined);
    const enqueueAnalytics = vi.fn(async () => 2);

    await seedSyncJobsOnAccountConnected(ACCOUNT, {
      hasActiveEngagementJob: async () => false,
      scheduleEngagementJob,
      enqueueAnalytics,
    });

    expect(scheduleEngagementJob).toHaveBeenCalledWith(ACCOUNT);
    expect(enqueueAnalytics).toHaveBeenCalledWith([ACCOUNT]);
  });
});
