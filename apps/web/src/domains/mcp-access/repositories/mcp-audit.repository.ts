import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";
import type {
  McpAuditEntry,
  McpAuditStatus,
} from "../entities/mcp-audit-entry";
import type { McpScope } from "../value-objects/mcp-scope";

/**
 * Repository interface — implementation (Prisma) lives in
 * src/lib/repositories/mcp-access (T-149.6).
 */
export interface IMcpAuditRepository {
  /**
   * Sisipkan satu baris audit. `inputSummary` sudah tersamar (service);
   * implementasi menyimpannya apa adanya dan TIDAK boleh menerima argumen
   * mentah tool.
   */
  create(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    grantId: McpGrantId | null;
    clientId: string;
    toolName: string;
    scope: McpScope;
    inputSummary: string | null;
    status: McpAuditStatus;
    errorCode: string | null;
    durationMs: number | null;
    targetId: string | null;
    createdAt: Date;
  }): Promise<McpAuditEntry>;

  /**
   * Hapus semua baris dengan `created_at < cutoff`, lintas workspace
   * (JOB-08). Mengembalikan jumlah baris yang dihapus. Idempoten: tanpa baris
   * kedaluwarsa hasilnya 0. Implementasi boleh menghapus bertahap untuk
   * menghindari transaksi besar; hasilnya tetap total terhapus.
   */
  deleteOlderThan(cutoff: Date): Promise<number>;
}
