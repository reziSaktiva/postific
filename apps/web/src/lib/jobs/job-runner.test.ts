import { describe, expect, it, vi } from "vitest";
import type { ClaimedBackgroundJob } from "./background-job-store";
import {
  runPendingJobs,
  type JobHandler,
  type JobRunnerStore,
} from "./job-runner";

function createFakeStore(
  overrides: Partial<JobRunnerStore> = {},
): JobRunnerStore {
  return {
    claimPending: async () => [],
    markDone: async () => undefined,
    scheduleRetry: async () => undefined,
    markFailed: async () => undefined,
    ...overrides,
  };
}

function job(
  overrides: Partial<ClaimedBackgroundJob> = {},
): ClaimedBackgroundJob {
  return {
    id: "job-1",
    type: "test.job",
    payload: { foo: "bar" },
    attempts: 0,
    maxAttempts: 3,
    ...overrides,
  };
}

describe("runPendingJobs", () => {
  it("marks a job done when its handler succeeds", async () => {
    const markDone = vi.fn(async () => undefined);
    const store = createFakeStore({
      claimPending: async () => [job()],
      markDone,
    });
    const handler: JobHandler = vi.fn(async () => undefined);

    const summary = await runPendingJobs(store, { "test.job": handler });

    expect(handler).toHaveBeenCalledWith({ foo: "bar" });
    expect(markDone).toHaveBeenCalledWith("job-1");
    expect(summary).toEqual({
      claimed: 1,
      results: [{ id: "job-1", type: "test.job", outcome: "done" }],
    });
  });

  it("schedules a backoff retry (T-027.3) when the handler throws and attempts < maxAttempts", async () => {
    const scheduleRetry = vi.fn(async () => undefined);
    const store = createFakeStore({
      claimPending: async () => [job({ attempts: 0, maxAttempts: 3 })],
      scheduleRetry,
    });
    const handler: JobHandler = async () => {
      throw new Error("transient failure");
    };
    const now = () => new Date("2026-09-17T00:00:00.000Z");

    const summary = await runPendingJobs(
      store,
      { "test.job": handler },
      { now },
    );

    // attempts becomes 1 → 5 menit backoff (BG-D04, tabel eksplisit
    // background-jobs.md, bukan formula yang kontradiktif — lihat backoff.ts).
    expect(scheduleRetry).toHaveBeenCalledWith("job-1", {
      attempts: 1,
      scheduledAt: new Date("2026-09-17T00:05:00.000Z"),
      error: "transient failure",
    });
    expect(summary.results).toEqual([
      {
        id: "job-1",
        type: "test.job",
        outcome: "retry",
        error: "transient failure",
      },
    ]);
  });

  it("dead-letters (BG-D06) when attempts reaches maxAttempts, without scheduling another retry", async () => {
    const scheduleRetry = vi.fn(async () => undefined);
    const markFailed = vi.fn(async () => undefined);
    const store = createFakeStore({
      claimPending: async () => [job({ attempts: 2, maxAttempts: 3 })],
      scheduleRetry,
      markFailed,
    });
    const handler: JobHandler = async () => {
      throw new Error("still pending");
    };

    const summary = await runPendingJobs(store, { "test.job": handler });

    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith("job-1", {
      attempts: 3,
      error: "still pending",
    });
    expect(summary.results).toEqual([
      {
        id: "job-1",
        type: "test.job",
        outcome: "dead_lettered",
        error: "still pending",
      },
    ]);
  });

  it("dead-letters immediately (no attempts increment) when no handler is registered for the job type", async () => {
    const markFailed = vi.fn(async () => undefined);
    const store = createFakeStore({
      claimPending: async () => [job({ type: "unknown.type", attempts: 0 })],
      markFailed,
    });

    const summary = await runPendingJobs(store, {});

    expect(markFailed).toHaveBeenCalledWith("job-1", {
      attempts: 0,
      error: expect.stringContaining("unknown.type"),
    });
    expect(summary.results[0].outcome).toBe("no_handler");
  });

  it("runs multiple claimed jobs independently — one failure does not block the others", async () => {
    const markDone = vi.fn(async () => undefined);
    const markFailed = vi.fn(async () => undefined);
    const store = createFakeStore({
      claimPending: async () => [
        job({ id: "job-ok", type: "a" }),
        job({ id: "job-bad", type: "b", attempts: 2, maxAttempts: 3 }),
      ],
      markDone,
      markFailed,
    });
    const handlers: Record<string, JobHandler> = {
      a: async () => undefined,
      b: async () => {
        throw new Error("boom");
      },
    };

    const summary = await runPendingJobs(store, handlers);

    expect(summary.claimed).toBe(2);
    expect(markDone).toHaveBeenCalledWith("job-ok");
    expect(markFailed).toHaveBeenCalledWith("job-bad", {
      attempts: 3,
      error: "boom",
    });
  });
});
