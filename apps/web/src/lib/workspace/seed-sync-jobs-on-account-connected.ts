import type { AnalyticsSyncAccount } from "@/domains/analytics";

/**
 * Seed JOB-03 dan JOB-04 saat akun terhubung.
 *
 * Guard engagement hanya menahan chain `engagement.sync` kedua. Analytics
 * tetap di-enqueue: kalau return di guard engagement, reconnect saat job
 * komentar masih hidup tidak pernah mengisi snapshot.
 */
export async function seedSyncJobsOnAccountConnected(
  input: AnalyticsSyncAccount,
  deps: {
    hasActiveEngagementJob: (connectedAccountId: string) => Promise<boolean>;
    scheduleEngagementJob: (account: AnalyticsSyncAccount) => Promise<void>;
    enqueueAnalytics: (accounts: AnalyticsSyncAccount[]) => Promise<number>;
  },
): Promise<void> {
  const alreadyScheduled = await deps.hasActiveEngagementJob(
    input.connectedAccountId,
  );
  if (!alreadyScheduled) {
    await deps.scheduleEngagementJob(input);
  }

  await deps.enqueueAnalytics([input]);
}
