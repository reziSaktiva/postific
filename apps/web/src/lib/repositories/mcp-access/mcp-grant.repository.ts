import type { IMcpGrantRepository } from "@/domains/mcp-access";
import { prisma } from "@/lib/prisma/client";
import { toMcpGrant, type McpGrantRow } from "./mappers";

/**
 * Baris hasil `INSERT ... RETURNING` mentah: kolom snake_case apa adanya
 * (`$queryRaw` tidak memakai `@map` Prisma).
 */
interface McpGrantRawRow {
  id: string;
  workspace_id: string;
  user_id: string;
  client_id: string;
  client_name: string | null;
  scopes: string[];
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

function rawToRow(row: McpGrantRawRow): McpGrantRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    clientId: row.client_id,
    clientName: row.client_name,
    scopes: row.scopes,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

/**
 * Repository `mcp_grants` (BC-04, T-149.6).
 *
 * Tabel ini RLS-nya hanya policy `app_runtime` `USING (true)` (ADR-141):
 * TIDAK ada safety net isolasi per pengguna/workspace di level DB, dan klien
 * Prisma runtime berjalan sebagai role `app_runtime` (jadi policy itu yang
 * mengizinkan tulis). Karena itu SETIAP query di sini memfilter kolom kunci
 * yang diterimanya (`user_id`, `client_id`, `workspace_id`), bukan hanya
 * `id` (`findById` memfilter `id` + `user_id`; `touchLastUsed` memfilter
 * `id` + ketiga kunci koneksi), dan tidak memakai `withCurrentUser` (token OAuth tidak membawa
 * `app.current_user_id`).
 */
export const mcpGrantRepository: IMcpGrantRepository = {
  async findById(id, userId) {
    const row = await prisma.mcpGrant.findFirst({ where: { id, userId } });
    return row ? toMcpGrant(row) : null;
  },

  async findActiveByConnection({ userId, clientId, workspaceId }) {
    const row = await prisma.mcpGrant.findFirst({
      where: { userId, clientId, workspaceId, revokedAt: null },
    });
    return row ? toMcpGrant(row) : null;
  },

  async listActiveByUser(userId) {
    const rows = await prisma.mcpGrant.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toMcpGrant);
  },

  /**
   * SQL mentah: Prisma `upsert` tidak bisa memakai indeks unik PARSIAL
   * `mcp_grants_active_user_client_workspace_key (user_id, client_id,
   * workspace_id) WHERE revoked_at IS NULL`. `ON CONFLICT` dengan predikat
   * indeks yang sama membuat upsert atomik tanpa baca-lalu-tulis:
   *
   * - Tidak ada grant aktif -> baris baru (id dari `gen_random_uuid()`,
   *   `last_used_at` dan `revoked_at` NULL).
   * - Ada grant aktif -> HANYA `scopes` diganti dan `client_name` diganti
   *   bila input tidak NULL (`COALESCE`); `id`, `created_at`, `last_used_at`
   *   tidak disentuh. Grant yang dicabut tidak masuk predikat indeks, jadi
   *   tidak pernah terpengaruh (menyambung ulang menyisipkan baris baru).
   *
   * Cast eksplisit (`::uuid`, `::text[]`, `::timestamptz`) supaya tipe
   * parameter tidak bergantung pada inferensi driver, termasuk untuk NULL.
   */
  async upsertActive({
    workspaceId,
    userId,
    clientId,
    clientName,
    scopes,
    createdAt,
  }) {
    const rows = await prisma.$queryRaw<McpGrantRawRow[]>`
      INSERT INTO "mcp_grants"
        ("workspace_id", "user_id", "client_id", "client_name", "scopes", "created_at")
      VALUES
        (${workspaceId}::uuid, ${userId}, ${clientId}, ${clientName}::text,
         ${scopes}::text[], ${createdAt}::timestamptz)
      ON CONFLICT ("user_id", "client_id", "workspace_id") WHERE "revoked_at" IS NULL
      DO UPDATE SET
        "scopes" = EXCLUDED."scopes",
        "client_name" = COALESCE(EXCLUDED."client_name", "mcp_grants"."client_name")
      RETURNING "id", "workspace_id", "user_id", "client_id", "client_name",
                "scopes", "created_at", "last_used_at", "revoked_at"
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("mcp_grants upsert tidak mengembalikan baris");
    }
    return toMcpGrant(rawToRow(row));
  },

  /**
   * `updateMany` supaya grant yang sudah dicabut, hilang, atau tidak cocok
   * dengan kunci koneksi bukan error: 0 baris cocok, no-op.
   */
  async touchLastUsed(id, { userId, clientId, workspaceId }, usedAt) {
    await prisma.mcpGrant.updateMany({
      where: { id, userId, clientId, workspaceId, revokedAt: null },
      data: { lastUsedAt: usedAt },
    });
  },

  async findClientNames(workspaceId, clientIds) {
    const names = new Map<string, string>();
    if (clientIds.length === 0) {
      return names;
    }
    const rows = await prisma.mcpGrant.findMany({
      where: {
        workspaceId,
        clientId: { in: clientIds },
        clientName: { not: null },
      },
      // distinct + orderBy: satu baris terbaru per clientId, tanpa memuat semua grant.
      distinct: ["clientId"],
      orderBy: { createdAt: "desc" },
      select: { clientId: true, clientName: true },
    });
    for (const row of rows) {
      // Urut terbaru dulu: entri pertama per clientId menang.
      if (row.clientName && !names.has(row.clientId)) {
        names.set(row.clientId, row.clientName);
      }
    }
    return names;
  },
};
