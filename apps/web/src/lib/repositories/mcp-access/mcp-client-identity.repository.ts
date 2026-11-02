import type { IMcpClientIdentityRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";

/** Batas baris per run supaya satu job tidak menahan DB; sisanya dihapus run berikutnya. */
const UNUSED_CLIENT_BATCH = 500;

/**
 * Repository klien OAuth hasil pendaftaran dinamis (`identity_oauth_client`,
 * tabel plugin `@better-auth/oauth-provider`; policy `app_runtime`, tanpa
 * migrasi). Baca hanya kolom yang ditampilkan layar persetujuan (`name`,
 * `redirectUris`): rahasia klien dan metadata lain tidak pernah dipilih.
 */
export const mcpClientIdentityRepository: IMcpClientIdentityRepository = {
  async findRegistration(clientId) {
    const row = await prisma.oauthClient.findUnique({
      where: { clientId },
      select: { name: true, redirectUris: true },
    });
    return row ? { name: row.name, redirectUris: row.redirectUris } : null;
  },

  /**
   * Kandidat: tanpa pemilik (`userId` null, hasil pendaftaran tanpa login) dan
   * lebih tua dari batas. Klien yang dirujuk consent, token, atau grant tidak
   * dihapus. Pemeriksaan dan penghapusan satu transaksi; klien setua batas
   * tidak lagi menerima consent baru, jadi balapan tidak realistis.
   */
  async deleteUnusedRegistrations(registeredBefore) {
    return prisma.$transaction(async (tx) => {
      const candidates = await tx.oauthClient.findMany({
        where: { userId: null, createdAt: { lt: registeredBefore } },
        select: { clientId: true },
        orderBy: { createdAt: "asc" },
        take: UNUSED_CLIENT_BATCH,
      });
      if (candidates.length === 0) {
        return 0;
      }
      const clientIds = candidates.map((c) => c.clientId);
      const inUse = { clientId: { in: clientIds } };
      const [consents, refresh, access, grants] = await Promise.all([
        tx.oauthConsent.findMany({ where: inUse, select: { clientId: true } }),
        tx.oauthRefreshToken.findMany({
          where: inUse,
          select: { clientId: true },
        }),
        tx.oauthAccessToken.findMany({
          where: inUse,
          select: { clientId: true },
        }),
        tx.mcpGrant.findMany({ where: inUse, select: { clientId: true } }),
      ]);
      const used = new Set(
        [...consents, ...refresh, ...access, ...grants].map((r) => r.clientId),
      );
      const unused = clientIds.filter((id) => !used.has(id));
      if (unused.length === 0) {
        return 0;
      }
      const result = await tx.oauthClient.deleteMany({
        where: { clientId: { in: unused } },
      });
      return result.count;
    });
  },
};
