import type { UserId, WorkspaceId } from "@postific/shared";
import type { McpWorkspaceChoice } from "../entities/mcp-workspace-choice";

/**
 * Repository interface — implementation (Prisma) lives in
 * src/lib/repositories/mcp-access (T-151).
 *
 * Tabel `mcp_workspace_choices` tidak punya isolasi per pengguna di level DB
 * (policy `app_runtime`, ADR-141): SETIAP query implementasi memfilter kolom
 * kunci yang diterimanya, bukan hanya `session_id`.
 */
export interface IMcpWorkspaceChoiceRepository {
  /**
   * Simpan pilihan untuk `sessionId`; pilihan sebelumnya untuk sesi yang sama
   * ditimpa (`workspaceId`, `userId`, dan `expiresAt` diganti).
   */
  upsert(input: {
    sessionId: string;
    userId: UserId;
    workspaceId: WorkspaceId;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<McpWorkspaceChoice>;

  /**
   * Pilihan yang masih berlaku untuk sesi DAN pemiliknya
   * (`WHERE session_id = ? AND user_id = ? AND expires_at > now`); `null` bila
   * tidak ada, kedaluwarsa, atau milik pengguna lain.
   */
  findActive(
    key: { sessionId: string; userId: UserId },
    now: Date,
  ): Promise<McpWorkspaceChoice | null>;

  /**
   * Hapus semua pilihan dengan `expires_at <= now`, lintas pengguna (JOB-08).
   * Mengembalikan jumlah baris yang dihapus. Idempoten.
   */
  deleteExpired(now: Date): Promise<number>;
}
