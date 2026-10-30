import {
  MemberStatus,
  asMcpAuditLogId,
  asMcpGrantId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  McpAccessService,
  McpRateLimitExceededError,
  McpRateLimitService,
  type IMcpAuditRepository,
  type IMcpGrantRepository,
  type IMcpRateLimitRepository,
  type McpAuditEntry,
  type McpGrant,
  type McpScope,
} from "@/domains/mcp-access";

import type { McpClaims } from "./claims";
import { MCP_RATE_LIMIT_DEFAULTS } from "./config";
import { runMcpTool, type McpGateDeps } from "./run-tool";
import type { McpToolDefinition } from "./tool-types";

const WS = asWorkspaceId("ws-a");
const USER = asUserId("user-1");
const CLIENT = "client-1";
const GRANT = asMcpGrantId("grant-1");
const NOW = new Date("2026-10-30T10:00:20.000Z");

function claims(scopes: McpScope[]): McpClaims {
  return { userId: USER, clientId: CLIENT, workspaceId: WS, scopes };
}

function parse(result: { content: { type: string; text?: string }[] }) {
  return JSON.parse(result.content[0]?.text ?? "null");
}

function tool(scope: McpScope): McpToolDefinition & {
  handler: ReturnType<typeof vi.fn>;
} {
  return {
    name: scope === "read" ? "list_things" : "create_thing",
    description: "d",
    scope,
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: vi.fn(async () => ({ data: { ok: true } })),
  };
}

const grant: McpGrant = {
  id: GRANT,
  workspaceId: WS,
  userId: USER,
  clientId: CLIENT,
  clientName: "Claude",
  scopes: ["read", "draft", "schedule"],
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  lastUsedAt: NOW,
  revokedAt: null,
};

/** Rakitan asli: McpAccessService + McpRateLimitService, hanya repository yang palsu. */
function world(counters: IMcpRateLimitRepository) {
  const audits: Record<string, unknown>[] = [];
  const access = new McpAccessService(
    {
      findActiveByConnection: async () => grant,
      touchLastUsed: async () => undefined,
    } as unknown as IMcpGrantRepository,
    {
      create: async (input: Record<string, unknown>) => {
        audits.push(input);
        return { id: asMcpAuditLogId("a-1"), ...input } as McpAuditEntry;
      },
    } as unknown as IMcpAuditRepository,
    { revokeAtomically: async () => ({ revoked: true }) },
    { getMembership: async () => ({ status: MemberStatus.Active }) },
    () => NOW,
    new McpRateLimitService(counters, MCP_RATE_LIMIT_DEFAULTS, () => NOW),
  );
  const deps: McpGateDeps = {
    access,
    services: {} as McpGateDeps["services"],
    logger: { error: vi.fn() },
  };
  return { deps, audits, access };
}

const denyAll: IMcpRateLimitRepository = {
  consume: async () => ({ allowed: false }),
  deleteExpired: async () => 0,
};

describe("runMcpTool with rate limit (T-154)", () => {
  it("returns a rate_limited error with retryAfterSeconds, audits denied, and never runs the handler", async () => {
    const { deps, audits } = world(denyAll);
    const t = tool("read");

    const result = await runMcpTool(deps, claims(["read"]), t, {});

    expect(result.isError).toBe(true);
    const { error } = parse(result);
    expect(error).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 40, // 10:00:20 -> 10:01:00
      quota: "calls",
      limit: 60,
    });
    expect(error.message).toContain("40 detik");
    expect(t.handler).not.toHaveBeenCalled();
    expect(audits).toEqual([
      expect.objectContaining({
        status: "denied",
        errorCode: "rate_limited",
        grantId: GRANT,
        scope: "read",
      }),
    ]);
  });

  it("uses the configured defaults 60/min, 30/h, 50/day", () => {
    expect(MCP_RATE_LIMIT_DEFAULTS).toEqual({
      calls: 60,
      write_actions: 30,
      scheduled_contents: 50,
    });
  });

  it("counts a call for every tool and a write action only for draft/schedule tools", async () => {
    const consumed: string[] = [];
    const counting: IMcpRateLimitRepository = {
      consume: async (input) => {
        consumed.push(input.quota);
        return { allowed: true, used: 1 };
      },
      deleteExpired: async () => 0,
    };
    const { deps } = world(counting);

    await runMcpTool(deps, claims(["read"]), tool("read"), {});
    expect(consumed).toEqual(["calls"]);

    consumed.length = 0;
    await runMcpTool(deps, claims(["draft"]), tool("draft"), {});
    expect(consumed).toEqual(["calls", "write_actions"]);
  });

  it("reports the write quota when only the hourly limit is exhausted", async () => {
    const writeExhausted: IMcpRateLimitRepository = {
      consume: async (input) =>
        input.quota === "write_actions"
          ? { allowed: false }
          : { allowed: true, used: 1 },
      deleteExpired: async () => 0,
    };
    const { deps } = world(writeExhausted);

    const read = await runMcpTool(deps, claims(["read"]), tool("read"), {});
    expect(read.isError).toBeUndefined();

    const write = await runMcpTool(deps, claims(["draft"]), tool("draft"), {});
    expect(parse(write).error).toMatchObject({
      code: "rate_limited",
      quota: "write_actions",
      limit: 30,
      retryAfterSeconds: 3600 - 20, // 10:00:20 -> 11:00:00
    });
  });

  it("does not spend workspace quota on calls that fail authorization first", async () => {
    const consume = vi.fn(async () => ({ allowed: true, used: 1 }) as const);
    const { deps } = world({ consume, deleteExpired: async () => 0 });

    const result = await runMcpTool(deps, claims([]), tool("read"), {});

    expect(parse(result).error.code).toBe("token_scope_insufficient");
    expect(consume).not.toHaveBeenCalled();
  });

  it("fails closed as internal_error when the counter store is down", async () => {
    const down: IMcpRateLimitRepository = {
      consume: async () => {
        throw new Error("db down");
      },
      deleteExpired: async () => 0,
    };
    const { deps } = world(down);
    const t = tool("read");

    const result = await runMcpTool(deps, claims(["read"]), t, {});

    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("internal_error");
    expect(t.handler).not.toHaveBeenCalled();
  });

  it("maps a quota rejection thrown by the tool handler (T-153 scheduled contents) to rate_limited", async () => {
    // Penghitung harian penuh hanya untuk kuota konten terjadwal.
    const { deps, audits, access } = world({
      consume: async (input) =>
        input.quota === "scheduled_contents"
          ? { allowed: false }
          : { allowed: true, used: 1 },
      deleteExpired: async () => 0,
    });
    const t = tool("schedule");
    t.handler.mockImplementation(async (ctx) => {
      await access.consumeQuota(ctx.workspaceId, "scheduled_contents", 3);
      return { data: { ok: true } };
    });

    const result = await runMcpTool(deps, claims(["schedule"]), t, {});

    expect(parse(result).error).toMatchObject({
      code: "rate_limited",
      quota: "scheduled_contents",
      limit: 50,
      retryAfterSeconds: 14 * 3600 - 20, // 10:00:20 -> 00:00 UTC berikutnya
    });
    expect(audits.at(-1)).toMatchObject({
      status: "denied",
      errorCode: "rate_limited",
    });
  });

  it("keeps the domain error shape stable for T-153 callers", () => {
    const error = new McpRateLimitExceededError({
      quota: "scheduled_contents",
      limit: 50,
      retryAfterSeconds: 12,
    });
    expect(error.code).toBe("rate_limited");
    expect(error.grantId).toBeNull();
  });
});
