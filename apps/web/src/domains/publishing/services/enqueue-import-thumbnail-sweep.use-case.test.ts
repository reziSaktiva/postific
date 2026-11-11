import { describe, expect, it, vi } from "vitest";
import {
  EnqueueImportThumbnailSweepUseCase,
  type EnqueueImportThumbnailSweepJobsPort,
} from "./enqueue-import-thumbnail-sweep.use-case";
import { IMPORT_THUMBNAIL_SWEEP_JOB_TYPE } from "./import-thumbnail-sweep-job-handler";

const NOW = new Date("2026-11-11T15:30:00.000Z");
const START_OF_DAY = new Date("2026-11-11T00:00:00.000Z");

function createJobs(hasJob: boolean) {
  return {
    hasJob: vi.fn<EnqueueImportThumbnailSweepJobsPort["hasJob"]>(
      async () => hasJob,
    ),
    scheduleJob: vi.fn<EnqueueImportThumbnailSweepJobsPort["scheduleJob"]>(
      async () => undefined,
    ),
  };
}

describe("EnqueueImportThumbnailSweepUseCase", () => {
  it("enqueues one empty-payload job when none exists since UTC midnight", async () => {
    const jobs = createJobs(false);
    const result = await new EnqueueImportThumbnailSweepUseCase(
      jobs,
      () => NOW,
    ).executeIfDue();

    expect(result).toEqual({ enqueued: 1, skipped: false });
    expect(jobs.hasJob).toHaveBeenCalledWith(START_OF_DAY);
    expect(jobs.scheduleJob).toHaveBeenCalledWith({
      type: IMPORT_THUMBNAIL_SWEEP_JOB_TYPE,
      payload: {},
      scheduledAt: NOW,
    });
  });

  it("skips when a job already exists today", async () => {
    const jobs = createJobs(true);
    const result = await new EnqueueImportThumbnailSweepUseCase(
      jobs,
      () => NOW,
    ).executeIfDue();

    expect(result).toEqual({ enqueued: 0, skipped: true });
    expect(jobs.scheduleJob).not.toHaveBeenCalled();
  });

  it("forced run only checks pending/running jobs", async () => {
    const jobs = createJobs(false);
    const result = await new EnqueueImportThumbnailSweepUseCase(
      jobs,
      () => NOW,
    ).execute();

    expect(result).toEqual({ enqueued: 1 });
    expect(jobs.hasJob).toHaveBeenCalledWith(undefined);
  });

  it("forced run does not duplicate a pending job", async () => {
    const jobs = createJobs(true);
    const result = await new EnqueueImportThumbnailSweepUseCase(
      jobs,
      () => NOW,
    ).execute();

    expect(result).toEqual({ enqueued: 0 });
    expect(jobs.scheduleJob).not.toHaveBeenCalled();
  });
});
