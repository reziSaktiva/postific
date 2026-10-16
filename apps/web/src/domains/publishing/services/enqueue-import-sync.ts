import { SocialPlatform } from "@postific/shared";
import { ConflictError } from "@/lib/utils/errors";
import { startOfUtcDay } from "@/lib/jobs/utc-day";
import { IMPORT_SYNC_JOB_TYPE } from "./import-sync-job-handler";

export interface EnqueueImportSyncAccount {
  workspaceId: string;
  connectedAccountId: string;
  outstandAccountId: string;
  platform: SocialPlatform;
}

export interface EnqueueImportSyncAccountsPort {
  listAccountsForPeriodicImportSync(): Promise<EnqueueImportSyncAccount[]>;
}

export interface EnqueueImportSyncJobsPort {
  /**
   * `createdSince` diisi untuk fan-out harian: lewati akun yang sudah
   * punya job `import.sync` sejak awal hari UTC, atau yang masih
   * pending/running. Tanpa `createdSince`: hanya pending/running
   * (trigger paksa `?type=import`).
   */
  hasAccountJob(
    connectedAccountId: string,
    createdSince?: Date,
  ): Promise<boolean>;
  scheduleJob(input: {
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
  }): Promise<void>;
}

/**
 * Fan-out JOB-05 (T-115). Satu baris `import.sync` pending per
 * `ConnectedAccount` aktif. Dipanggil cron menit yang sudah hidup
 * (paling banyak sekali per hari UTC lewat `executeIfDue`). Tidak
 * menjalankan import-nya — runner yang mengklaim baris `queued: true`.
 */
export class EnqueueImportSyncUseCase {
  constructor(
    private readonly accounts: EnqueueImportSyncAccountsPort,
    private readonly jobs: EnqueueImportSyncJobsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Paksa antrian baru. Akun yang masih pending/running tidak digandakan.
   * Akun yang job-nya sudah `done` hari ini boleh dijadwalkan lagi.
   */
  async execute(): Promise<{ enqueued: number }> {
    const accounts = await this.accounts.listAccountsForPeriodicImportSync();
    return { enqueued: await this.enqueueForAccounts(accounts) };
  }

  /**
   * Antrian harian. Akun yang sudah dapat job `import.sync` sejak tengah
   * malam UTC dilewati, termasuk sisa job kemarin yang masih berjalan.
   */
  async executeIfDue(): Promise<{ enqueued: number; skipped: boolean }> {
    const since = startOfUtcDay(this.now());
    const accounts = await this.accounts.listAccountsForPeriodicImportSync();
    const enqueued = await this.enqueueForAccounts(accounts, since);
    return { enqueued, skipped: enqueued === 0 };
  }

  private async enqueueForAccounts(
    accounts: EnqueueImportSyncAccount[],
    createdSince?: Date,
  ): Promise<number> {
    let enqueued = 0;
    const scheduledAt = this.now();

    for (const account of accounts) {
      const alreadyScheduled = await this.jobs.hasAccountJob(
        account.connectedAccountId,
        createdSince,
      );
      if (alreadyScheduled) {
        continue;
      }

      try {
        await this.jobs.scheduleJob({
          type: IMPORT_SYNC_JOB_TYPE,
          payload: {
            trigger: "periodic",
            queued: true,
            workspaceId: account.workspaceId,
            connectedAccountId: account.connectedAccountId,
            outstandAccountId: account.outstandAccountId,
            platform: account.platform,
            since: "",
            until: "",
          },
          scheduledAt,
        });
      } catch (error) {
        if (error instanceof ConflictError) {
          continue;
        }
        throw error;
      }

      enqueued += 1;
    }

    return enqueued;
  }
}
