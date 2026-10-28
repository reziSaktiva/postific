import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";
import type { McpConnectionKey, McpGrant } from "../entities/mcp-grant";
import type { McpScope } from "../value-objects/mcp-scope";

/**
 * Repository interface — implementation (Prisma) lives in
 * src/lib/repositories/mcp-access (T-149.6).
 *
 * Tabel `mcp_grants` tidak punya safety net RLS per pengguna/workspace
 * (ADR-141): SETIAP query implementasi wajib memfilter pada kolom kunci yang
 * diterimanya, bukan hanya `id`. Itu sebabnya `findById` menerima `userId`
 * dan `touchLastUsed` menerima kunci koneksi lengkap; sebuah `id` saja tidak
 * pernah cukup untuk membaca atau menyentuh baris.
 */
export interface IMcpGrantRepository {
  /**
   * Satu grant (aktif maupun dicabut) menurut id DAN pemiliknya
   * (`WHERE id = ? AND user_id = ?`); `null` bila tidak ada atau milik
   * pengguna lain (tidak dibedakan, supaya keberadaan grant orang lain tidak
   * bocor). `workspaceId` tidak diterima: pemanggil (`revokeGrant`) hanya
   * tahu id grant dan pengguna yang bertindak.
   */
  findById(id: McpGrantId, userId: UserId): Promise<McpGrant | null>;

  /**
   * Grant AKTIF (`revoked_at IS NULL`) untuk satu koneksi; `null` bila tidak
   * ada. Grant yang dicabut tidak pernah dikembalikan.
   */
  findActiveByConnection(key: McpConnectionKey): Promise<McpGrant | null>;

  /**
   * Semua grant AKTIF milik `userId` lintas workspace, urut `created_at`
   * descending. Hanya milik `userId`; tidak ada varian lintas pengguna.
   */
  listActiveByUser(userId: UserId): Promise<McpGrant[]>;

  /**
   * Upsert grant aktif untuk satu koneksi, atomik terhadap indeks unik
   * parsial `(user_id, client_id, workspace_id) WHERE revoked_at IS NULL`
   * (Prisma tidak bisa menyatakannya: implementasi memakai SQL mentah
   * `INSERT ... ON CONFLICT (...) WHERE revoked_at IS NULL DO UPDATE`).
   *
   * - Tidak ada grant aktif: sisipkan baris baru (`created_at = createdAt`,
   *   `last_used_at` dan `revoked_at` kosong).
   * - Ada grant aktif: perbarui `scopes` ke nilai terbaru (bisa menyempit
   *   atau melebar) dan `client_name` hanya bila `clientName` tidak kosong;
   *   `id`, `created_at`, dan `last_used_at` tidak berubah.
   *
   * Mengembalikan baris hasil. Tidak pernah menyentuh grant yang dicabut.
   */
  upsertActive(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    clientId: string;
    clientName: string | null;
    scopes: McpScope[];
    createdAt: Date;
  }): Promise<McpGrant>;

  /**
   * Set `last_used_at = usedAt` pada grant yang MASIH aktif dan cocok dengan
   * kunci koneksinya (`WHERE id = ? AND user_id = ? AND client_id = ? AND
   * workspace_id = ? AND revoked_at IS NULL`). Tidak error bila grant sudah
   * dicabut atau kunci tidak cocok (0 baris, no-op). Throttle satu menit
   * dilakukan service, bukan di sini.
   */
  touchLastUsed(
    id: McpGrantId,
    key: McpConnectionKey,
    usedAt: Date,
  ): Promise<void>;
}
