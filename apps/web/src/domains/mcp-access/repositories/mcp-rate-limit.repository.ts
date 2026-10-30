import type { WorkspaceId } from "@postific/shared";
import type { McpQuotaKind } from "../value-objects/rate-limit";

export interface McpRateLimitConsumeInput {
  workspaceId: WorkspaceId;
  quota: McpQuotaKind;
  /** Awal dan akhir jendela yang memuat waktu sekarang (`quotaWindowAt`). */
  windowStart: Date;
  windowEnd: Date;
  /** Jumlah yang diminta; bilangan bulat positif. */
  amount: number;
  /** Batas per jendela. */
  limit: number;
}

export type McpRateLimitConsumeResult =
  { allowed: true; used: number } | { allowed: false };

/**
 * Repository penghitung rate limit MCP (T-154). Implementasi Prisma di
 * `src/lib/repositories/mcp-access`.
 */
export interface IMcpRateLimitRepository {
  /**
   * Tambahkan `amount` ke penghitung (workspace, kuota, jendela) HANYA bila
   * hasilnya tidak melebihi `limit`, dalam satu operasi atomik: dua pemanggil
   * bersamaan (instance berbeda) tidak pernah bersama-sama melewati batas.
   * Permintaan yang ditolak TIDAK menaikkan penghitung (all-or-nothing).
   * `amount > limit` selalu ditolak.
   */
  consume(input: McpRateLimitConsumeInput): Promise<McpRateLimitConsumeResult>;

  /**
   * Hapus semua baris dengan `expires_at < before`, lintas workspace (JOB-08).
   * Mengembalikan jumlah baris terhapus; idempoten.
   */
  deleteExpired(before: Date): Promise<number>;
}
