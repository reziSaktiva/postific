import { asUserId } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleJobInput } from "../adapters/job-scheduler";
import {
  ENGAGEMENT_SYNC_JOB_TYPE,
  EngagementSyncJobHandler,
  type WorkspaceOwnerLookupPort,
} from "./engagement-sync-job-handler";
import type { SyncCommentsUseCase } from "./sync-comments.use-case";

const PAYLOAD = {
  workspaceId: "workspace-1",
  connectedAccountId: "account-1",
  outstandAccountId: "outstand-account-1",
};

function createOwnerLookup(
  overrides: Partial<WorkspaceOwnerLookupPort> = {},
): WorkspaceOwnerLookupPort {
  return {
    findAccountOwnerByOutstandAccountId: async () => ({
      workspaceId: PAYLOAD.workspaceId,
      connectedAccountId: PAYLOAD.connectedAccountId,
      ownerUserId: asUserId("owner-1"),
      handle: "@fake.account",
    }),
    ...overrides,
  };
}

describe("EngagementSyncJobHandler.handle", () => {
  it("memanggil SyncCommentsUseCase.sync dengan payload yang sudah di-cast ke branded type + ownerUserId hasil lookup", async () => {
    const sync = vi.fn<SyncCommentsUseCase["sync"]>(async () => ({
      newCommentsCount: 0,
    }));
    const useCase = { sync } as unknown as SyncCommentsUseCase;
    const scheduleJob = vi.fn(async () => undefined);
    const handler = new EngagementSyncJobHandler(
      useCase,
      { scheduleJob },
      createOwnerLookup(),
    );

    await handler.handle(PAYLOAD);

    expect(sync).toHaveBeenCalledTimes(1);
    const [calledPayload, calledUserId] = sync.mock.calls[0]!;
    expect(calledPayload).toEqual({
      workspaceId: PAYLOAD.workspaceId,
      connectedAccountId: PAYLOAD.connectedAccountId,
      accountUsername: "@fake.account",
    });
    expect(calledUserId).toBe("owner-1");
  });

  it("self-reschedule — enqueue job berikutnya dengan tipe+payload sama, scheduledAt ~30 menit ke depan", async () => {
    const sync = vi.fn(async () => ({ newCommentsCount: 2 }));
    const useCase = { sync } as unknown as SyncCommentsUseCase;
    const scheduledJobs: ScheduleJobInput[] = [];
    const scheduleJob = vi.fn(async (input: ScheduleJobInput) => {
      scheduledJobs.push(input);
    });
    const handler = new EngagementSyncJobHandler(
      useCase,
      { scheduleJob },
      createOwnerLookup(),
    );

    const before = Date.now();
    await handler.handle(PAYLOAD);
    const after = Date.now();

    expect(scheduleJob).toHaveBeenCalledTimes(1);
    const [job] = scheduledJobs;
    expect(job.type).toBe(ENGAGEMENT_SYNC_JOB_TYPE);
    expect(job.payload).toEqual(PAYLOAD);

    const THIRTY_MINUTES_MS = 30 * 60 * 1000;
    const scheduledAtMs = job.scheduledAt.getTime();
    expect(scheduledAtMs).toBeGreaterThanOrEqual(before + THIRTY_MINUTES_MS);
    expect(scheduledAtMs).toBeLessThanOrEqual(after + THIRTY_MINUTES_MS);
  });

  it("throw (bukan self-reschedule) kalau akun tidak ditemukan lewat lookup", async () => {
    const sync = vi.fn(async () => ({ newCommentsCount: 0 }));
    const useCase = { sync } as unknown as SyncCommentsUseCase;
    const scheduleJob = vi.fn(async () => undefined);
    const handler = new EngagementSyncJobHandler(
      useCase,
      { scheduleJob },
      createOwnerLookup({
        findAccountOwnerByOutstandAccountId: async () => null,
      }),
    );

    await expect(handler.handle(PAYLOAD)).rejects.toThrow();
    expect(sync).not.toHaveBeenCalled();
    expect(scheduleJob).not.toHaveBeenCalled();
  });

  it("throw kalau payload tidak valid (field hilang)", async () => {
    const sync = vi.fn(async () => ({ newCommentsCount: 0 }));
    const useCase = { sync } as unknown as SyncCommentsUseCase;
    const scheduleJob = vi.fn(async () => undefined);
    const handler = new EngagementSyncJobHandler(
      useCase,
      { scheduleJob },
      createOwnerLookup(),
    );

    await expect(
      handler.handle({ workspaceId: "workspace-1" }),
    ).rejects.toThrow();
    expect(sync).not.toHaveBeenCalled();
  });

  it("throw kalau hasil lookup tidak cocok dengan payload (defense-in-depth)", async () => {
    const sync = vi.fn(async () => ({ newCommentsCount: 0 }));
    const useCase = { sync } as unknown as SyncCommentsUseCase;
    const scheduleJob = vi.fn(async () => undefined);
    const handler = new EngagementSyncJobHandler(
      useCase,
      { scheduleJob },
      createOwnerLookup({
        findAccountOwnerByOutstandAccountId: async () => ({
          workspaceId: "workspace-DIFFERENT",
          connectedAccountId: PAYLOAD.connectedAccountId,
          ownerUserId: asUserId("owner-1"),
          handle: "@fake.account",
        }),
      }),
    );

    await expect(handler.handle(PAYLOAD)).rejects.toThrow();
    expect(sync).not.toHaveBeenCalled();
  });
});
