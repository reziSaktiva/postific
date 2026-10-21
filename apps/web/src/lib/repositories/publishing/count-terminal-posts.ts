import { HISTORY_TERMINAL_STATUSES } from "@/domains/publishing";
import type { Prisma } from "@/generated/prisma/client";

/**
 * `where` Prisma untuk `IPublishingRepository.countTerminalPosts`
 * (T-130/KI-093) — diekstrak jadi fungsi murni (pola sama
 * `manualImportSyncCapWhere`) supaya bentuk filter bisa dites tanpa DB
 * nyata. Half-open `[since, until)`, sama semantik dengan
 * `publishedAtRange` di `listHistory`/`getPostPerformance`.
 */
export function countTerminalPostsWhere(
  workspaceId: string,
  since: Date,
  until: Date,
): Prisma.PublishingPostWhereInput {
  return {
    workspaceId,
    deletedAt: null,
    status: { in: [...HISTORY_TERMINAL_STATUSES] },
    publishedAt: { gte: since, lt: until },
  };
}
