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

/** Dedup antrian: akun yang masih punya job `import.media` pending/running tidak diantrikan lagi. */
export interface PendingImportMediaPort {
  hasPendingJob(connectedAccountId: string): Promise<boolean>;
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
  private readonly backfillAccounts?: BackfillAccountsPort;
  private readonly pendingJobs?: PendingImportMediaPort;
  private readonly now: () => Date;

  constructor(
    private readonly repository: IPublishingRepository,
    private readonly jobScheduler: IJobScheduler,
    options: {
      backfillAccounts?: BackfillAccountsPort;
      pendingJobs?: PendingImportMediaPort;
      now?: () => Date;
    } = {},
  ) {
    this.backfillAccounts = options.backfillAccounts;
    this.pendingJobs = options.pendingJobs;
    this.now = options.now ?? (() => new Date());
  }

  /** Mengembalikan jumlah target yang diantrikan (0 bila akun masih punya job pending/running). */
  async enqueueForAccount(input: {
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    actingUserId: UserId;
  }): Promise<number> {
    // Tanpa ini setiap import menggandakan job untuk target yang sama selagi
    // job sebelumnya belum jalan (unduh dan upload ganda ke path yang sama).
    if (await this.pendingJobs?.hasPendingJob(input.connectedAccountId)) {
      return 0;
    }
    const targetIds =
      await this.repository.listImportedTargetIdsNeedingThumbnail(
        {
          workspaceId: input.workspaceId,
          connectedAccountId: input.connectedAccountId,
          limit: MAX_TARGETS_PER_ENQUEUE,
        },
        input.actingUserId,
      );
    const scheduledAt = this.now();
    const batches: string[][] = [];
    for (let i = 0; i < targetIds.length; i += IMPORT_MEDIA_BATCH_SIZE) {
      batches.push(targetIds.slice(i, i + IMPORT_MEDIA_BATCH_SIZE));
    }
    // Paralel (bukan satu per satu): puluhan insert berurutan memperpanjang
    // jalur import saat DB lambat.
    await Promise.all(
      batches.map((batch) =>
        this.jobScheduler.scheduleJob({
          type: IMPORT_MEDIA_JOB_TYPE,
          payload: {
            workspaceId: input.workspaceId,
            connectedAccountId: input.connectedAccountId,
            actingUserId: input.actingUserId,
            targetIds: batch,
          },
          scheduledAt,
        }),
      ),
    );
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
