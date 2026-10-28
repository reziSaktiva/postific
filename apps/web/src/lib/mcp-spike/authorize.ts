import type { JWTPayload } from "jose";
import { MemberStatus } from "@postific/shared";

import type { SpikeGrant, SpikeGrantKey } from "./grant-store";

/**
 * T-148/T-149.2 (spike MCP) — SEMENTARA. Gerbang otorisasi per panggilan,
 * dipisah dari `server.ts` supaya bisa diuji tanpa Prisma. Digantikan
 * `McpAccessService.authorizeCall` (T-149.5).
 */

export type SpikeClaims = {
  userId: string;
  workspaceId: string;
  clientId: string;
  scopes: string[];
};

export type SpikeAuthorizeDeps = {
  getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<{ status: string } | null>;
  /** Grant aktif (belum dicabut) untuk (pengguna, klien, workspace). */
  findActiveGrant(key: SpikeGrantKey): Promise<SpikeGrant | null>;
};

export function readClaims(jwt: JWTPayload): SpikeClaims | null {
  const userId = typeof jwt.sub === "string" ? jwt.sub : undefined;
  const clientId = typeof jwt.azp === "string" ? jwt.azp : undefined;
  const workspaceId =
    typeof jwt.workspace_id === "string" ? jwt.workspace_id : undefined;
  if (!userId || !clientId || !workspaceId) {
    return null;
  }
  const scopes = typeof jwt.scope === "string" ? jwt.scope.split(" ") : [];
  return { userId, workspaceId, clientId, scopes };
}

/**
 * Satu gerbang untuk semua tool: scope token, member aktif, dan GRANT di DB
 * (sumber otorisasi, bukan tabel consent plugin) yang masih aktif dan memuat
 * scope itu. Dijalankan di setiap panggilan. Mengembalikan pesan penolakan,
 * atau null bila lolos. Fail closed: tidak ada grant berarti ditolak, apa pun
 * isi token.
 */
export async function authorizeSpikeCall(
  deps: SpikeAuthorizeDeps,
  claims: SpikeClaims,
  requiredScope: string,
): Promise<string | null> {
  const denied = `Scope ${requiredScope} tidak diberikan.`;
  if (!claims.scopes.includes(requiredScope)) {
    return denied;
  }

  const [membership, grant] = await Promise.all([
    deps.getMembership(claims.workspaceId, claims.userId),
    deps.findActiveGrant({
      userId: claims.userId,
      clientId: claims.clientId,
      workspaceId: claims.workspaceId,
    }),
  ]);
  if (!membership || membership.status !== MemberStatus.Active) {
    return "Bukan member aktif workspace ini.";
  }
  if (!grant) {
    return "Akses klien ini sudah dicabut.";
  }
  return grant.scopes.includes(requiredScope) ? null : denied;
}
