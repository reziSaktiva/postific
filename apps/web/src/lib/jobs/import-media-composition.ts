import { asConnectedAccountId, asWorkspaceId } from "@postific/shared";
import {
  EnqueueImportMediaUseCase,
  IMPORT_MEDIA_JOB_TYPE,
  ProcessImportMediaUseCase,
  type BackfillAccountsPort,
} from "@/domains/publishing";
import { importThumbnailGenerator } from "@/lib/adapters/import-thumbnail/import-thumbnail-generator";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import { publishingRepository } from "@/lib/repositories/publishing";
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
