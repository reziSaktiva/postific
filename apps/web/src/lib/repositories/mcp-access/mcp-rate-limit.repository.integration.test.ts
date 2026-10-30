import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { WorkspaceId } from "@postific/shared";
import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * T-154 — Tes integrasi `mcpRateLimitRepository` di Postgres sungguhan:
 * atomisitas `INSERT ... ON CONFLICT DO UPDATE ... WHERE count + n <= limit`
 * di bawah konkurensi nyata (banyak koneksi pool), dan purge. Tidak bisa
 * dimock (yang diuji adalah semantik SQL).
 *
 * Opt-in ganda: butuh `DATABASE_URL` sungguhan DAN `MCP_RATE_LIMIT_DB_TEST=1`.
 * Tabel `mcp_rate_limit_windows` baru ada setelah migrasi
 * `20261030110000_t154_mcp_rate_limit_windows` diterapkan; `DATABASE_URL` lokal
 * sering menunjuk DB bersama yang belum bermigrasi, jadi tes ini tidak jalan
 * otomatis. Data uji (satu workspace) dihapus di akhir; FK cascade menghapus
 * baris penghitungnya.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.MCP_RATE_LIMIT_DB_TEST === "1";

describe.skipIf(!enabled)("mcpRateLimitRepository (Postgres, T-154)", () => {
  const suffix = randomUUID().slice(0, 8);
  let prisma: typeof prismaClient;
  let workspaceId: string | null = null;

  afterAll(async () => {
    if (workspaceId && prisma) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    }
  });

  it("allows exactly `limit` of many concurrent consumes, never more, and purges expired windows", async () => {
    ({ prisma } = await import("@/lib/prisma/client"));
    const { mcpRateLimitRepository } =
      await import("./mcp-rate-limit.repository");

    const workspace = await prisma.workspace.create({
      data: {
        name: `T-154 Rate Limit Test ${suffix}`,
        slug: `t154-rate-limit-test-${suffix}`,
        ownerId: `t154-test-owner-${suffix}`,
      },
    });
    workspaceId = workspace.id;

    const windowStart = new Date("2026-10-30T10:00:00.000Z");
    const windowEnd = new Date("2026-10-30T10:01:00.000Z");
    const limit = 10;
    const consume = () =>
      mcpRateLimitRepository.consume({
        workspaceId: workspace.id as WorkspaceId,
        quota: "calls",
        windowStart,
        windowEnd,
        amount: 1,
        limit,
      });

    const results = await Promise.all(Array.from({ length: 60 }, consume));
    expect(results.filter((r) => r.allowed)).toHaveLength(limit);

    // Penghitung berhenti tepat di batas dan penolakan tidak menaikkannya.
    const rows = await prisma.mcpRateLimitWindow.findMany({
      where: { workspaceId: workspace.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(limit);

    // Batch yang tidak muat ditolak utuh (all-or-nothing).
    const batch = await mcpRateLimitRepository.consume({
      workspaceId: workspace.id as WorkspaceId,
      quota: "scheduled_contents",
      windowStart: new Date("2026-10-30T00:00:00.000Z"),
      windowEnd: new Date("2026-10-31T00:00:00.000Z"),
      amount: 51,
      limit: 50,
    });
    expect(batch.allowed).toBe(false);
    expect(
      await prisma.mcpRateLimitWindow.count({
        where: { workspaceId: workspace.id, quota: "scheduled_contents" },
      }),
    ).toBe(0);

    // Purge: jendela yang sudah berakhir dihapus, idempoten.
    const deleted = await mcpRateLimitRepository.deleteExpired(
      new Date("2026-10-30T10:02:00.000Z"),
    );
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.mcpRateLimitWindow.count({
        where: { workspaceId: workspace.id },
      }),
    ).toBe(0);
  });
});

describe.skipIf(enabled)("mcpRateLimitRepository (Postgres, T-154)", () => {
  it("skipped: needs a real DATABASE_URL with the T-154 migration applied and MCP_RATE_LIMIT_DB_TEST=1", () => {
    expect(true).toBe(true);
  });
});
