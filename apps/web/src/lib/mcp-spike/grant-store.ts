/**
 * T-149.2 (mini-spike titik kait grant) — SEMENTARA. Pengganti tabel
 * `mcp_grants` (dibuat di T-149.3) supaya harness bisa membuktikan titik kait
 * tanpa menyentuh DB. Bentuk antarmukanya meniru yang akan dibutuhkan
 * `McpAccessService` (T-149.5/.6): upsert dari consent, cari grant aktif,
 * cabut. Jangan dikembangkan; diganti repository Prisma di T-149.6.
 *
 * Catatan perilaku: store di memori proses, jadi restart proses menghapus grant
 * dan panggilan berikutnya ditolak sampai klien disambungkan ulang (fail
 * closed). Ini hanya berlaku di harness (`MCP_SPIKE_ENABLED=true`).
 */

export type SpikeGrantKey = {
  userId: string;
  clientId: string;
  workspaceId: string;
};

export type SpikeGrant = SpikeGrantKey & {
  scopes: string[];
  revokedAt: Date | null;
};

export interface SpikeGrantStore {
  /** Buat grant baru, atau ganti scope grant aktif yang sama (re-consent). */
  upsertActive(grant: SpikeGrantKey & { scopes: string[] }): Promise<void>;
  findActive(key: SpikeGrantKey): Promise<SpikeGrant | null>;
  /** Idempoten: tidak error bila grant tidak ada. */
  revoke(key: SpikeGrantKey): Promise<void>;
}

function keyOf(key: SpikeGrantKey): string {
  return JSON.stringify([key.userId, key.clientId, key.workspaceId]);
}

export function createInMemorySpikeGrantStore(): SpikeGrantStore & {
  all(): SpikeGrant[];
} {
  const grants = new Map<string, SpikeGrant>();

  return {
    async upsertActive(grant) {
      grants.set(keyOf(grant), {
        userId: grant.userId,
        clientId: grant.clientId,
        workspaceId: grant.workspaceId,
        scopes: [...grant.scopes],
        revokedAt: null,
      });
    },
    async findActive(key) {
      const grant = grants.get(keyOf(key));
      return grant && grant.revokedAt === null ? grant : null;
    },
    async revoke(key) {
      const grant = grants.get(keyOf(key));
      if (grant) {
        grants.set(keyOf(key), { ...grant, revokedAt: new Date() });
      }
    },
    all() {
      return [...grants.values()];
    },
  };
}

const globalForStore = globalThis as unknown as {
  __mcpSpikeGrantStore?: SpikeGrantStore;
};

/** Singleton harness; hidup di `globalThis` supaya selamat dari HMR. */
export function getSpikeGrantStore(): SpikeGrantStore {
  return (globalForStore.__mcpSpikeGrantStore ??=
    createInMemorySpikeGrantStore());
}
