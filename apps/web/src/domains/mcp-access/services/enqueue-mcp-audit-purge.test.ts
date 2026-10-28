import { describe, expect, it, vi } from "vitest";
import {
  EnqueueMcpAuditPurgeUseCase,
  type EnqueueMcpAuditPurgeJobsPort,
} from "./enqueue-mcp-audit-purge";
import { MCP_AUDIT_PURGE_JOB_TYPE } from "./mcp-audit-purge-job-handler";

const NOW = new Date("2026-10-26T15:30:00.000Z");
const START_OF_DAY = new Date("2026-10-26T00:00:00.000Z");

function createJobs(hasJob: EnqueueMcpAuditPurgeJobsPort["hasJob"]) {
  return {
    hasJob: vi.fn<EnqueueMcpAuditPurgeJobsPort["hasJob"]>(hasJob),
    scheduleJob: vi.fn<EnqueueMcpAuditPurgeJobsPort["scheduleJob"]>(
      async () => undefined,
    ),
  };
}

describe("EnqueueMcpAuditPurgeUseCase", () => {
  describe("executeIfDue (daily fan-out)", () => {
    it("enqueues one job with an empty payload when none exists since UTC midnight", async () => {
      const jobs = createJobs(async () => false);
      const useCase = new EnqueueMcpAuditPurgeUseCase(jobs, () => NOW);

      const result = await useCase.executeIfDue();

      expect(result).toEqual({ enqueued: 1, skipped: false });
      expect(jobs.hasJob).toHaveBeenCalledWith(START_OF_DAY);
      expect(jobs.scheduleJob).toHaveBeenCalledWith({
        type: MCP_AUDIT_PURGE_JOB_TYPE,
        payload: {},
        scheduledAt: NOW,
      });
    });

    it("skips when a job already exists today", async () => {
      const jobs = createJobs(async () => true);
      const useCase = new EnqueueMcpAuditPurgeUseCase(jobs, () => NOW);

      const result = await useCase.executeIfDue();

      expect(result).toEqual({ enqueued: 0, skipped: true });
      expect(jobs.scheduleJob).not.toHaveBeenCalled();
    });

    it("enqueues again on the next UTC day", async () => {
      let currentNow = NOW;
      const created: Date[] = [];
      const jobs = createJobs(async (createdSince) =>
        created.some((at) => !createdSince || at >= createdSince),
      );
      jobs.scheduleJob.mockImplementation(async (input) => {
        created.push(input.scheduledAt);
      });
      const useCase = new EnqueueMcpAuditPurgeUseCase(jobs, () => currentNow);

      await useCase.executeIfDue();
      await useCase.executeIfDue();
      expect(jobs.scheduleJob).toHaveBeenCalledTimes(1);

      currentNow = new Date("2026-10-27T00:01:00.000Z");
      await useCase.executeIfDue();
      expect(jobs.scheduleJob).toHaveBeenCalledTimes(2);
    });
  });

  describe("execute (forced)", () => {
    it("checks only pending/running (no createdSince) and enqueues even after today's job is done", async () => {
      const jobs = createJobs(
        async (createdSince) => createdSince !== undefined,
      );
      const useCase = new EnqueueMcpAuditPurgeUseCase(jobs, () => NOW);

      const result = await useCase.execute();

      expect(result).toEqual({ enqueued: 1 });
      expect(jobs.hasJob).toHaveBeenCalledWith(undefined);
      expect(jobs.scheduleJob).toHaveBeenCalledTimes(1);
    });

    it("does not duplicate a job that is still pending/running", async () => {
      const jobs = createJobs(async () => true);
      const useCase = new EnqueueMcpAuditPurgeUseCase(jobs, () => NOW);

      const result = await useCase.execute();

      expect(result).toEqual({ enqueued: 0 });
      expect(jobs.scheduleJob).not.toHaveBeenCalled();
    });
  });
});
