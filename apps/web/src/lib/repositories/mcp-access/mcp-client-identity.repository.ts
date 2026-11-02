import type { IMcpClientIdentityRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";

/** Baris per pernyataan DELETE, dan batas pernyataan per run supaya satu job tidak menahan DB. */
const UNUSED_CLIENT_BATCH = 500;
const MAX_BATCHES = 20;

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
   * dihapus. Satu pernyataan `DELETE ... NOT EXISTS` per batch (atomik, tanpa
   * transaksi interaktif dan tanpa kursor), diulang sampai batch tidak penuh
   * atau `MAX_BATCHES`; sisanya dijangkau run berikutnya. Asumsi (tidak
   * ditegakkan): klien yang lebih tua dari batas tidak menyelesaikan consent
   * lagi; klien yang menyimpan `client_id`-nya bisa gagal `invalid_client` dan
   * mendaftar ulang.
   */
  async deleteUnusedRegistrations(registeredBefore) {
    let deleted = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const count = await prisma.$executeRaw`
        DELETE FROM identity_oauth_client
        WHERE id IN (
          SELECT c.id FROM identity_oauth_client c
          WHERE c."userId" IS NULL
            AND c."createdAt" < ${registeredBefore}
            AND NOT EXISTS (
              SELECT 1 FROM identity_oauth_consent x WHERE x."clientId" = c."clientId")
            AND NOT EXISTS (
              SELECT 1 FROM identity_oauth_refresh_token x WHERE x."clientId" = c."clientId")
            AND NOT EXISTS (
              SELECT 1 FROM identity_oauth_access_token x WHERE x."clientId" = c."clientId")
            AND NOT EXISTS (
              SELECT 1 FROM mcp_grants x WHERE x.client_id = c."clientId")
          ORDER BY c."createdAt" ASC, c.id ASC
          LIMIT ${UNUSED_CLIENT_BATCH}
        )`;
      deleted += count;
      if (count < UNUSED_CLIENT_BATCH) {
        break;
      }
    }
    return deleted;
  },
};
