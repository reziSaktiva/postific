import type { ConnectedAccountId, WorkspaceId } from "@postific/shared";
import type {
  ClassifyImportedPostTargetUpdate,
  ClassifyImportedPostTargetsRepositoryResult,
} from "@/domains/publishing/repositories/publishing.repository";
import type { PrismaTransactionClient } from "@/lib/prisma/with-current-user";

/**
 * Klasifikasi `ContentFormat` post hasil Import (ADR-135, T-132.4) — logika
 * inti `IPublishingRepository.classifyImportedPostTargets` (lihat docstring
 * lengkap di sana), diekstrak ke fungsi berdiri sendiri (pola sama
 * `upsertImportedPostsTx`/`backfillImportedPostOutstandIdsTx`) supaya bisa
 * di-unit-test dengan `tx` palsu tanpa DB sungguhan.
 *
 * Satu `UPDATE` per entri `updates` (bukan batched `updateMany` dengan
 * `CASE WHEN`) — jumlah baris per sync kecil (N post yang baru diimpor,
 * dibatasi `limit` trigger T-131, maks 1000), kesederhanaan lebih penting
 * di sini daripada micro-optimisasi query count. Baris yang tidak match
 * (`platformPostId` tidak ditemukan untuk `connectedAccountId` ini, atau
 * post induknya sudah soft-deleted) dilewati diam-diam — `updateMany`
 * mengembalikan `count: 0` untuk kasus itu, bukan error.
 */
export async function classifyImportedPostTargetsTx(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
  connectedAccountId: ConnectedAccountId,
  updates: ClassifyImportedPostTargetUpdate[],
): Promise<ClassifyImportedPostTargetsRepositoryResult> {
  if (updates.length === 0) {
    return { updatedCount: 0 };
  }

  let updatedCount = 0;
  for (const update of updates) {
    const result = await tx.publishingPostTarget.updateMany({
      where: {
        connectedAccountId,
        platformPostId: update.platformPostId,
        post: { workspaceId, deletedAt: null },
      },
      data: { contentFormat: update.contentFormat },
    });
    updatedCount += result.count;
  }

  return { updatedCount };
}
