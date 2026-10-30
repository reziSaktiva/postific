import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";
import type { McpScope } from "../value-objects/mcp-scope";

/**
 * `McpGrant` (BC-04, Aggregate Root) — izin yang diberikan satu pengguna
 * kepada satu klien AI untuk SATU workspace. Sumber otorisasi panggilan MCP
 * (keputusan King Rezi 2026-10-26; aturan di `application-layer.md` §
 * McpAccessService). Kolom final di `database-strategy.md` § BC-04.
 *
 * Invarian: paling banyak satu grant aktif (`revokedAt === null`) per
 * (`userId`, `clientId`, `workspaceId`) — ditegakkan indeks unik parsial di
 * DB dan upsert di repository. Grant yang dicabut tetap disimpan sebagai
 * riwayat dan tidak pernah aktif lagi; menyambung ulang membuat baris baru.
 */
export interface McpGrant {
  id: McpGrantId;
  workspaceId: WorkspaceId;
  /** Pengguna yang menyambungkan; keanggotaannya di workspace yang berlaku. */
  userId: UserId;
  /** `clientId` klien AI hasil dynamic client registration. */
  clientId: string;
  /** Salinan nama klien saat persetujuan (untuk layar daftar klien AI). */
  clientName: string | null;
  /** Nama logis, urut kanonikal (`normalizeMcpScopes`). */
  scopes: McpScope[];
  createdAt: Date;
  /** Panggilan terakhir yang lolos otorisasi (granularitas satu menit). */
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/** Kunci identitas sebuah koneksi: (pengguna, klien, workspace). */
export interface McpConnectionKey {
  userId: UserId;
  clientId: string;
  workspaceId: WorkspaceId;
}

export function isMcpGrantActive(grant: Pick<McpGrant, "revokedAt">): boolean {
  return grant.revokedAt === null;
}

/**
 * Pertahanan berlapis: tabel BC-04 tidak punya safety net RLS per pengguna
 * atau workspace (ADR-141), jadi service memastikan sendiri bahwa baris yang
 * dikembalikan repository memang milik koneksi yang diminta.
 */
export function grantMatchesConnection(
  grant: Pick<McpGrant, "userId" | "clientId" | "workspaceId">,
  key: McpConnectionKey,
): boolean {
  return (
    grant.userId === key.userId &&
    grant.clientId === key.clientId &&
    grant.workspaceId === key.workspaceId
  );
}
