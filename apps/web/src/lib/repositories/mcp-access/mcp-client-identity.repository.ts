import type { IMcpClientIdentityRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";

/** Ukuran halaman pindaian kandidat, dan batas halaman per run supaya satu job tidak menahan DB. */
const UNUSED_CLIENT_BATCH = 500;
const MAX_PAGES = 20;

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
   * dihapus. Kandidat dipindai per halaman dengan kursor, jadi klien terpakai
   * yang tertua tidak menghalangi klien tak terpakai yang lebih baru; pindaian
   * dibatasi `MAX_PAGES`, sisanya dijangkau run berikutnya. Asumsi (tidak
   * ditegakkan): klien yang lebih tua dari batas tidak menyelesaikan consent
   * lagi; klien yang menyimpan `client_id`-nya bisa gagal `invalid_client` dan
   * mendaftar ulang. Transaksi menjaga pemeriksaan dan penghapusan konsisten.
   */
  async deleteUnusedRegistrations(registeredBefore) {
    return prisma.$transaction(async (tx) => {
      let deleted = 0;
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const candidates = await tx.oauthClient.findMany({
          where: { userId: null, createdAt: { lt: registeredBefore } },
          select: { id: true, clientId: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: UNUSED_CLIENT_BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (candidates.length === 0) {
          break;
        }
        cursor = candidates[candidates.length - 1].id;
        const clientIds = candidates.map((c) => c.clientId);
        const inUse = { clientId: { in: clientIds } };
        const [consents, refresh, access, grants] = await Promise.all([
          tx.oauthConsent.findMany({
            where: inUse,
            select: { clientId: true },
          }),
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
          [...consents, ...refresh, ...access, ...grants].map(
            (r) => r.clientId,
          ),
        );
        const unused = clientIds.filter((id) => !used.has(id));
        if (unused.length > 0) {
          const result = await tx.oauthClient.deleteMany({
            where: { clientId: { in: unused } },
          });
          deleted += result.count;
        }
        if (candidates.length < UNUSED_CLIENT_BATCH) {
          break;
        }
      }
      return deleted;
    });
  },
};
