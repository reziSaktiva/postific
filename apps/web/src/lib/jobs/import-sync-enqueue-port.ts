import { IMPORT_SYNC_JOB_TYPE } from "@/domains/publishing/services/import-sync-job-handler";
import type { EnqueueImportSyncJobsPort } from "@/domains/publishing/services/enqueue-import-sync";
import type { ImportSyncJobPayload } from "@/domains/publishing/repositories/import-job.repository";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";
import { importJobRepository } from "@/lib/repositories/publishing";

/**
 * Composition root JOB-05 — memetakan port antrian import ke
 * `background_jobs`. Insert lewat `createImportSyncJob` (bukan
 * `runImportSync`) supaya baris tetap `pending` sampai runner mengklaimnya,
 * dan pelanggaran unique index akun aktif jadi `ConflictError` yang
 * fan-out perlakukan sebagai skip.
 */
export function createImportSyncJobsPort(): EnqueueImportSyncJobsPort {
  return {
    hasAccountJob: (connectedAccountId, createdSince) =>
      backgroundJobStore.hasJobMatchingPayloadKey({
        type: IMPORT_SYNC_JOB_TYPE,
        key: "connectedAccountId",
        value: connectedAccountId,
        createdSince,
      }),
    scheduleJob: async (input) => {
      await importJobRepository.createImportSyncJob(
        input.payload as unknown as ImportSyncJobPayload,
      );
    },
  };
}
