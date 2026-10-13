import type {
  IImportJobRepository,
  ImportSyncJobPayload,
  ImportSyncJobRecord,
} from "@/domains/publishing/repositories/import-job.repository";
import { Prisma } from "@/generated/prisma/client";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";
import { prisma } from "@/lib/prisma/client";
import { ConflictError } from "@/lib/utils/errors";

const IMPORT_SYNC_JOB_TYPE = "import.sync";

/**
 * Code review PR #148 (finding #4) — `hasActiveImportSyncJob` dulu
 * menganggap SEMUA baris `pending`/`running` aktif tanpa batas waktu; kalau
 * `markImportSyncJobStatus` di catch block `runImportSync` sendiri gagal
 * (mis. DB error transient), baris itu macet selamanya dan mengunci akun
 * itu dari sinkronisasi berikutnya tanpa ada jalur pemulihan otomatis.
 * Window ini membatasi "aktif" ke job yang dibuat dalam N menit terakhir —
 * JOB-05+JOB-06 berjalan SINKRON dalam satu `runImportSync` (lihat
 * docstring use-case), jadi eksekusi yang genuinely masih berjalan tidak
 * akan pernah mendekati batas ini; hanya baris yang benar-benar macet yang
 * "dilepas" setelah window berlalu.
 */
const STALE_IMPORT_SYNC_JOB_TIMEOUT_MS = 5 * 60 * 1000;

/** Satu-satunya unique constraint di `BackgroundJob` untuk tipe ini (migration `20261008130000_t090_concurrent_import_guard`) — pola sama `isConnectedAccountConflict` di `workspace.repository.ts`. */
function isActiveImportSyncConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.meta?.modelName === "BackgroundJob"
  );
}

/**
 * Prisma implementation of `IImportJobRepository` (T-090, ADR-093 poin
 * 7-9) — backed by `background_jobs` (`type: "import.sync"`), reuse pola
 * ADR-093 "Alternatives Considered" (tidak ada skema counter baru).
 * `background_jobs` TIDAK punya RLS (system-internal queue, lihat
 * migration T-017) — plain `prisma` client, bukan `withCurrentUser`.
 */
export const importJobRepository: IImportJobRepository = {
  async createImportSyncJob(
    payload: ImportSyncJobPayload,
  ): Promise<ImportSyncJobRecord> {
    let job;
    try {
      job = await prisma.backgroundJob.create({
        data: {
          type: IMPORT_SYNC_JOB_TYPE,
          payload: payload as unknown as Prisma.InputJsonValue,
          status: "pending",
        },
      });
    } catch (error) {
      if (isActiveImportSyncConflict(error)) {
        // Code review PR #148 (finding #2) — pre-check
        // `hasActiveImportSyncJob` di use-case adalah soft check (TOCTOU);
        // partial unique index `background_jobs_active_import_sync_account_key`
        // adalah gate SEBENARNYA. `runImportSync` menangkap `ConflictError`
        // ini dan mengembalikan `outcome: "rejected_concurrent"`, sama
        // seperti kalau pre-check-nya berhasil menangkap duluan.
        throw new ConflictError(
          `Sinkronisasi impor untuk connectedAccountId="${payload.connectedAccountId}" sudah berjalan.`,
        );
      }
      throw error;
    }

    return {
      id: job.id,
      payload: job.payload as unknown as ImportSyncJobPayload,
      status: job.status as ImportSyncJobRecord["status"],
      createdAt: job.createdAt,
    };
  },

  async markImportSyncJobStatus(jobId, status, lastError) {
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status,
        lastError: lastError ?? null,
        completedAt:
          status === "done" || status === "failed" ? new Date() : undefined,
        startedAt: status === "running" ? new Date() : undefined,
      },
    });
  },

  async hasActiveImportSyncJob(connectedAccountId) {
    // Code review PR #148 (finding #6) — reuse `backgroundJobStore`
    // (satu-satunya entry point `background_jobs` yang sudah dipakai
    // `job-scheduler.ts`/`outstand-workspace-service.ts`/`/api/jobs/run`)
    // alih-alih query ad-hoc terpisah; `staleAfterMs` menutup finding #4
    // (job macet tidak lagi mengunci selamanya).
    return backgroundJobStore.hasActiveJobForPayloadKey({
      type: IMPORT_SYNC_JOB_TYPE,
      key: "connectedAccountId",
      value: connectedAccountId,
      staleAfterMs: STALE_IMPORT_SYNC_JOB_TIMEOUT_MS,
    });
  },

  async countManualImportSyncJobsSince(workspaceId, since) {
    return prisma.backgroundJob.count({
      where: {
        type: IMPORT_SYNC_JOB_TYPE,
        // Code review PR #148 (finding #3) — job yang berakhir `failed`
        // TIDAK memakai jatah cap mingguan: sebelum perbaikan ini, setiap
        // percobaan (termasuk yang gagal karena adapter belum di-wire,
        // ADR-119) ikut terhitung, jadi satu klik "Sync Now" yang gagal
        // membuat workspace tidak bisa mencoba lagi selama seminggu
        // walau belum pernah ada import yang sukses.
        status: { not: "failed" },
        createdAt: { gte: since },
        payload: {
          path: ["workspaceId"],
          equals: workspaceId,
        },
        AND: [
          {
            payload: {
              path: ["trigger"],
              equals: "manual",
            },
          },
        ],
      },
    });
  },
};
