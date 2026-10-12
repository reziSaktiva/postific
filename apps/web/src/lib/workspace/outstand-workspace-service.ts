import {
  ANALYTICS_SYNC_JOB_TYPE,
  EnqueueAnalyticsSyncUseCase,
} from "@/domains/analytics";
import { ENGAGEMENT_SYNC_JOB_TYPE } from "@/domains/engagement";
import {
  ImportPostsProcessUseCase,
  ImportPostsTriggerUseCase,
} from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import {
  importJobRepository,
  publishingRepository,
} from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * Import Posts dari Social Account (T-090.3, ADR-093 poin 7) — satu-satunya
 * tempat `ImportPostsAutoTriggerPort`-shaped object dibentuk dari
 * `ImportPostsTriggerUseCase` (domain `publishing`) sungguhan, supaya
 * `WorkspaceService` tidak pernah mengimpor domain `publishing` langsung
 * (AGENTS.md #7). `updateImportWatermark` diteruskan apa adanya dari
 * `workspaceRepository` — bentuknya sudah cocok dengan
 * `ConnectedAccountWatermarkPort` di `ImportPostsTriggerUseCase`
 * (structural typing, tidak perlu wrapper tambahan).
 */
export function createImportPostsTriggerUseCase(): ImportPostsTriggerUseCase {
  return new ImportPostsTriggerUseCase(
    importJobRepository,
    getOutstandAdapter(),
    workspaceRepository,
    new ImportPostsProcessUseCase(publishingRepository),
  );
}

/**
 * Composition-root helper (T-013.1/T-013.2, T-015.3, ADR-105, T-090.3) —
 * dipakai Server Action (`connected-accounts/actions.ts`) dan Route Handler
 * (`/api/integrations/outstand/callback`), keduanya butuh `WorkspaceService`
 * yang sudah disuplai `IOutstandAdapter` untuk
 * `initiateConnectAccount`/`completeAccountConnection`, DAN (T-090.3)
 * `ImportPostsAutoTriggerPort` untuk auto-trigger import on-connect. Satu
 * factory supaya entry point-entry point ini tidak bisa diam-diam divergen
 * kalau wiring-nya berubah.
 *
 * Sejak Temuan #1 (review Ridwan Architecture Reviewer, T-051) — factory
 * ini JUGA menyuplai `EngagementSyncSeederPort` (parameter ke-5,
 * `WorkspaceService`) supaya `completeAccountConnection` bisa men-seed JOB-03
 * (`engagement.sync`) pertama untuk `ConnectedAccount` yang baru
 * dibuat/di-reconnect — sebelum ini, siklus sync 30 menit JOB-03 tidak
 * pernah mulai sendiri (tidak ada apa pun yang men-enqueue job pertamanya).
 * `ENGAGEMENT_SYNC_JOB_TYPE` diimpor DI SINI (composition root), BUKAN di
 * `workspace.service.ts` — domain `workspace` sendiri tidak tahu apa pun
 * soal tipe job `engagement`, hanya memanggil port generik (lihat
 * `EngagementSyncSeederPort` di `workspace.service.ts`). `backgroundJobScheduler`
 * di-reuse langsung (singleton generic yang sama dipakai `publishing` dan
 * `EngagementSyncJobHandler`, struktural cocok untuk `IJobScheduler` versi
 * manapun). `scheduledAt: now` — seed pertama harus segera dieksekusi oleh
 * job runner (bukan menunggu 30 menit), berbeda dari self-reschedule di
 * `EngagementSyncJobHandler` yang memang menunda `+30 menit`.
 */
export function createWorkspaceServiceWithOutstandAdapter(): WorkspaceService {
  const importPostsTriggerUseCase = createImportPostsTriggerUseCase();
  const enqueueAnalyticsSync = new EnqueueAnalyticsSyncUseCase(
    workspaceRepository,
    {
      hasActiveJob: (connectedAccountId) =>
        backgroundJobStore.hasActiveJobForPayloadKey({
          type: ANALYTICS_SYNC_JOB_TYPE,
          key: "connectedAccountId",
          value: connectedAccountId,
        }),
      scheduleJob: (input) => backgroundJobScheduler.scheduleJob(input),
    },
  );

  return new WorkspaceService(
    workspaceRepository,
    undefined,
    undefined,
    getOutstandAdapter(),
    {
      async onAccountConnected(input) {
        // Cegah dua chain `engagement.sync` paralel kalau akun yang sama
        // di-disconnect lalu di-reconnect cepat sebelum chain lama sempat
        // berhenti (disconnect tidak membatalkan job yang sudah di-enqueue).
        const alreadyScheduled =
          await backgroundJobStore.hasActiveJobForPayloadKey({
            type: ENGAGEMENT_SYNC_JOB_TYPE,
            key: "connectedAccountId",
            value: input.connectedAccountId,
          });

        if (alreadyScheduled) {
          return;
        }

        await backgroundJobScheduler.scheduleJob({
          type: ENGAGEMENT_SYNC_JOB_TYPE,
          payload: {
            workspaceId: input.workspaceId,
            connectedAccountId: input.connectedAccountId,
            outstandAccountId: input.outstandAccountId,
          },
          scheduledAt: new Date(),
        });

        await enqueueAnalyticsSync.enqueueForAccounts([
          {
            workspaceId: input.workspaceId,
            connectedAccountId: input.connectedAccountId,
            outstandAccountId: input.outstandAccountId,
          },
        ]);
      },
    },
    undefined,
    {
      triggerAuto: (input) => importPostsTriggerUseCase.triggerAuto(input),
    },
  );
}
