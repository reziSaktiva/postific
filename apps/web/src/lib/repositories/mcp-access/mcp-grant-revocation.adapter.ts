import type { IMcpGrantRevocationPort } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";

/**
 * Adapter `IMcpGrantRevocationPort` (BC-04, T-149.6). SATU transaksi Prisma
 * lintas tabel `mcp_grants` (milik kita) dan tabel plugin OAuth Better Auth
 * (`identity_oauth_consent`, `identity_oauth_refresh_token`; bentuknya tidak
 * diubah, hanya baris dihapus). Tanpa FK antar keduanya (keputusan T-149),
 * jadi atomisitas datang dari transaksi ini.
 *
 * Urutan penting dan tidak boleh dibalik:
 * 1. Tandai grant dicabut dengan predikat `id`, `user_id`, `client_id`,
 *    `workspace_id`, dan `revoked_at IS NULL` (tabel tanpa RLS per pengguna,
 *    ADR-141: `id` saja tidak cukup). Jumlah baris terdampak menentukan
 *    apakah panggilan ini yang mencabut; kunci yang tidak cocok = 0 baris.
 * 2. HANYA bila langkah 1 mengubah satu baris, hapus consent + refresh token
 *    koneksi itu. Grant yang sudah dicabut berarti consent yang sekarang ada
 *    bisa milik koneksi BARU (disambung ulang setelah pencabutan); panggilan
 *    basi tidak boleh menghapusnya.
 *
 * Gagal di langkah mana pun membatalkan seluruh transaksi. Filter consent dan
 * refresh token selalu memuat ketiga kunci (`clientId`, `userId`,
 * `referenceId = workspaceId`), tidak pernah hanya `clientId`, supaya koneksi
 * klien yang sama di workspace/pengguna lain tidak ikut terhapus. Access
 * token yang masih berlaku tidak diurus: ia ditolak pada panggilan
 * berikutnya karena grant sudah tidak aktif.
 */
export const mcpGrantRevocationAdapter: IMcpGrantRevocationPort = {
  async revokeAtomically({
    grantId,
    userId,
    clientId,
    workspaceId,
    revokedAt,
  }) {
    return prisma.$transaction(async (tx) => {
      const marked = await tx.mcpGrant.updateMany({
        where: { id: grantId, userId, clientId, workspaceId, revokedAt: null },
        data: { revokedAt },
      });
      if (marked.count !== 1) {
        return { revoked: false };
      }

      const connection = { clientId, userId, referenceId: workspaceId };
      await tx.oauthConsent.deleteMany({ where: connection });
      await tx.oauthRefreshToken.deleteMany({ where: connection });

      return { revoked: true };
    });
  },
};
