import { asUserId, asWorkspaceId } from "@postific/shared";
import type { IMcpWorkspaceChoiceRepository } from "@/domains/mcp-access";
import { Prisma } from "@/generated/prisma/client";
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
    // Pilihan baru menimpa yang lama; `createdAt` ikut diperbarui supaya baris
    // mencerminkan pilihan terakhir. Update HANYA menyentuh baris milik
    // `userId` yang sama (`where` memfilter kedua kolom kunci): pengguna lain
    // yang memakai `session_id` yang sama tidak bisa mengubah pilihan pemilik.
    const update = () =>
      prisma.mcpWorkspaceChoice.updateMany({
        where: { sessionId, userId },
        data: { workspaceId, expiresAt, createdAt },
      });

    if ((await update()).count === 0) {
      try {
        await prisma.mcpWorkspaceChoice.create({
          data: { sessionId, userId, workspaceId, expiresAt, createdAt },
        });
      } catch (error) {
        // P2002: baris sudah ada. Pemiliknya pengguna yang sama (dua simpan
        // bersamaan) -> update ulang berhasil; pemiliknya pengguna lain ->
        // update tetap 0 baris dan error dilempar ulang (tabrakan sesi tidak
        // terjadi di jalur sah: `session_id` unik per sesi login).
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";
        if (!isUniqueConflict || (await update()).count === 0) {
          throw error;
        }
      }
    }
    return { sessionId, userId, workspaceId, expiresAt };
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
