import { asUserId, asWorkspaceId } from "@postific/shared";
import type { IMcpWorkspaceChoiceRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";

/**
 * Repository `mcp_workspace_choices` (BC-04, T-151). RLS hanya policy
 * `app_runtime` (ADR-141), tanpa `withCurrentUser`: pemilik baris adalah
 * sesi login yang sudah divalidasi pemanggil (Server Action dan plugin OAuth),
 * bukan konteks RLS per pengguna. Karena itu SETIAP query memfilter kolom
 * kunci yang diterimanya (`session_id` dan `user_id`), bukan hanya satu.
 */
export const mcpWorkspaceChoiceRepository: IMcpWorkspaceChoiceRepository = {
  async upsert({ sessionId, userId, workspaceId, expiresAt, createdAt }) {
    const row = await prisma.mcpWorkspaceChoice.upsert({
      where: { sessionId },
      create: { sessionId, userId, workspaceId, expiresAt, createdAt },
      // Pilihan baru menimpa yang lama; `createdAt` ikut diperbarui supaya
      // baris mencerminkan pilihan terakhir.
      update: { userId, workspaceId, expiresAt, createdAt },
    });
    return {
      sessionId: row.sessionId,
      userId: asUserId(row.userId),
      workspaceId: asWorkspaceId(row.workspaceId),
      expiresAt: row.expiresAt,
    };
  },

  async findActive({ sessionId, userId }, now) {
    const row = await prisma.mcpWorkspaceChoice.findFirst({
      where: { sessionId, userId, expiresAt: { gt: now } },
    });
    return row
      ? {
          sessionId: row.sessionId,
          userId: asUserId(row.userId),
          workspaceId: asWorkspaceId(row.workspaceId),
          expiresAt: row.expiresAt,
        }
      : null;
  },

  /**
   * `deleteMany` satu statement: tabel ini hanya memuat satu baris per sesi
   * login dengan umur 10 menit, jadi tidak perlu batch seperti purge audit.
   * Memakai indeks `mcp_workspace_choices_expires_at_idx`.
   */
  async deleteExpired(now) {
    const result = await prisma.mcpWorkspaceChoice.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  },
};
