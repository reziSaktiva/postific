import { asMcpGrantId, asUserId, asWorkspaceId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import {
  McpInvalidRateLimitInputError,
  McpRateLimitExceededError,
} from "../errors";
import type {
  IMcpRateLimitRepository,
  McpRateLimitConsumeInput,
  McpRateLimitConsumeResult,
} from "../repositories/mcp-rate-limit.repository";
import type { McpRateLimitContext } from "../types";
import {
  MCP_QUOTA_WINDOW_SECONDS,
  quotaWindowAt,
  type McpRateLimitConfig,
} from "../value-objects/rate-limit";
import { McpRateLimitService } from "./mcp-rate-limit.service";

const WS_A = asWorkspaceId("ws-a");
const WS_B = asWorkspaceId("ws-b");
const GRANT = asMcpGrantId("grant-1");

/** 2026-10-30 10:00:00 UTC, tepat pada awal menit, jam, dan 10 jam setelah awal hari. */
const T0 = new Date("2026-10-30T10:00:00.000Z");

const CONFIG: McpRateLimitConfig = {
  calls: 60,
  write_actions: 30,
  scheduled_contents: 50,
};

interface Row {
  expiresAt: Date;
  count: number;
}

/**
 * Repository in-memory dengan semantik kontrak yang sama dengan SQL: kenaikan
 * bersyarat, all-or-nothing, tanpa menaikkan saat ditolak. Operasi `consume`
 * bersifat sinkron di dalam satu putaran event loop (setara satu statement
 * atomik di Postgres), tetapi dibuat async dengan `await` di depan supaya
 * banyak pemanggil benar-benar berselang-seling.
 */
class FakeRateLimitRepository implements IMcpRateLimitRepository {
  rows = new Map<string, Row>();
  calls: McpRateLimitConsumeInput[] = [];

  private key(input: McpRateLimitConsumeInput) {
    return `${input.workspaceId}|${input.quota}|${input.windowStart.toISOString()}`;
  }

  async consume(
    input: McpRateLimitConsumeInput,
  ): Promise<McpRateLimitConsumeResult> {
    await Promise.resolve();
    this.calls.push(input);
    if (input.amount > input.limit) {
      return { allowed: false };
    }
    const key = this.key(input);
    const row = this.rows.get(key);
    if (!row) {
      this.rows.set(key, { expiresAt: input.windowEnd, count: input.amount });
      return { allowed: true, used: input.amount };
    }
    if (row.count + input.amount > input.limit) {
      return { allowed: false };
    }
    row.count += input.amount;
    return { allowed: true, used: row.count };
  }

  async deleteExpired(before: Date): Promise<number> {
    let deleted = 0;
    for (const [key, row] of this.rows) {
      if (row.expiresAt < before) {
        this.rows.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  count(workspaceId: string, quota: string): number {
    let total = 0;
    for (const [key, row] of this.rows) {
      if (key.startsWith(`${workspaceId}|${quota}|`)) {
        total += row.count;
      }
    }
    return total;
  }
}

function createService(
  options: { config?: McpRateLimitConfig; start?: Date } = {},
) {
  const repo = new FakeRateLimitRepository();
  let now = options.start ?? T0;
  const service = new McpRateLimitService(
    repo,
    options.config ?? CONFIG,
    () => now,
  );
  return {
    repo,
    service,
    setNow: (date: Date) => {
      now = date;
    },
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

function ctx(
  overrides: Partial<McpRateLimitContext> = {},
): McpRateLimitContext {
  return {
    workspaceId: WS_A,
    userId: asUserId("user-1"),
    clientId: "client-1",
    grantId: GRANT,
    requiredScope: "read",
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected promise to reject");
}

describe("quotaWindowAt", () => {
  it("aligns windows to multiples of the window length since epoch (UTC)", () => {
    const at = new Date("2026-10-30T10:07:31.250Z");
    expect(quotaWindowAt("calls", at)).toEqual({
      start: new Date("2026-10-30T10:07:00.000Z"),
      end: new Date("2026-10-30T10:08:00.000Z"),
    });
    expect(quotaWindowAt("write_actions", at)).toEqual({
      start: new Date("2026-10-30T10:00:00.000Z"),
      end: new Date("2026-10-30T11:00:00.000Z"),
    });
    expect(quotaWindowAt("scheduled_contents", at)).toEqual({
      start: new Date("2026-10-30T00:00:00.000Z"),
      end: new Date("2026-10-31T00:00:00.000Z"),
    });
  });

  it("treats the exact window boundary as the start of the next window", () => {
    const boundary = new Date("2026-10-30T10:01:00.000Z");
    expect(quotaWindowAt("calls", boundary).start).toEqual(boundary);
  });

  it("fixes the window lengths at per-minute, per-hour, per-day", () => {
    expect(MCP_QUOTA_WINDOW_SECONDS).toEqual({
      calls: 60,
      write_actions: 3600,
      scheduled_contents: 86_400,
    });
  });
});

describe("McpRateLimitService config", () => {
  it.each([0, -1, 1.5, Number.NaN])(
    "rejects non-positive-integer limit %s",
    (bad) => {
      expect(
        () =>
          new McpRateLimitService(new FakeRateLimitRepository(), {
            ...CONFIG,
            calls: bad,
          }),
      ).toThrow(/calls/);
    },
  );
});

describe("McpRateLimitService.assertWithinLimit", () => {
  it("allows exactly `limit` calls per minute and rejects the next with retryAfter", async () => {
    const { service, advance } = createService();
    for (let i = 0; i < 60; i += 1) {
      await service.assertWithinLimit(ctx());
    }
    advance(20_000); // 20 detik berlalu di menit yang sama

    const error = await rejection(service.assertWithinLimit(ctx()));
    expect(error).toBeInstanceOf(McpRateLimitExceededError);
    expect(error).toMatchObject({
      quota: "calls",
      limit: 60,
      retryAfterSeconds: 40,
      grantId: GRANT,
      code: "rate_limited",
    });
    expect((error as Error).message).toContain("60 per menit");
    expect((error as Error).message).toContain("40 detik");
  });

  it("resets when the next window starts", async () => {
    const { service, setNow } = createService();
    for (let i = 0; i < 60; i += 1) {
      await service.assertWithinLimit(ctx());
    }
    await expect(service.assertWithinLimit(ctx())).rejects.toBeInstanceOf(
      McpRateLimitExceededError,
    );

    setNow(new Date("2026-10-30T10:01:00.000Z"));
    await expect(service.assertWithinLimit(ctx())).resolves.toBeUndefined();
  });

  it("reports retryAfter of at least 1 second right before the boundary and the full window at its start", async () => {
    const { service, setNow } = createService({
      config: { ...CONFIG, calls: 1 },
    });
    setNow(new Date("2026-10-30T10:00:59.999Z"));
    await service.assertWithinLimit(ctx());
    const nearEnd = await rejection(service.assertWithinLimit(ctx()));
    expect(nearEnd).toMatchObject({ retryAfterSeconds: 1 });

    setNow(new Date("2026-10-30T10:01:00.000Z"));
    await service.assertWithinLimit(ctx());
    const atStart = await rejection(service.assertWithinLimit(ctx()));
    expect(atStart).toMatchObject({ retryAfterSeconds: 60 });
  });

  it("does not count rejected attempts, so waiting for the next window is enough", async () => {
    const { service, repo } = createService({
      config: { ...CONFIG, calls: 2 },
    });
    await service.assertWithinLimit(ctx());
    await service.assertWithinLimit(ctx());
    for (let i = 0; i < 5; i += 1) {
      await expect(service.assertWithinLimit(ctx())).rejects.toBeInstanceOf(
        McpRateLimitExceededError,
      );
    }
    expect(repo.count(WS_A, "calls")).toBe(2);
  });

  it("counts only `calls` for read tools", async () => {
    const { service, repo } = createService();
    await service.assertWithinLimit(ctx({ requiredScope: "read" }));
    expect(repo.count(WS_A, "calls")).toBe(1);
    expect(repo.count(WS_A, "write_actions")).toBe(0);
  });

  it.each(["draft", "schedule"] as const)(
    "counts a write action for %s tools in addition to the call",
    async (requiredScope) => {
      const { service, repo } = createService();
      await service.assertWithinLimit(ctx({ requiredScope }));
      expect(repo.count(WS_A, "calls")).toBe(1);
      expect(repo.count(WS_A, "write_actions")).toBe(1);
    },
  );

  it("limits write actions per hour independently of the per-minute call limit", async () => {
    const { service, advance } = createService();
    // 30 aksi tulis tersebar satu per menit: tidak pernah menyentuh 60 panggilan/menit.
    for (let i = 0; i < 30; i += 1) {
      await service.assertWithinLimit(ctx({ requiredScope: "draft" }));
      advance(60_000);
    }
    // Menit ke-31 masih di jam yang sama (10:30): panggilan baca lolos, tulis ditolak.
    await expect(
      service.assertWithinLimit(ctx({ requiredScope: "read" })),
    ).resolves.toBeUndefined();
    const error = await rejection(
      service.assertWithinLimit(ctx({ requiredScope: "schedule" })),
    );
    expect(error).toBeInstanceOf(McpRateLimitExceededError);
    expect(error).toMatchObject({
      quota: "write_actions",
      limit: 30,
      retryAfterSeconds: 30 * 60, // 10:30:00 -> 11:00:00
    });
    expect((error as Error).message).toContain("30 per jam");
  });

  it("does not consume the write quota when the call quota rejects first", async () => {
    const { service, repo } = createService({
      config: { ...CONFIG, calls: 1 },
    });
    await service.assertWithinLimit(ctx({ requiredScope: "draft" }));
    await expect(
      service.assertWithinLimit(ctx({ requiredScope: "draft" })),
    ).rejects.toMatchObject({ quota: "calls" });
    expect(repo.count(WS_A, "write_actions")).toBe(1);
  });

  it("keeps a call counted when the write quota rejects (the call did happen)", async () => {
    const { service, repo } = createService({
      config: { ...CONFIG, write_actions: 1 },
    });
    await service.assertWithinLimit(ctx({ requiredScope: "draft" }));
    await expect(
      service.assertWithinLimit(ctx({ requiredScope: "draft" })),
    ).rejects.toMatchObject({ quota: "write_actions" });
    expect(repo.count(WS_A, "calls")).toBe(2);
  });

  it("isolates workspaces: one workspace hitting the limit does not affect another", async () => {
    const { service } = createService({ config: { ...CONFIG, calls: 2 } });
    await service.assertWithinLimit(ctx({ workspaceId: WS_A }));
    await service.assertWithinLimit(ctx({ workspaceId: WS_A }));
    await expect(
      service.assertWithinLimit(ctx({ workspaceId: WS_A })),
    ).rejects.toBeInstanceOf(McpRateLimitExceededError);

    await expect(
      service.assertWithinLimit(ctx({ workspaceId: WS_B })),
    ).resolves.toBeUndefined();
  });

  it("shares the quota across users and clients of the same workspace", async () => {
    const { service } = createService({ config: { ...CONFIG, calls: 2 } });
    await service.assertWithinLimit(ctx({ clientId: "client-1" }));
    await service.assertWithinLimit(
      ctx({ clientId: "client-2", userId: asUserId("user-2") }),
    );
    await expect(
      service.assertWithinLimit(ctx({ clientId: "client-3" })),
    ).rejects.toBeInstanceOf(McpRateLimitExceededError);
  });

  it("uses limits from the injected config, not hardcoded numbers", async () => {
    const { service } = createService({
      config: { calls: 3, write_actions: 2, scheduled_contents: 5 },
    });
    for (let i = 0; i < 3; i += 1) {
      await service.assertWithinLimit(ctx());
    }
    await expect(service.assertWithinLimit(ctx())).rejects.toMatchObject({
      limit: 3,
    });
  });

  it("logically concurrent calls never exceed the limit (atomic consume)", async () => {
    const { service, repo } = createService({
      config: { ...CONFIG, calls: 10 },
    });
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () => service.assertWithinLimit(ctx())),
    );
    const allowed = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected");

    expect(allowed).toBe(10);
    expect(rejected).toHaveLength(90);
    expect(repo.count(WS_A, "calls")).toBe(10);
  });

  it("propagates repository failures (fail closed, caller decides)", async () => {
    const failing: IMcpRateLimitRepository = {
      consume: async () => {
        throw new Error("db down");
      },
      deleteExpired: async () => 0,
    };
    const service = new McpRateLimitService(failing, CONFIG, () => T0);
    await expect(service.assertWithinLimit(ctx())).rejects.toThrow("db down");
  });
});

describe("McpRateLimitService.consumeQuota (API for T-153)", () => {
  it("consumes scheduled contents per content and rejects past 50 per day with time until reset", async () => {
    const { service, advance } = createService();
    await service.consumeQuota(WS_A, "scheduled_contents", 10);
    await service.consumeQuota(WS_A, "scheduled_contents", 10);
    await service.consumeQuota(WS_A, "scheduled_contents", 10);
    await service.consumeQuota(WS_A, "scheduled_contents", 10);
    await service.consumeQuota(WS_A, "scheduled_contents", 10);
    advance(60_000);

    const error = await rejection(
      service.consumeQuota(WS_A, "scheduled_contents", 1),
    );
    expect(error).toBeInstanceOf(McpRateLimitExceededError);
    expect(error).toMatchObject({
      quota: "scheduled_contents",
      limit: 50,
      retryAfterSeconds: 14 * 3600 - 60,
      grantId: null,
    });
    expect((error as Error).message).toContain("50 per hari");
  });

  it("is all-or-nothing: a batch that does not fit consumes nothing", async () => {
    const { service, repo } = createService();
    await service.consumeQuota(WS_A, "scheduled_contents", 45);
    await expect(
      service.consumeQuota(WS_A, "scheduled_contents", 10),
    ).rejects.toBeInstanceOf(McpRateLimitExceededError);
    expect(repo.count(WS_A, "scheduled_contents")).toBe(45);

    await expect(
      service.consumeQuota(WS_A, "scheduled_contents", 5),
    ).resolves.toBeUndefined();
    expect(repo.count(WS_A, "scheduled_contents")).toBe(50);
  });

  it("defaults to a single unit", async () => {
    const { service, repo } = createService();
    await service.consumeQuota(WS_A, "write_actions");
    expect(repo.count(WS_A, "write_actions")).toBe(1);
  });

  it("resets scheduled-content quota at the next UTC day", async () => {
    const { service, setNow } = createService();
    await service.consumeQuota(WS_A, "scheduled_contents", 50);
    await expect(
      service.consumeQuota(WS_A, "scheduled_contents"),
    ).rejects.toBeInstanceOf(McpRateLimitExceededError);

    setNow(new Date("2026-10-31T00:00:00.000Z"));
    await expect(
      service.consumeQuota(WS_A, "scheduled_contents", 50),
    ).resolves.toBeUndefined();
  });

  it.each([0, -3, 1.5, Number.NaN])(
    "rejects invalid amount %s",
    async (amount) => {
      const { service, repo } = createService();
      await expect(
        service.consumeQuota(WS_A, "scheduled_contents", amount),
      ).rejects.toBeInstanceOf(McpInvalidRateLimitInputError);
      expect(repo.calls).toHaveLength(0);
    },
  );

  it("rejects an amount larger than the whole limit as invalid input, not as a wait-and-retry", async () => {
    const { service, repo } = createService();
    await expect(
      service.consumeQuota(WS_A, "scheduled_contents", 51),
    ).rejects.toBeInstanceOf(McpInvalidRateLimitInputError);
    expect(repo.calls).toHaveLength(0);
  });

  it("concurrent batches never exceed the daily limit", async () => {
    const { service, repo } = createService();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        service.consumeQuota(WS_A, "scheduled_contents", 10),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(repo.count(WS_A, "scheduled_contents")).toBe(50);
  });
});

describe("McpRateLimitService.purgeExpired", () => {
  it("deletes only windows that already ended, and is idempotent", async () => {
    const { service, repo, setNow } = createService();
    await service.assertWithinLimit(ctx({ requiredScope: "draft" }));
    await service.consumeQuota(WS_A, "scheduled_contents", 1);
    expect(repo.rows.size).toBe(3);

    // 10:00:30: belum ada jendela yang berakhir.
    setNow(new Date("2026-10-30T10:00:30.000Z"));
    await expect(service.purgeExpired()).resolves.toBe(0);

    // 11:00:00 tepat: jendela menit dan jam berakhir (expires_at < now: jam belum, tepat batas).
    setNow(new Date("2026-10-30T11:00:01.000Z"));
    await expect(service.purgeExpired()).resolves.toBe(2);
    expect(repo.rows.size).toBe(1);
    await expect(service.purgeExpired()).resolves.toBe(0);

    setNow(new Date("2026-10-31T00:00:01.000Z"));
    await expect(service.purgeExpired()).resolves.toBe(1);
    expect(repo.rows.size).toBe(0);
  });
});
