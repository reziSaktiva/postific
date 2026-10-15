import {
  ContentStatus,
  type ConnectedAccountId,
  type OutstandPostIdMapping,
  type WorkspaceId,
} from "@postific/shared";
import type { BackfillImportedPostOutstandIdsResult } from "@/domains/publishing/repositories/publishing.repository";
import type { PrismaTransactionClient } from "@/lib/prisma/with-current-user";

/**
 * Backfill `outstandPostId` post Imported lama (T-114, perluasan
 * T-113/KI-090) — logika inti `IPublishingRepository.
 * backfillImportedPostOutstandIds` (lihat docstring lengkap di sana),
 * diekstrak ke fungsi berdiri sendiri (pola sama `upsertImportedPostsTx`)
 * supaya bisa di-unit-test dengan `tx` palsu tanpa DB sungguhan —
 * `PublishingRepository.backfillImportedPostOutstandIds` di
 * `publishing.repository.ts` hanya membungkusnya dengan `withCurrentUser`.
 */
export async function backfillImportedPostOutstandIdsTx(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
  connectedAccountId: ConnectedAccountId,
  mappings: OutstandPostIdMapping[],
): Promise<BackfillImportedPostOutstandIdsResult> {
  if (mappings.length === 0) {
    return { updatedCount: 0 };
  }

  // Advisory lock — NAMESPACE YANG SAMA dengan `upsertImportedPostsTx`
  // (`hashtext(workspaceId)`), supaya backfill ini (transaksi TERPISAH dari
  // transaksi Import biasa) tidak bisa menulis `PublishingPost.outstandPostId`
  // bersamaan dengan `upsertImportedPosts` untuk workspace yang sama —
  // keduanya dijaga partial unique index GLOBAL yang sama (migration
  // `20260907130000_t026_unique_outstand_post_id`). Dilepas otomatis saat
  // transaksi commit/rollback — lihat docstring
  // `IPublishingRepository.backfillImportedPostOutstandIds`.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId})::bigint)`;

  const platformPostIds = [...new Set(mappings.map((m) => m.platformPostId))];
  const outstandPostIdByPlatformPostId = new Map(
    mappings.map((m) => [m.platformPostId, m.outstandPostId]),
  );

  const candidates = await tx.publishingPostTarget.findMany({
    where: {
      connectedAccountId,
      platformPostId: { in: platformPostIds },
      post: {
        workspaceId,
        status: ContentStatus.Imported,
        outstandPostId: null,
        deletedAt: null,
      },
    },
    select: { postId: true, platformPostId: true },
  });

  let updatedCount = 0;
  for (const candidate of candidates) {
    if (!candidate.platformPostId) continue;
    const outstandPostId = outstandPostIdByPlatformPostId.get(
      candidate.platformPostId,
    );
    if (!outstandPostId) continue;

    // `WHERE outstandPostId: null` lagi di sini (bukan hanya di SELECT di
    // atas) — lapis idempoten kedua, aman kalau baris ini kebetulan sudah
    // terisi di antara SELECT dan UPDATE ini (mis. import baru yang
    // kebetulan berjalan tepat sebelum lock di atas berhasil diambil).
    const result = await tx.publishingPost.updateMany({
      where: { id: candidate.postId, outstandPostId: null },
      data: { outstandPostId },
    });
    updatedCount += result.count;
  }

  return { updatedCount };
}
