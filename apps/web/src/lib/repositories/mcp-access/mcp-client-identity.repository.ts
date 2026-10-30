import type { IMcpClientIdentityRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";

/**
 * Pembaca klien OAuth hasil pendaftaran dinamis (`identity_oauth_client`,
 * tabel plugin `@better-auth/oauth-provider`). Hanya baca, dan hanya kolom
 * yang ditampilkan layar persetujuan (`name`, `redirectUris`): rahasia klien
 * dan metadata lain tidak pernah dipilih.
 */
export const mcpClientIdentityRepository: IMcpClientIdentityRepository = {
  async findRegistration(clientId) {
    const row = await prisma.oauthClient.findUnique({
      where: { clientId },
      select: { name: true, redirectUris: true },
    });
    return row ? { name: row.name, redirectUris: row.redirectUris } : null;
  },
};
