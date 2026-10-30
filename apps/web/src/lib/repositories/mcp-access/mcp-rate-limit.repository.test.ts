import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceId } from "@postific/shared";

const { queryRaw, executeRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw },
}));

import {
  MCP_RATE_LIMIT_PURGE_BATCH_SIZE,
  MCP_RATE_LIMIT_PURGE_MAX_BATCHES,
  mcpRateLimitRepository,
} from "./mcp-rate-limit.repository";

const INPUT = {
  workspaceId: "11111111-1111-4111-8111-111111111111" as WorkspaceId,
  quota: "calls" as const,
  windowStart: new Date("2026-10-30T10:00:00.000Z"),
  windowEnd: new Date("2026-10-30T10:01:00.000Z"),
  amount: 1,
  limit: 60,
};

/** Gabungkan fragmen template SQL supaya kita bisa menegaskan bentuk statement. */
function sqlText(strings: TemplateStringsArray): string {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

describe("mcpRateLimitRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("consume()", () => {
    it("returns allowed with the new count when the conditional upsert returns a row", async () => {
      queryRaw.mockResolvedValue([{ count: 7 }]);

      await expect(mcpRateLimitRepository.consume(INPUT)).resolves.toEqual({
        allowed: true,
        used: 7,
      });
    });

    it("returns not allowed when no row is returned (limit would be exceeded)", async () => {
      queryRaw.mockResolvedValue([]);

      await expect(mcpRateLimitRepository.consume(INPUT)).resolves.toEqual({
        allowed: false,
      });
    });

    it("issues a single atomic INSERT ... ON CONFLICT DO UPDATE ... WHERE count + n <= limit", async () => {
      queryRaw.mockResolvedValue([{ count: 1 }]);

      await mcpRateLimitRepository.consume(INPUT);

      expect(queryRaw).toHaveBeenCalledTimes(1);
      const [strings, ...values] = queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const sql = sqlText(strings);
      expect(sql).toContain('INSERT INTO "mcp_rate_limit_windows"');
      expect(sql).toContain(
        'ON CONFLICT ("workspace_id", "quota", "window_start")',
      );
      expect(sql).toContain(
        'DO UPDATE SET "count" = w."count" + EXCLUDED."count"',
      );
      expect(sql).toMatch(/WHERE w\."count" \+ EXCLUDED\."count" <= \?::int/);
      expect(sql).toContain('RETURNING "count"');
      // Nilai dipasang sebagai parameter (bukan interpolasi string).
      expect(values).toEqual([
        INPUT.workspaceId,
        INPUT.quota,
        INPUT.windowStart,
        INPUT.windowEnd,
        INPUT.amount, // SELECT ... ::int
        INPUT.amount, // WHERE amount <= limit (permintaan lebih besar dari batas)
        INPUT.limit,
        INPUT.limit, // WHERE count + amount <= limit (cabang konflik)
      ]);
    });
  });

  describe("deleteExpired()", () => {
    const BEFORE = new Date("2026-10-31T00:00:00.000Z");

    it("deletes by expires_at and stops after a short batch", async () => {
      executeRaw.mockResolvedValue(12);

      await expect(mcpRateLimitRepository.deleteExpired(BEFORE)).resolves.toBe(
        12,
      );
      expect(executeRaw).toHaveBeenCalledTimes(1);
      const [strings, ...values] = executeRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(sqlText(strings)).toContain('"expires_at" < ?::timestamptz');
      expect(values).toEqual([BEFORE, MCP_RATE_LIMIT_PURGE_BATCH_SIZE]);
    });

    it("is idempotent: nothing expired deletes 0", async () => {
      executeRaw.mockResolvedValue(0);

      await expect(mcpRateLimitRepository.deleteExpired(BEFORE)).resolves.toBe(
        0,
      );
    });

    it("keeps deleting full batches and caps the number of batches per run", async () => {
      executeRaw.mockResolvedValue(MCP_RATE_LIMIT_PURGE_BATCH_SIZE);

      const total = await mcpRateLimitRepository.deleteExpired(BEFORE);

      expect(executeRaw).toHaveBeenCalledTimes(
        MCP_RATE_LIMIT_PURGE_MAX_BATCHES,
      );
      expect(total).toBe(
        MCP_RATE_LIMIT_PURGE_BATCH_SIZE * MCP_RATE_LIMIT_PURGE_MAX_BATCHES,
      );
    });
  });
});
