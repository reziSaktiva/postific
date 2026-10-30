import type { McpGrantId, WorkspaceId } from "@postific/shared";
import {
  McpInvalidRateLimitInputError,
  McpRateLimitExceededError,
} from "../errors";
import type { IMcpRateLimitRepository } from "../repositories/mcp-rate-limit.repository";
import type { McpClock, McpRateLimitContext, McpRateLimiter } from "../types";
import {
  assertValidRateLimitConfig,
  quotaWindowAt,
  secondsUntilWindowEnd,
  type McpQuotaKind,
  type McpRateLimitConfig,
} from "../value-objects/rate-limit";

/**
 * Rate limit MCP per workspace (T-154, ADR-138 poin 7), berbasis Postgres.
 *
 * Fixed window per kuota; penghitung dinaikkan atomik oleh repository (satu
 * upsert bersyarat), jadi aman untuk banyak instance tanpa lock di aplikasi.
 * Batas datang dari konfigurasi yang diinjeksi (bukan konstanta di sini).
 *
 * Kuota dibagi seluruh pengguna dan klien dalam satu workspace. Permintaan
 * yang ditolak tidak menaikkan penghitung, jadi klien yang terus mencoba tidak
 * memperpanjang penguncian.
 */
export class McpRateLimitService implements McpRateLimiter {
  constructor(
    private readonly counters: IMcpRateLimitRepository,
    private readonly config: McpRateLimitConfig,
    private readonly clock: McpClock = () => new Date(),
  ) {
    assertValidRateLimitConfig(config);
  }

  /**
   * Hook `authorizeCall`, dipanggil setelah grant, scope, dan member lolos:
   * menghitung satu `calls`, dan satu `write_actions` bila tool butuh scope
   * selain `read` (`draft` atau `schedule`). Penolakan `calls` tidak
   * menyentuh `write_actions`. Penolakan `write_actions` tetap meninggalkan
   * hitungan `calls` karena panggilannya memang terjadi.
   */
  async assertWithinLimit(context: McpRateLimitContext): Promise<void> {
    await this.consume(context.workspaceId, "calls", 1, context.grantId);
    if (context.requiredScope !== "read") {
      await this.consume(
        context.workspaceId,
        "write_actions",
        1,
        context.grantId,
      );
    }
  }

  /** API kuota untuk tool (T-153): all-or-nothing, melempar bila melebihi batas. */
  async consumeQuota(
    workspaceId: WorkspaceId,
    quota: McpQuotaKind,
    amount = 1,
  ): Promise<void> {
    await this.consume(workspaceId, quota, amount, null);
  }

  async purgeExpired(): Promise<number> {
    return this.counters.deleteExpired(this.clock());
  }

  private async consume(
    workspaceId: WorkspaceId,
    quota: McpQuotaKind,
    amount: number,
    grantId: McpGrantId | null,
  ): Promise<void> {
    const limit = this.config[quota];
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new McpInvalidRateLimitInputError(
        "Jumlah kuota harus bilangan bulat positif",
      );
    }
    if (amount > limit) {
      throw new McpInvalidRateLimitInputError(
        `Permintaan ${amount} melebihi seluruh batas kuota "${quota}" (${limit})`,
      );
    }

    const now = this.clock();
    const window = quotaWindowAt(quota, now);
    const result = await this.counters.consume({
      workspaceId,
      quota,
      windowStart: window.start,
      windowEnd: window.end,
      amount,
      limit,
    });
    if (!result.allowed) {
      throw new McpRateLimitExceededError({
        quota,
        limit,
        retryAfterSeconds: secondsUntilWindowEnd(window, now),
        grantId,
      });
    }
  }
}
