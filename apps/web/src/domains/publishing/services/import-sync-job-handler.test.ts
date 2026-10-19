import {
  asConnectedAccountId,
  asWorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { ImportSyncJobHandler } from "./import-sync-job-handler";

const payload = {
  trigger: "periodic" as const,
  queued: true,
  workspaceId: "workspace-1",
  connectedAccountId: "account-1",
  outstandAccountId: "outstand-1",
  platform: SocialPlatform.Facebook,
  since: "",
  until: "",
};

describe("ImportSyncJobHandler", () => {
  it("delegates a queued periodic payload to the import use case", async () => {
    const executeQueuedPeriodicImport = vi.fn(async () => undefined);
    const handler = new ImportSyncJobHandler({ executeQueuedPeriodicImport });

    await handler.handle(payload, "job-1");

    expect(executeQueuedPeriodicImport).toHaveBeenCalledWith({
      jobId: "job-1",
      workspaceId: asWorkspaceId("workspace-1"),
      connectedAccountId: asConnectedAccountId("account-1"),
      outstandAccountId: "outstand-1",
      platform: SocialPlatform.Facebook,
    });
  });

  it("throws when the payload is not an object", async () => {
    const handler = new ImportSyncJobHandler({
      executeQueuedPeriodicImport: vi.fn(),
    });

    await expect(handler.handle(null, "job-1")).rejects.toThrow(/tidak valid/);
  });

  it("throws when the job is inline rather than a queued periodic row", async () => {
    const executeQueuedPeriodicImport = vi.fn();
    const handler = new ImportSyncJobHandler({ executeQueuedPeriodicImport });

    await expect(
      handler.handle({ ...payload, queued: false, trigger: "manual" }, "job-1"),
    ).rejects.toThrow(/bukan milik runner/);
    await expect(
      handler.handle(
        { ...payload, trigger: "periodic", queued: undefined },
        "job-1",
      ),
    ).rejects.toThrow(/bukan milik runner/);
    expect(executeQueuedPeriodicImport).not.toHaveBeenCalled();
  });

  it("throws when a queued periodic payload is missing platform", async () => {
    const handler = new ImportSyncJobHandler({
      executeQueuedPeriodicImport: vi.fn(),
    });

    await expect(
      handler.handle({ ...payload, platform: "myspace" }, "job-1"),
    ).rejects.toThrow(/tidak valid/);
  });

  it("propagates a failed import so the runner can retry or dead-letter", async () => {
    const handler = new ImportSyncJobHandler({
      executeQueuedPeriodicImport: vi.fn(async () => {
        throw new Error("Outstand down");
      }),
    });

    await expect(handler.handle(payload, "job-1")).rejects.toThrow(
      /Outstand down/,
    );
  });
});
