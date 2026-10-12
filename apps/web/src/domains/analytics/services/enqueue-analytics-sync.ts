import {
  ANALYTICS_SYNC_JOB_TYPE,
  type AnalyticsSyncAccount,
} from "./analytics-sync-job-handler";

export interface EnqueueAnalyticsSyncAccountsPort {
  listActiveConnectedAccountsForSync(): Promise<AnalyticsSyncAccount[]>;
}

export interface EnqueueAnalyticsSyncJobsPort {
  hasActiveJob(connectedAccountId: string): Promise<boolean>;
  scheduleJob(input: {
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
  }): Promise<void>;
}

/**
 * Fan-out JOB-04 (T-048.2, `background-jobs.md` § Cron Trigger): satu job
 * `analytics.sync` per `ConnectedAccount` aktif yang belum punya job
 * pending/running. Dipanggil Railway Cron harian (`?type=analytics`) dan
 * saat akun baru terhubung supaya snapshot pertama tidak menunggu tengah
 * malam UTC.
 */
export class EnqueueAnalyticsSyncUseCase {
  constructor(
    private readonly accounts: EnqueueAnalyticsSyncAccountsPort,
    private readonly jobs: EnqueueAnalyticsSyncJobsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<{ enqueued: number }> {
    const accounts = await this.accounts.listActiveConnectedAccountsForSync();
    return { enqueued: await this.enqueueForAccounts(accounts) };
  }

  async enqueueForAccounts(accounts: AnalyticsSyncAccount[]): Promise<number> {
    let enqueued = 0;
    const scheduledAt = this.now();

    for (const account of accounts) {
      const alreadyScheduled = await this.jobs.hasActiveJob(
        account.connectedAccountId,
      );
      if (alreadyScheduled) {
        continue;
      }

      await this.jobs.scheduleJob({
        type: ANALYTICS_SYNC_JOB_TYPE,
        payload: {
          workspaceId: account.workspaceId,
          connectedAccountId: account.connectedAccountId,
          outstandAccountId: account.outstandAccountId,
        },
        scheduledAt,
      });
      enqueued += 1;
    }

    return enqueued;
  }
}
