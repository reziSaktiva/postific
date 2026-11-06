import { describe, expect, it, vi } from "vitest";
import {
  IMPORT_MEDIA_BATCH_SIZE,
  IMPORT_MEDIA_JOB_TYPE,
  ImportMediaJobHandler,
  parseImportMediaPayload,
} from "./import-media-job-handler";

describe("ImportMediaJobHandler (T-230)", () => {
  it("memakai tipe job import.media", () => {
    expect(IMPORT_MEDIA_JOB_TYPE).toBe("import.media");
  });

  it("mengurai payload dan mendelegasikan ke pemroses", async () => {
    const process = vi.fn(async () => ({}));
    const handler = new ImportMediaJobHandler({ process });

    await handler.handle({
      workspaceId: "w1",
      actingUserId: "u1",
      targetIds: ["t1", "t2"],
    });

    expect(process).toHaveBeenCalledWith({
      workspaceId: "w1",
      actingUserId: "u1",
      targetIds: ["t1", "t2"],
    });
  });

  it.each([
    null,
    "teks",
    {},
    { workspaceId: "w", actingUserId: "u", targetIds: [] },
    { workspaceId: "w", actingUserId: "u", targetIds: [1] },
    { workspaceId: "", actingUserId: "u", targetIds: ["t"] },
    { workspaceId: "w", actingUserId: "u" },
    {
      workspaceId: "w",
      actingUserId: "u",
      targetIds: Array.from(
        { length: IMPORT_MEDIA_BATCH_SIZE + 1 },
        (_, i) => `t${i}`,
      ),
    },
  ])("menolak payload tidak valid: %j", (payload) => {
    expect(() => parseImportMediaPayload(payload)).toThrow(/tidak valid/);
  });
});
