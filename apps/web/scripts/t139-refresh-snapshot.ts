/**
 * Verifikasi satu-kali — T-130/T-136 (kasus nonzero), pendamping
 * `t139-verify-large-import.ts`. Mengulang persis langkah
 * `AnalyticsSyncJobHandler.syncWorkspace` (snapshot weekly + monthly) untuk
 * semua workspace, tanpa menunggu cron harian, supaya Home langsung
 * mencerminkan post Imported baru. Memanggil Outstand (metrics) dan menulis
 * `analytics_workspace_snapshots`.
 *
 *   bun --env-file=.env.local run scripts/t139-refresh-snapshot.ts
 */
import { asConnectedAccountId, asWorkspaceId } from "@postific/shared";
import {
  AnalyticsIngestionUseCase,
  resolveAnalyticsSnapshotWindow,
} from "@/domains/analytics";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

async function main(): Promise<void> {
  const ingestion = new AnalyticsIngestionUseCase(
    analyticsRepository,
    getOutstandAdapter(),
    publishingRepository,
  );
  const accounts =
    await workspaceRepository.listActiveConnectedAccountsForSync();
  const workspaceIds = [...new Set(accounts.map((a) => a.workspaceId))];

  for (const workspaceId of workspaceIds) {
    const workspaceAccounts = accounts.filter(
      (a) => a.workspaceId === workspaceId,
    );
    const owner = await workspaceRepository.findAccountOwnerByOutstandAccountId(
      workspaceAccounts[0]!.outstandAccountId,
    );
    if (!owner) throw new Error(`Owner ${workspaceId} tidak ditemukan.`);
    const now = new Date();
    for (const period of ["weekly", "monthly"] as const) {
      const window = resolveAnalyticsSnapshotWindow(period, now);
      const snapshot = await ingestion.syncWorkspaceSnapshot(
        {
          workspaceId: asWorkspaceId(workspaceId),
          period,
          ...window,
          accounts: workspaceAccounts.map((a) => ({
            connectedAccountId: asConnectedAccountId(a.connectedAccountId),
            outstandAccountId: a.outstandAccountId,
          })),
        },
        owner.ownerUserId,
      );
      console.log(
        `[t139-snapshot] ${workspaceId} ${period} totalPosts=${snapshot.totalPosts} reach=${snapshot.totalReach}`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[t139-snapshot] fatal:", error);
    process.exit(1);
  });
