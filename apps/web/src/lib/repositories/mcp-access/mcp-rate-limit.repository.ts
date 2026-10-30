import type { IMcpRateLimitRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";

/** Batas batch purge (sama alasannya dengan purge audit). */
export const MCP_RATE_LIMIT_PURGE_BATCH_SIZE = 5000;
export const MCP_RATE_LIMIT_PURGE_MAX_BATCHES = 100;

/**
 * Repository `mcp_rate_limit_windows` (BC-04, T-154). RLS hanya policy
 * `app_runtime` (ADR-141), tanpa `withCurrentUser`: dipanggil jalur token OAuth
 * dan JOB-08 yang tidak punya pengguna sesi. `workspaceId` datang dari service
 * (token + grant), bukan input tool.
 */
export const mcpRateLimitRepository: IMcpRateLimitRepository = {
  /**
   * Satu statement atomik:
   *
   * - Baris jendela belum ada: INSERT bila `amount <= limit` (SELECT ... WHERE
   *   menjaga kasus permintaan lebih besar dari seluruh batas).
   * - Baris sudah ada: `ON CONFLICT DO UPDATE ... WHERE count + amount <= limit`.
   *   Postgres mengunci baris konflik dan mengevaluasi WHERE terhadap versi
   *   terbaru, jadi dua transaksi bersamaan diserialkan dan tidak ada yang
   *   melewati batas (tanpa lock di aplikasi).
   * - Tidak ada baris dikembalikan = ditolak, penghitung tidak berubah.
   */
  async consume(input) {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "mcp_rate_limit_windows" AS w
        ("workspace_id", "quota", "window_start", "expires_at", "count")
      SELECT
        ${input.workspaceId}::uuid,
        ${input.quota},
        ${input.windowStart}::timestamptz,
        ${input.windowEnd}::timestamptz,
        ${input.amount}::int
      WHERE ${input.amount}::int <= ${input.limit}::int
      ON CONFLICT ("workspace_id", "quota", "window_start")
      DO UPDATE SET "count" = w."count" + EXCLUDED."count"
      WHERE w."count" + EXCLUDED."count" <= ${input.limit}::int
      RETURNING "count"
    `;
    const row = rows[0];
    return row
      ? { allowed: true, used: Number(row.count) }
      : { allowed: false };
  },

  /** Hapus bertahap (`expires_at < before`; indeks `..._expires_at_idx`), idempoten. */
  async deleteExpired(before) {
    let total = 0;
    for (let batch = 0; batch < MCP_RATE_LIMIT_PURGE_MAX_BATCHES; batch++) {
      const deleted = await prisma.$executeRaw`
        DELETE FROM "mcp_rate_limit_windows"
        WHERE ("workspace_id", "quota", "window_start") IN (
          SELECT "workspace_id", "quota", "window_start"
          FROM "mcp_rate_limit_windows"
          WHERE "expires_at" < ${before}::timestamptz
          LIMIT ${MCP_RATE_LIMIT_PURGE_BATCH_SIZE}
        )
      `;
      total += deleted;
      if (deleted < MCP_RATE_LIMIT_PURGE_BATCH_SIZE) {
        break;
      }
    }
    return total;
  },
};
