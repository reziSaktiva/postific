import { describe, expect, it } from "vitest";
import { manualImportSyncCapWhere } from "./manual-import-sync-cap";

describe("manualImportSyncCapWhere (T-115.4)", () => {
  it("counts only non-failed manual import.sync jobs, not periodic ones", () => {
    const since = new Date("2026-10-09T00:00:00.000Z");

    expect(manualImportSyncCapWhere("workspace-1", since)).toEqual({
      type: "import.sync",
      status: { not: "failed" },
      createdAt: { gte: since },
      payload: { path: ["workspaceId"], equals: "workspace-1" },
      AND: [{ payload: { path: ["trigger"], equals: "manual" } }],
    });
  });
});
