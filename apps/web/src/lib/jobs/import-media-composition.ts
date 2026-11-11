import { asConnectedAccountId, asWorkspaceId } from "@postific/shared";
import {
  EnqueueImportMediaUseCase,
  IMPORT_MEDIA_JOB_TYPE,
  IMPORT_THUMBNAIL_SWEEP_JOB_TYPE,
  ProcessImportMediaUseCase,
  PurgeImportThumbnailsUseCase,
  type BackfillAccountsPort,
  type EnqueueImportThumbnailSweepJobsPort,
} from "@/domains/publishing";
import { importThumbnailGenerator } from "@/lib/adapters/import-thumbnail/import-thumbnail-generator";
import { supabaseImportThumbnailStorage } from "@/lib/adapters/import-thumbnail/supabase-import-thumbnail-storage";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import {
  importThumbnailReferenceRepository,
  publishingRepository,
} from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * Composition root thumbnail posting impor (T-230, ADR-158). Memetakan port
 * backfill ke `workspaceRepository` (daftar akun aktif dan pemilik akun) dan
 * merakit use case antrian dan pemroses. Satu tempat supaya route job dan
 * trigger import tidak bisa divergen.
 */
export function createBackfillAccountsPort(): BackfillAccountsPort {
  return {
    async listAccountsForBackfill() {
      const accounts =
        await workspaceRepository.listAccountsForPeriodicImportSync();
      return accounts.map((account) => ({
        workspaceId: asWorkspaceId(account.workspaceId),
        connectedAccountId: asConnectedAccountId(account.connectedAccountId),
        outstandAccountId: account.outstandAccountId,
      }));
    },
    async findOwnerUserId(outstandAccountId) {
      const owner =
        await workspaceRepository.findAccountOwnerByOutstandAccountId(
          outstandAccountId,
        );
      return owner?.ownerUserId ?? null;
    },
  };
}

export function createEnqueueImportMediaUseCase(): EnqueueImportMediaUseCase {
  return new EnqueueImportMediaUseCase(
    publishingRepository,
    backgroundJobScheduler,
    {
      backfillAccounts: createBackfillAccountsPort(),
      pendingJobs: {
        hasPendingJob: (connectedAccountId) =>
          backgroundJobStore.hasJobMatchingPayloadKey({
            type: IMPORT_MEDIA_JOB_TYPE,
            key: "connectedAccountId",
            value: connectedAccountId,
          }),
      },
    },
  );
}

export function createProcessImportMediaUseCase(): ProcessImportMediaUseCase {
  return new ProcessImportMediaUseCase(
    publishingRepository,
    importThumbnailGenerator,
  );
}

/** T-231 (ADR-158): pemurni thumbnail impor (hapus per workspace dan sapuan yatim). */
export function createPurgeImportThumbnailsUseCase(): PurgeImportThumbnailsUseCase {
  return new PurgeImportThumbnailsUseCase(
    supabaseImportThumbnailStorage,
    importThumbnailReferenceRepository,
  );
}

/** T-231: port antrian sapuan harian (JOB-10); payload kosong, dedup berbasis tipe job. */
export function createImportThumbnailSweepJobsPort(): EnqueueImportThumbnailSweepJobsPort {
  return {
    hasJob: (createdSince) =>
      backgroundJobStore.hasJobOfType({
        type: IMPORT_THUMBNAIL_SWEEP_JOB_TYPE,
        createdSince,
      }),
    scheduleJob: (input) => backgroundJobScheduler.scheduleJob(input),
  };
}
