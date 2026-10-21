import type {
  ConnectedAccountId,
  ContentFormat,
  WorkspaceId,
} from "@postific/shared";
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
 * Dikelompokkan per `contentFormat` lalu satu `updateMany` (dengan
 * `platformPostId: { in: [...] }`) per grup — bukan satu `UPDATE` per entri.
 * `ContentFormat` adalah enum kecil (Post/Reel/Story), jadi walau `updates`
 * bisa sampai 1000 baris (limit trigger T-131), jumlah query tetap paling
 * banyak 3 — menghindari sampai 1000 round-trip DB sequential yang
 * memperpanjang durasi transaction & tekanan connection-pool sebanding
 * ukuran batch. Baris yang tidak match (`platformPostId` tidak ditemukan
 * untuk `connectedAccountId` ini, atau post induknya sudah soft-deleted)
 * dilewati diam-diam — `updateMany` mengembalikan `count: 0` untuk kasus
 * itu, bukan error.
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

  const platformPostIdsByContentFormat = new Map<ContentFormat, string[]>();
  for (const update of updates) {
    const platformPostIds =
      platformPostIdsByContentFormat.get(update.contentFormat) ?? [];
    platformPostIds.push(update.platformPostId);
    platformPostIdsByContentFormat.set(update.contentFormat, platformPostIds);
  }

  let updatedCount = 0;
  for (const [
    contentFormat,
    platformPostIds,
  ] of platformPostIdsByContentFormat) {
    const result = await tx.publishingPostTarget.updateMany({
      where: {
        connectedAccountId,
        platformPostId: { in: platformPostIds },
        post: { workspaceId, deletedAt: null },
      },
      data: { contentFormat },
    });
    updatedCount += result.count;
  }

  return { updatedCount };
}
