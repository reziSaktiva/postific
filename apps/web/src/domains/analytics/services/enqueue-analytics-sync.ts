import {
  ANALYTICS_SYNC_JOB_TYPE,
  analyticsWorkspaceSnapshotPayload,
  type AnalyticsSyncAccount,
} from "./analytics-sync-job-handler";

export interface EnqueueAnalyticsSyncAccountsPort {
  listActiveConnectedAccountsForSync(): Promise<AnalyticsSyncAccount[]>;
}

export interface EnqueueAnalyticsSyncJobsPort {
  /**
   * `createdSince` diisi untuk fan-out harian: lewati akun yang sudah
   * punya job sejak awal hari UTC, atau yang masih pending/running.
   * Tanpa `createdSince`: hanya pending/running (seed saat connect, dan
   * trigger manual).
   */
  hasAccountJob(
    connectedAccountId: string,
    createdSince?: Date,
  ): Promise<boolean>;
  hasWorkspaceSnapshot(
    workspaceId: string,
    createdSince?: Date,
  ): Promise<boolean>;
  scheduleJob(input: {
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
  }): Promise<void>;
}

/**
 * Fan-out JOB-04 (T-048.2). Satu job metrik post per `ConnectedAccount`
 * aktif, plus satu job snapshot per workspace. Dipanggil cron menit yang
 * sudah hidup (paling banyak sekali per hari UTC) dan saat akun terhubung
 * supaya angka pertama tidak menunggu tengah malam.
 */
export class EnqueueAnalyticsSyncUseCase {
  constructor(
    private readonly accounts: EnqueueAnalyticsSyncAccountsPort,
    private readonly jobs: EnqueueAnalyticsSyncJobsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Paksa antrian baru. Job yang masih pending/running tidak digandakan. */
  async execute(): Promise<{ enqueued: number }> {
    const accounts = await this.accounts.listActiveConnectedAccountsForSync();
    return { enqueued: await this.enqueueForAccounts(accounts) };
  }

  /**
   * Antrian harian. Akun atau workspace yang sudah dapat job sejak tengah
   * malam UTC dilewati, termasuk sisa job kemarin yang masih berjalan.
   */
  async executeIfDue(): Promise<{ enqueued: number; skipped: boolean }> {
    const since = startOfUtcDay(this.now());
    const accounts = await this.accounts.listActiveConnectedAccountsForSync();
    const enqueued = await this.enqueueForAccounts(accounts, since);
    return { enqueued, skipped: enqueued === 0 };
  }

  async enqueueForAccounts(
    accounts: AnalyticsSyncAccount[],
    createdSince?: Date,
  ): Promise<number> {
    let enqueued = 0;
    const scheduledAt = this.now();
    const workspaceIds: string[] = [];
    const seenWorkspaces = new Set<string>();

    for (const account of accounts) {
      if (!seenWorkspaces.has(account.workspaceId)) {
        seenWorkspaces.add(account.workspaceId);
        workspaceIds.push(account.workspaceId);
      }

      const alreadyScheduled = await this.jobs.hasAccountJob(
        account.connectedAccountId,
        createdSince,
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

    for (const workspaceId of workspaceIds) {
      const alreadyScheduled = await this.jobs.hasWorkspaceSnapshot(
        workspaceId,
        createdSince,
      );
      if (alreadyScheduled) {
        continue;
      }

      const snapshot = analyticsWorkspaceSnapshotPayload(workspaceId);
      await this.jobs.scheduleJob({
        type: ANALYTICS_SYNC_JOB_TYPE,
        payload: {
          scope: snapshot.scope,
          workspaceId: snapshot.workspaceId,
          workspaceSnapshotId: snapshot.workspaceSnapshotId,
        },
        scheduledAt,
      });
      enqueued += 1;
    }

    return enqueued;
  }
}

export function startOfUtcDay(now: Date): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}
