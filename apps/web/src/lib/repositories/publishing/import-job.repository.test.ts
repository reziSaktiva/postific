import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeRaw, update } = vi.hoisted(() => ({
  executeRaw: vi.fn(async () => 1),
  update: vi.fn(async () => ({})),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { $executeRaw: executeRaw, backgroundJob: { update } },
}));
vi.mock("@/lib/jobs/background-job-store", () => ({
  backgroundJobStore: {},
}));

import { importJobRepository } from "./import-job.repository";

describe("importJobRepository.markImportSyncJobStatus (T-143.3)", () => {
  beforeEach(() => {
    executeRaw.mockClear();
    update.mockClear();
  });

  it("merges result into the payload atomically in one statement, without reading the payload first", async () => {
    await importJobRepository.markImportSyncJobStatus(
      "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "done",
      undefined,
      { limit: 1000, fetchedPosts: 5 },
    );

    expect(update).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = executeRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join("?");
    expect(sql).toContain("payload = payload ||");
    expect(sql).toContain("::jsonb");
    expect(values).toContain(
      JSON.stringify({ result: { limit: 1000, fetchedPosts: 5 } }),
    );
    expect(values).toContain("done");
    expect(values).toContain("7c9e6679-7425-40de-944b-e07fc1f90ae7");
  });

  it("uses the plain update (payload untouched) when there is no result", async () => {
    await importJobRepository.markImportSyncJobStatus("job-1", "running");

    expect(executeRaw).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    const arg = (update.mock.calls[0] as unknown[])[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).not.toHaveProperty("payload");
    expect(arg.data.status).toBe("running");
  });
});
