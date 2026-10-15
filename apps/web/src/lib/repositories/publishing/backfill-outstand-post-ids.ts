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
 *
 * Tabrakan unique index global `outstand_post_id` TIDAK boleh membatalkan
 * sisa batch (review T-114): id yang sudah dimiliki post lain dilewati
 * dan barisnya ditandai `outstandIdBackfillSkippedAt`, sama seperti
 * `backfillOutstandPostId` di `upsert-imported-posts.ts`. Baris yang
 * `platformPostId`-nya tidak muncul di riwayat Outstand (atau kosong)
 * ditandai dengan cara yang sama supaya existence check tidak mengunduh
 * ulang seluruh riwayat di sync berikutnya.
 */
export async function backfillImportedPostOutstandIdsTx(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
  connectedAccountId: ConnectedAccountId,
  mappings: OutstandPostIdMapping[],
  settleUnmatched: boolean,
): Promise<BackfillImportedPostOutstandIdsResult> {
  if (mappings.length === 0 && !settleUnmatched) {
    return { updatedCount: 0, skippedCount: 0 };
  }

  // Advisory lock — NAMESPACE YANG SAMA dengan `upsertImportedPostsTx`
  // (`hashtext(workspaceId)`), supaya backfill ini (transaksi TERPISAH dari
  // transaksi Import biasa) tidak bisa menulis `PublishingPost.outstandPostId`
  // bersamaan dengan `upsertImportedPosts` untuk workspace yang sama.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId})::bigint)`;

  const candidates = await tx.publishingPostTarget.findMany({
    where: {
      connectedAccountId,
      post: {
        workspaceId,
        status: ContentStatus.Imported,
        outstandPostId: null,
        deletedAt: null,
        outstandIdBackfillSkippedAt: null,
      },
    },
    select: { postId: true, platformPostId: true },
  });

  if (candidates.length === 0) {
    return { updatedCount: 0, skippedCount: 0 };
  }

  const outstandPostIdByPlatformPostId = new Map(
    mappings.map((mapping) => [mapping.platformPostId, mapping.outstandPostId]),
  );
  const platformPostIdsByPostId = new Map<string, Array<string | null>>();
  for (const candidate of candidates) {
    const platformPostIds = platformPostIdsByPostId.get(candidate.postId) ?? [];
    platformPostIds.push(candidate.platformPostId);
    platformPostIdsByPostId.set(candidate.postId, platformPostIds);
  }

  const idsToLock = new Set<string>();
  for (const platformPostIds of platformPostIdsByPostId.values()) {
    for (const platformPostId of platformPostIds) {
      if (!platformPostId) continue;
      const outstandPostId = outstandPostIdByPlatformPostId.get(platformPostId);
      if (outstandPostId) idsToLock.add(outstandPostId);
    }
  }

  // Lock per `outstandPostId`, key-space yang SAMA dengan
  // `upsertImportedPostsTx`, diurutkan supaya dua transaksi tidak deadlock.
  // Hanya id yang benar-benar mungkin ditulis batch ini — bukan seluruh
  // riwayat akun. Satu query lewat `unnest`+`ORDER BY` (bukan loop per id)
  // supaya N id tidak jadi N round-trip DB terpisah selagi memegang lock
  // workspace di atas.
  const sortedOutstandPostIds = [...idsToLock].sort();
  if (sortedOutstandPostIds.length > 0) {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext('publishing.outstand_post_id'), hashtext(id))
      FROM unnest(${sortedOutstandPostIds}::text[]) AS t(id)
      ORDER BY id
    `;
  }

  const owners = await findOutstandPostOwners(tx, sortedOutstandPostIds);
  const skippedAt = new Date();
  let updatedCount = 0;
  let skippedCount = 0;

  for (const postId of [...platformPostIdsByPostId.keys()].sort()) {
    const mappedIds = [
      ...new Set(
        (platformPostIdsByPostId.get(postId) ?? []).flatMap(
          (platformPostId) => {
            if (!platformPostId) return [];
            const outstandPostId =
              outstandPostIdByPlatformPostId.get(platformPostId);
            return outstandPostId ? [outstandPostId] : [];
          },
        ),
      ),
    ].sort();

    const chosen = mappedIds.find((outstandPostId) => {
      const owner = owners.get(outstandPostId);
      return owner === undefined || owner.postId === postId;
    });

    if (!chosen) {
      const hasPlatformPostId = (
        platformPostIdsByPostId.get(postId) ?? []
      ).some(
        (platformPostId) =>
          platformPostId !== null && platformPostId.length > 0,
      );
      // Tidak ada di peta ini. Kalau riwayat belum lengkap (terpotong atau
      // shape drift), baris itu mungkin masih muncul di halaman berikutnya
      // — jangan ditandai selesai. `platformPostId` kosong tidak akan pernah
      // cocok, jadi tetap ditandai.
      const absentFromThisHistory = mappedIds.length === 0 && hasPlatformPostId;
      if (absentFromThisHistory && !settleUnmatched) continue;

      skippedCount += await markBackfillSkipped(
        tx,
        workspaceId,
        postId,
        skippedAt,
      );
      continue;
    }

    const updated = await tx.publishingPost.updateMany({
      where: {
        id: postId,
        workspaceId,
        outstandPostId: null,
        deletedAt: null,
        outstandIdBackfillSkippedAt: null,
      },
      data: { outstandPostId: chosen },
    });
    if (updated.count === 0) continue;

    updatedCount += updated.count;
    const previous = owners.get(chosen);
    owners.set(chosen, {
      postId,
      workspaceId,
      connectedAccountIds: previous?.connectedAccountIds ?? new Set<string>(),
    });
  }

  return { updatedCount, skippedCount };
}

type OutstandPostOwner = {
  postId: string;
  workspaceId: string;
  connectedAccountIds: Set<string>;
};

type GlobalOutstandPostRow = {
  post_id: string;
  workspace_id: string;
  connected_account_id: string;
};

/**
 * Pemilik `outstandPostId` yang sudah tersimpan. Lookup global memakai
 * fungsi SECURITY DEFINER yang sama dengan import T-113 (RLS menyembunyikan
 * workspace lain dari `findMany`). `findMany` lokal menambah post di
 * workspace ini yang punya id itu walau tidak ikut hasil fungsi (fungsi
 * itu JOIN ke target).
 */
async function findOutstandPostOwners(
  tx: PrismaTransactionClient,
  outstandPostIds: string[],
): Promise<Map<string, OutstandPostOwner>> {
  const owners = new Map<string, OutstandPostOwner>();

  if (outstandPostIds.length === 0) return owners;

  // Satu query lewat `unnest`+`LATERAL` (bukan satu `$queryRaw` per id)
  // supaya N outstandPostId tidak jadi N round-trip DB terpisah — fungsi
  // SECURITY DEFINER-nya sendiri tidak berubah, hanya dipanggil per baris
  // dalam satu statement.
  const rows = await tx.$queryRaw<
    (GlobalOutstandPostRow & { outstand_post_id: string })[]
  >`
    SELECT
      ids.id AS outstand_post_id,
      t.post_id,
      t.workspace_id,
      t.connected_account_id
    FROM unnest(${outstandPostIds}::text[]) AS ids(id)
    CROSS JOIN LATERAL "public"."webhook_find_post_targets_by_outstand_post_id"(ids.id) AS t
  `;
  for (const row of rows) {
    const current = owners.get(row.outstand_post_id) ?? {
      postId: row.post_id,
      workspaceId: row.workspace_id,
      connectedAccountIds: new Set<string>(),
    };
    current.connectedAccountIds.add(row.connected_account_id);
    owners.set(row.outstand_post_id, current);
  }

  const localOwners = await tx.publishingPost.findMany({
    where: {
      outstandPostId: { in: outstandPostIds },
      deletedAt: null,
    },
    select: { id: true, workspaceId: true, outstandPostId: true },
  });
  for (const row of localOwners) {
    if (!row.outstandPostId || owners.has(row.outstandPostId)) continue;
    owners.set(row.outstandPostId, {
      postId: row.id,
      workspaceId: row.workspaceId,
      connectedAccountIds: new Set(),
    });
  }

  return owners;
}

async function markBackfillSkipped(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
  postId: string,
  skippedAt: Date,
): Promise<number> {
  const result = await tx.publishingPost.updateMany({
    where: {
      id: postId,
      workspaceId,
      outstandPostId: null,
      deletedAt: null,
      outstandIdBackfillSkippedAt: null,
    },
    data: { outstandIdBackfillSkippedAt: skippedAt },
  });
  return result.count;
}
