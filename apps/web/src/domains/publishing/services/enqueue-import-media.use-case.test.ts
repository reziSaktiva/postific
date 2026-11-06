import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type { IJobScheduler } from "../adapters/job-scheduler";
import type { IPublishingRepository } from "../repositories/publishing.repository";
import { EnqueueImportMediaUseCase } from "./enqueue-import-media.use-case";
import { IMPORT_MEDIA_JOB_TYPE } from "./import-media-job-handler";

const workspaceId = asWorkspaceId("w1");
const connectedAccountId = asConnectedAccountId("a1");
const actingUserId = asUserId("u1");
const now = new Date("2026-11-06T10:00:00Z");

function ids(n: number) {
  return Array.from({ length: n }, (_, i) => `t${i}`);
}

function setup(targetIds: string[]) {
  const scheduleJob = vi.fn(async () => undefined);
  const list = vi.fn(async () => targetIds);
  const repository = {
    listImportedTargetIdsNeedingThumbnail: list,
  } as unknown as IPublishingRepository;
  const scheduler: IJobScheduler = { scheduleJob };
  return { scheduleJob, list, repository, scheduler };
}

describe("EnqueueImportMediaUseCase (T-230)", () => {
  it("membagi target menjadi job per 5", async () => {
    const { repository, scheduler, scheduleJob } = setup(ids(25));
    const useCase = new EnqueueImportMediaUseCase(
      repository,
      scheduler,
      undefined,
      () => now,
    );

    const count = await useCase.enqueueForAccount({
      workspaceId,
      connectedAccountId,
      actingUserId,
    });

    expect(count).toBe(25);
    expect(scheduleJob).toHaveBeenCalledTimes(5);
    const calls = scheduleJob.mock.calls as unknown as [
      { type: string; payload: { targetIds: string[] }; scheduledAt: Date },
    ][];
    expect(calls.map(([job]) => job.payload.targetIds.length)).toEqual([
      5, 5, 5, 5, 5,
    ]);
    expect(calls[0][0].type).toBe(IMPORT_MEDIA_JOB_TYPE);
    expect(calls[0][0].scheduledAt).toEqual(now);
  });

  it("tanpa target tertunda tidak mengantrikan apa pun", async () => {
    const { repository, scheduler, scheduleJob } = setup([]);
    const count = await new EnqueueImportMediaUseCase(
      repository,
      scheduler,
    ).enqueueForAccount({ workspaceId, connectedAccountId, actingUserId });
    expect(count).toBe(0);
    expect(scheduleJob).not.toHaveBeenCalled();
  });

  it("meminta paling banyak 200 target per pemanggilan", async () => {
    const { repository, scheduler, list } = setup([]);
    await new EnqueueImportMediaUseCase(
      repository,
      scheduler,
    ).enqueueForAccount({
      workspaceId,
      connectedAccountId,
      actingUserId,
    });
    expect(list).toHaveBeenCalledWith(
      { workspaceId, connectedAccountId, limit: 200 },
      actingUserId,
    );
  });

  it("backfill melewati akun tanpa pemilik dan menjumlahkan antrian", async () => {
    const { repository, scheduler, scheduleJob } = setup(ids(3));
    const useCase = new EnqueueImportMediaUseCase(repository, scheduler, {
      listAccountsForBackfill: async () => [
        { workspaceId, connectedAccountId, outstandAccountId: "o1" },
        {
          workspaceId,
          connectedAccountId: asConnectedAccountId("a2"),
          outstandAccountId: "o2",
        },
      ],
      findOwnerUserId: async (outstandId) =>
        outstandId === "o1" ? actingUserId : null,
    });

    const result = await useCase.enqueueBackfill();

    expect(result).toEqual({ accounts: 2, enqueued: 3 });
    expect(scheduleJob).toHaveBeenCalledTimes(1);
  });

  it("backfill tanpa port akun melempar", async () => {
    const { repository, scheduler } = setup([]);
    await expect(
      new EnqueueImportMediaUseCase(repository, scheduler).enqueueBackfill(),
    ).rejects.toThrow(/backfillAccounts/);
  });
});
