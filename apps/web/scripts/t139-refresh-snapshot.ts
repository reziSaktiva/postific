/**
 * Verifikasi satu-kali — T-130/T-136 (kasus nonzero), pendamping
 * `t139-verify-large-import.ts`. Memicu job snapshot workspace
 * (`AnalyticsSyncJobHandler`, weekly + monthly) untuk semua workspace, tanpa menunggu cron harian, supaya Home langsung
 * mencerminkan post Imported baru. Memanggil Outstand (metrics) dan menulis
 * `analytics_workspace_snapshots`.
 *
 *   bun --env-file=.env.local run scripts/t139-refresh-snapshot.ts
 */
import {
  AnalyticsIngestionUseCase,
  AnalyticsSyncJobHandler,
  analyticsWorkspaceSnapshotPayload,
} from "@/domains/analytics";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

async function main(): Promise<void> {
  // Handler produksi yang sama dengan `/api/jobs/run` — script ini hanya
  // memicunya per workspace, tidak menyalin logikanya.
  const handler = new AnalyticsSyncJobHandler(
    new AnalyticsIngestionUseCase(
      analyticsRepository,
      getOutstandAdapter(),
      publishingRepository,
    ),
    workspaceRepository,
    publishingRepository,
    workspaceRepository,
  );
  const accounts =
    await workspaceRepository.listActiveConnectedAccountsForSync();
  const workspaceIds = [...new Set(accounts.map((a) => a.workspaceId))];

  let failed = 0;
  for (const workspaceId of workspaceIds) {
    try {
      await handler.handle(analyticsWorkspaceSnapshotPayload(workspaceId));
      console.log(`[t139-snapshot] ${workspaceId} OK (weekly + monthly)`);
    } catch (error) {
      failed++;
      console.error(`[t139-snapshot] ${workspaceId} GAGAL:`, error);
    }
  }
  if (failed > 0) {
    throw new Error(`${failed} dari ${workspaceIds.length} workspace gagal.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[t139-snapshot] fatal:", error);
    process.exit(1);
  });
