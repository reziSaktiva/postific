import type { ConnectedAccountId, UserId, WorkspaceId } from "@postific/shared";
import type { IJobScheduler } from "../adapters/job-scheduler";
import type { IPublishingRepository } from "../repositories/publishing.repository";
import {
  IMPORT_MEDIA_BATCH_SIZE,
  IMPORT_MEDIA_JOB_TYPE,
} from "./import-media-job-handler";

/** Batas target yang diantrikan per pemanggilan, agar import pertama (1000 posting) tidak membanjiri `background_jobs` sekaligus; sisanya terambil pada pemanggilan berikutnya. */
const MAX_TARGETS_PER_ENQUEUE = 200;

export interface BackfillAccount {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
}

export interface BackfillAccountsPort {
  listAccountsForBackfill(): Promise<BackfillAccount[]>;
  findOwnerUserId(outstandAccountId: string): Promise<UserId | null>;
}

/**
 * Antrikan job `import.media` (T-230, ADR-158) untuk target posting impor yang
 * belum punya thumbnail dan belum pernah dicoba, dalam batch kecil. Dipanggil
 * setelah Import (best-effort) dan oleh backfill sekali jalan.
 */
export class EnqueueImportMediaUseCase {
  constructor(
    private readonly repository: IPublishingRepository,
    private readonly jobScheduler: IJobScheduler,
    private readonly backfillAccounts?: BackfillAccountsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Mengembalikan jumlah target yang diantrikan. */
  async enqueueForAccount(input: {
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    actingUserId: UserId;
  }): Promise<number> {
    const targetIds =
      await this.repository.listImportedTargetIdsNeedingThumbnail(
        {
          workspaceId: input.workspaceId,
          connectedAccountId: input.connectedAccountId,
          limit: MAX_TARGETS_PER_ENQUEUE,
        },
        input.actingUserId,
      );
    for (let i = 0; i < targetIds.length; i += IMPORT_MEDIA_BATCH_SIZE) {
      await this.jobScheduler.scheduleJob({
        type: IMPORT_MEDIA_JOB_TYPE,
        payload: {
          workspaceId: input.workspaceId,
          actingUserId: input.actingUserId,
          targetIds: targetIds.slice(i, i + IMPORT_MEDIA_BATCH_SIZE),
        },
        scheduledAt: this.now(),
      });
    }
    return targetIds.length;
  }

  /** Backfill sekali jalan (`?type=import-media`): semua akun aktif. Akun tanpa pemilik dilewati. */
  async enqueueBackfill(): Promise<{ accounts: number; enqueued: number }> {
    if (!this.backfillAccounts) {
      throw new Error(
        "EnqueueImportMediaUseCase: backfillAccounts tidak disuplai.",
      );
    }
    const accounts = await this.backfillAccounts.listAccountsForBackfill();
    let enqueued = 0;
    for (const account of accounts) {
      const actingUserId = await this.backfillAccounts.findOwnerUserId(
        account.outstandAccountId,
      );
      if (!actingUserId) continue;
      enqueued += await this.enqueueForAccount({
        workspaceId: account.workspaceId,
        connectedAccountId: account.connectedAccountId,
        actingUserId,
      });
    }
    return { accounts: accounts.length, enqueued };
  }
}
