import type { WorkspaceId } from "@postific/shared";
import type { PrismaTransactionClient } from "@/lib/prisma/with-current-user";

/**
 * Pemilik sebuah `outstandPostId` yang sudah tersimpan. Dipakai bersama
 * oleh import (T-113) dan backfill (T-114) supaya kedua jalur membaca
 * tabrakan unique index global dengan bentuk yang sama.
 */
export type OutstandPostOwner = {
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
 * Advisory lock per workspace — namespace yang sama untuk
 * `upsertImportedPostsTx` dan `backfillImportedPostOutstandIdsTx`.
 * Dilepas otomatis saat transaksi commit/rollback.
 */
export async function lockWorkspaceForOutstandIdWrite(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId})::bigint)`;
}

/**
 * Lock per `outstandPostId`, key-space `(int, int)` terpisah dari lock
 * workspace. Pemanggil mengirim id yang sudah terurut; `ORDER BY` di SQL
 * mengunci dalam urutan yang sama supaya dua transaksi tidak deadlock.
 * Satu query lewat `unnest`, bukan satu round-trip per id.
 */
export async function lockOutstandPostIds(
  tx: PrismaTransactionClient,
  sortedOutstandPostIds: string[],
): Promise<void> {
  if (sortedOutstandPostIds.length === 0) return;

  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext('publishing.outstand_post_id'), hashtext(id))
    FROM unnest(${sortedOutstandPostIds}::text[]) AS t(id)
    ORDER BY id
  `;
}

/**
 * Pemilik `outstandPostId` yang sudah tersimpan. Lookup global memakai
 * fungsi SECURITY DEFINER (RLS menyembunyikan workspace lain dari
 * `findMany`). `findMany` lokal menambah post di workspace ini yang
 * punya id itu walau tidak ikut hasil fungsi (fungsi itu JOIN ke target).
 * Fungsi SQL-nya tidak berubah — hanya dipanggil per baris lewat
 * `unnest`+`LATERAL` dalam satu statement.
 */
export async function findOutstandPostOwners(
  tx: PrismaTransactionClient,
  outstandPostIds: string[],
): Promise<Map<string, OutstandPostOwner>> {
  const owners = new Map<string, OutstandPostOwner>();

  if (outstandPostIds.length === 0) return owners;

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
