import type { IMcpAuditRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";
import { toMcpAuditEntry } from "./mappers";

/** Ukuran batch purge: cukup besar agar sedikit round-trip, cukup kecil agar transaksi tidak besar. */
export const MCP_AUDIT_PURGE_BATCH_SIZE = 5000;

/**
 * Batas batch per run supaya satu request cron tidak berputar tanpa ujung saat
 * backlog besar; sisanya dilanjutkan run berikutnya (idempoten).
 */
export const MCP_AUDIT_PURGE_MAX_BATCHES = 100;

/**
 * Repository `mcp_audit_logs` (BC-04, T-149.6). RLS hanya policy
 * `app_runtime` (ADR-141), tanpa `withCurrentUser`: baris audit ditulis
 * jalur token OAuth dan dihapus jalur sistem (JOB-08) yang tidak punya
 * pengguna sesi. `workspaceId`/`userId` selalu datang dari service
 * (diturunkan dari token + grant), bukan dari input tool.
 */
export const mcpAuditRepository: IMcpAuditRepository = {
  async create(input) {
    const row = await prisma.mcpAuditLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        grantId: input.grantId,
        clientId: input.clientId,
        toolName: input.toolName,
        scope: input.scope,
        inputSummary: input.inputSummary,
        status: input.status,
        errorCode: input.errorCode,
        durationMs: input.durationMs,
        targetId: input.targetId,
        createdAt: input.createdAt,
      },
    });
    return toMcpAuditEntry(row);
  },

  /**
   * Hapus bertahap (`created_at < cutoff`, lintas workspace; indeks
   * `mcp_audit_logs_created_at_idx`) supaya satu run tidak membuat transaksi
   * raksasa. Setiap batch adalah statement sendiri; berhenti saat batch
   * yang terhapus lebih kecil dari ukuran batch. Idempoten: tanpa baris
   * kedaluwarsa, batch pertama menghapus 0 dan hasilnya 0.
   */
  async deleteOlderThan(cutoff) {
    let total = 0;
    for (let batch = 0; batch < MCP_AUDIT_PURGE_MAX_BATCHES; batch++) {
      const deleted = await prisma.$executeRaw`
        DELETE FROM "mcp_audit_logs"
        WHERE "id" IN (
          SELECT "id" FROM "mcp_audit_logs"
          WHERE "created_at" < ${cutoff}::timestamptz
          LIMIT ${MCP_AUDIT_PURGE_BATCH_SIZE}
        )
      `;
      total += deleted;
      if (deleted < MCP_AUDIT_PURGE_BATCH_SIZE) {
        break;
      }
    }
    return total;
  },
};
