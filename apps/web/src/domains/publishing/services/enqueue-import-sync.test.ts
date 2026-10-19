import { SocialPlatform } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/utils/errors";
import { IMPORT_SYNC_JOB_TYPE } from "./import-sync-job-handler";
import {
  EnqueueImportSyncUseCase,
  type EnqueueImportSyncJobsPort,
} from "./enqueue-import-sync";

const NOW = new Date("2026-10-16T00:00:00.000Z");
const AFTERNOON = new Date("2026-10-16T15:30:00.000Z");

const ACCOUNTS = [
  {
    workspaceId: "workspace-1",
    connectedAccountId: "account-1",
    outstandAccountId: "outstand-1",
    platform: SocialPlatform.Instagram,
  },
  {
    workspaceId: "workspace-1",
    connectedAccountId: "account-2",
    outstandAccountId: "outstand-2",
    platform: SocialPlatform.Facebook,
  },
];

function createJobs(
  overrides: {
    hasAccountJob?: EnqueueImportSyncJobsPort["hasAccountJob"];
    scheduleJob?: EnqueueImportSyncJobsPort["scheduleJob"];
  } = {},
): EnqueueImportSyncJobsPort & {
  scheduleJob: ReturnType<
    typeof vi.fn<EnqueueImportSyncJobsPort["scheduleJob"]>
  >;
  hasAccountJob: ReturnType<
    typeof vi.fn<EnqueueImportSyncJobsPort["hasAccountJob"]>
  >;
} {
  const scheduleJob = vi.fn<EnqueueImportSyncJobsPort["scheduleJob"]>(
    overrides.scheduleJob ?? (async () => undefined),
  );
  const hasAccountJob = vi.fn<EnqueueImportSyncJobsPort["hasAccountJob"]>(
    overrides.hasAccountJob ?? (async () => false),
  );
  return { scheduleJob, hasAccountJob };
}

describe("EnqueueImportSyncUseCase", () => {
  it("execute schedules queued periodic jobs only for accounts that are not already active", async () => {
    const jobs = createJobs({
      hasAccountJob: async (connectedAccountId) =>
        connectedAccountId === "account-2",
    });
    const useCase = new EnqueueImportSyncUseCase(
      { listAccountsForPeriodicImportSync: async () => ACCOUNTS },
      jobs,
      () => NOW,
    );

    const result = await useCase.execute();

    expect(result).toEqual({ enqueued: 1 });
    expect(jobs.hasAccountJob).toHaveBeenCalledWith("account-1", undefined);
    expect(jobs.scheduleJob).toHaveBeenCalledTimes(1);
    expect(jobs.scheduleJob).toHaveBeenCalledWith({
      type: IMPORT_SYNC_JOB_TYPE,
      payload: {
        trigger: "periodic",
        queued: true,
        workspaceId: "workspace-1",
        connectedAccountId: "account-1",
        outstandAccountId: "outstand-1",
        platform: SocialPlatform.Instagram,
        since: "",
        until: "",
      },
      scheduledAt: NOW,
    });
  });

  it("executeIfDue skips accounts that already have an import.sync job today", async () => {
    const jobs = createJobs({
      hasAccountJob: async () => true,
    });
    const useCase = new EnqueueImportSyncUseCase(
      { listAccountsForPeriodicImportSync: async () => ACCOUNTS },
      jobs,
      () => AFTERNOON,
    );

    const result = await useCase.executeIfDue();

    expect(result).toEqual({ enqueued: 0, skipped: true });
    expect(jobs.scheduleJob).not.toHaveBeenCalled();
    expect(jobs.hasAccountJob).toHaveBeenCalledWith(
      "account-1",
      new Date("2026-10-16T00:00:00.000Z"),
    );
  });

  it("executeIfDue still enqueues an account with no job yet today", async () => {
    const jobs = createJobs({
      hasAccountJob: async (connectedAccountId) =>
        connectedAccountId === "account-2",
    });
    const useCase = new EnqueueImportSyncUseCase(
      { listAccountsForPeriodicImportSync: async () => ACCOUNTS },
      jobs,
      () => AFTERNOON,
    );

    const result = await useCase.executeIfDue();

    expect(result).toEqual({ enqueued: 1, skipped: false });
    expect(jobs.scheduleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          connectedAccountId: "account-1",
          trigger: "periodic",
          queued: true,
        }),
      }),
    );
  });

  it("treats a unique-index ConflictError as a skip and keeps enqueueing the other accounts", async () => {
    const jobs = createJobs({
      scheduleJob: async (input) => {
        if (input.payload.connectedAccountId === "account-1") {
          throw new ConflictError("sudah berjalan");
        }
      },
    });
    const useCase = new EnqueueImportSyncUseCase(
      { listAccountsForPeriodicImportSync: async () => ACCOUNTS },
      jobs,
      () => NOW,
    );

    const result = await useCase.execute();

    expect(result).toEqual({ enqueued: 1 });
    expect(jobs.scheduleJob).toHaveBeenCalledTimes(2);
  });

  it("does not swallow errors that are not a concurrent-import conflict", async () => {
    const jobs = createJobs({
      scheduleJob: async () => {
        throw new Error("db down");
      },
    });
    const useCase = new EnqueueImportSyncUseCase(
      { listAccountsForPeriodicImportSync: async () => ACCOUNTS },
      jobs,
      () => NOW,
    );

    await expect(useCase.execute()).rejects.toThrow(/db down/);
  });
});
