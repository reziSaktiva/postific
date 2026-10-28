import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";

/**
 * Port pencabutan grant yang transaksional (BC-04, `application-layer.md` §
 * Aturan otorisasi dan pencabutan). Dipisah dari `IMcpGrantRepository`
 * karena transaksinya menyentuh tabel milik plugin OAuth Better Auth
 * (`identity_oauth_consent`, `identity_oauth_refresh_token`) selain
 * `mcp_grants`, dan repository grant hanya boleh tahu tabel `mcp_*`.
 * Adapter Prisma di src/lib/repositories/mcp-access (T-149.6); domain tidak
 * mengimpor Prisma.
 */
export interface McpGrantRevocationInput {
  grantId: McpGrantId;
  /** Kunci koneksi grant; dipakai adapter untuk menemukan baris plugin. */
  userId: UserId;
  clientId: string;
  /** Sama dengan `referenceId` consent plugin (kolom `text` di tabel plugin). */
  workspaceId: WorkspaceId;
  revokedAt: Date;
}

export interface McpGrantRevocationResult {
  /**
   * `true` bila panggilan ini yang menandai grant dicabut; `false` bila
   * grant sudah dicabut (atau tidak ada) sebelum transaksi berjalan.
   */
  revoked: boolean;
}

export interface IMcpGrantRevocationPort {
  /**
   * SATU transaksi database yang melakukan, berurutan:
   *
   * 1. `UPDATE mcp_grants SET revoked_at = revokedAt WHERE id = grantId AND
   *    user_id = userId AND client_id = clientId AND workspace_id =
   *    workspaceId AND revoked_at IS NULL` (tabel tanpa RLS per pengguna,
   *    ADR-141: id saja tidak cukup).
   * 2. Hanya bila langkah 1 mengubah satu baris: `DELETE` baris
   *    `identity_oauth_consent` dan `identity_oauth_refresh_token` milik
   *    (`clientId`, `userId`, `referenceId = workspaceId`).
   *
   * Gagal di langkah mana pun membatalkan semuanya (tidak boleh ada grant
   * yang dicabut tapi consent/refresh token tersisa, atau sebaliknya).
   * Idempoten: bila grant sudah dicabut, langkah 2 TIDAK dijalankan dan
   * hasilnya `{ revoked: false }`; ini mencegah panggilan basi menghapus
   * consent milik koneksi baru yang dibuat setelah pencabutan.
   *
   * Access token yang masih berlaku tidak perlu ikut diurus: ia ditolak pada
   * panggilan berikutnya karena grant tidak lagi aktif (`authorizeCall`).
   */
  revokeAtomically(
    input: McpGrantRevocationInput,
  ): Promise<McpGrantRevocationResult>;
}
