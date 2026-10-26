import { IMPORT_SYNC_JOB_TYPE } from "@/domains/publishing/services/import-sync-job-handler";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Cap mingguan ADR-093 poin 9. Hanya baris `import.sync` dengan
 * `payload.trigger = "manual"` dan status bukan `failed`. Job periodik
 * (inline maupun queued `trigger: "periodic"`) tidak memakai jatah ini.
 */
export function manualImportSyncCapWhere(
  workspaceId: string,
  since: Date,
): Prisma.BackgroundJobWhereInput {
  return {
    type: IMPORT_SYNC_JOB_TYPE,
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
  };
}
