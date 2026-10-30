import {
  MemberStatus,
  asMcpAuditLogId,
  asMcpGrantId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  McpAccessDeniedError,
  McpAccessService,
  type IMcpAuditRepository,
  type IMcpGrantRepository,
  type McpAuditEntry,
  type McpGrant,
  type McpScope,
} from "@/domains/mcp-access";
import { PublishingDomainError } from "@/domains/publishing";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";

import type { McpClaims } from "./claims";
import { McpInvalidCursorError } from "./cursor";
import { runMcpTool, type McpGateDeps } from "./run-tool";
import { McpToolInputError } from "./tool-input";
import type { McpToolDefinition, McpToolOutput } from "./tool-types";

const WS_A = asWorkspaceId("ws-a");
const WS_B = asWorkspaceId("ws-b");
const USER = asUserId("user-1");
const CLIENT = "client-1";
const GRANT = asMcpGrantId("grant-1");

const claims: McpClaims = {
  userId: USER,
  clientId: CLIENT,
  workspaceId: WS_A,
  scopes: ["read"],
};

function parse(result: { content: { type: string; text?: string }[] }) {
  return JSON.parse(result.content[0]?.text ?? "null");
}

function makeTool(
  handler: McpToolDefinition["handler"] = async () => ({ data: { ok: true } }),
): McpToolDefinition & { handler: ReturnType<typeof vi.fn> } {
  return {
    name: "list_things",
    description: "d",
    scope: "read",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: vi.fn(handler),
  };
}

function scriptedDeps(
  authorize: McpGateDeps["access"]["authorizeCall"],
  recordAudit: McpGateDeps["access"]["recordAudit"] = async () =>
    ({}) as McpAuditEntry,
) {
  const logger = { error: vi.fn() };
  const access = {
    authorizeCall: vi.fn(authorize),
    recordAudit: vi.fn(recordAudit),
  };
  let tick = 1_000;
  const deps: McpGateDeps = {
    access,
    services: {} as McpGateDeps["services"],
    logger,
    now: () => (tick += 5),
  };
  return { deps, access, logger };
}

const authorizedCall = {
  grantId: GRANT,
  userId: USER,
  workspaceId: WS_A,
  clientId: CLIENT,
  clientName: "Claude",
  grantScopes: ["read", "draft"] as McpScope[],
};

describe("runMcpTool (scripted access)", () => {
  it("authorizes with token scopes and the tool scope, runs the handler with the grant identity, audits success", async () => {
    const { deps, access } = scriptedDeps(async () => authorizedCall);
    const tool = makeTool(async () => ({
      data: { hello: "dunia" },
      targetId: "post-9",
    }));

    const result = await runMcpTool(deps, claims, tool, { cursor: "c" });

    expect(result.isError).toBeUndefined();
    expect(parse(result)).toEqual({ hello: "dunia" });
    expect(access.authorizeCall).toHaveBeenCalledWith({
      userId: USER,
      clientId: CLIENT,
      workspaceId: WS_A,
      tokenScopes: ["read"],
      requiredScope: "read",
    });
    expect(tool.handler).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS_A,
        userId: USER,
        clientId: CLIENT,
        grantScopes: ["read", "draft"],
      }),
      { cursor: "c" },
    );
    expect(access.recordAudit).toHaveBeenCalledWith({
      workspaceId: WS_A,
      userId: USER,
      grantId: GRANT,
      clientId: CLIENT,
      toolName: "list_things",
      scope: "read",
      toolInput: { cursor: "c" },
      status: "success",
      errorCode: null,
      durationMs: expect.any(Number),
      targetId: "post-9",
    });
  });

  it.each([
    "no_active_grant",
    "token_scope_insufficient",
    "grant_scope_insufficient",
    "not_workspace_member",
  ] as const)(
    "turns a %s denial into a clear error (not empty data), audits denied, never runs the handler",
    async (reason) => {
      const { deps, access } = scriptedDeps(async () => {
        throw new McpAccessDeniedError(reason, GRANT);
      });
      const tool = makeTool();

      const result = await runMcpTool(deps, claims, tool, {});

      expect(result.isError).toBe(true);
      expect(parse(result).error.code).toBe(reason);
      expect(parse(result).error.message).toEqual(expect.any(String));
      expect(tool.handler).not.toHaveBeenCalled();
      expect(access.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "denied",
          errorCode: reason,
          grantId: GRANT,
        }),
      );
    },
  );

  it("keeps a denial a denial when the audit write fails (e.g. FK on a deleted workspace); failure is logged", async () => {
    const { deps, logger } = scriptedDeps(
      async () => {
        throw new McpAccessDeniedError("no_active_grant");
      },
      async () => {
        throw new Error("FK violation mcp_audit_logs_workspace_id_fkey");
      },
    );

    const result = await runMcpTool(deps, claims, makeTool(), {});

    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("no_active_grant");
    expect(logger.error).toHaveBeenCalledWith(
      "[mcp] audit gagal ditulis",
      expect.objectContaining({ tool: "list_things" }),
    );
  });

  it("does not cancel a successful call when the audit write fails", async () => {
    const { deps, logger } = scriptedDeps(
      async () => authorizedCall,
      async () => {
        throw new Error("db down");
      },
    );

    const result = await runMcpTool(deps, claims, makeTool(), {});

    expect(result.isError).toBeUndefined();
    expect(parse(result)).toEqual({ ok: true });
    expect(logger.error).toHaveBeenCalled();
  });

  it("fails closed when authorization itself breaks (no handler, generic message, no leak)", async () => {
    const { deps, access } = scriptedDeps(async () => {
      throw new Error("connection refused postgres://secret@host");
    });
    const tool = makeTool();

    const result = await runMcpTool(deps, claims, tool, {});

    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("internal_error");
    expect(JSON.stringify(result)).not.toContain("postgres://");
    expect(tool.handler).not.toHaveBeenCalled();
    expect(access.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", errorCode: "internal_error" }),
    );
  });

  it.each([
    [
      new McpToolInputError("Argumen salah."),
      "invalid_input",
      "Argumen salah.",
    ],
    [new McpInvalidCursorError(), "invalid_cursor", undefined],
    [
      new NotFoundError("Post tidak ditemukan."),
      "not_found",
      "Post tidak ditemukan.",
    ],
    [
      new ValidationError("Salah satu akun tidak ditemukan."),
      "invalid_input",
      "Salah satu akun tidak ditemukan.",
    ],
    [
      new PublishingDomainError('Content format "reel" tidak diizinkan.'),
      "invalid_input",
      'Content format "reel" tidak diizinkan.',
    ],
    [
      new ConflictError("Post ini sudah dijadwalkan."),
      "conflict",
      "Post ini sudah dijadwalkan.",
    ],
  ])("maps %s to %s and audits error", async (error, code, message) => {
    const { deps, access } = scriptedDeps(async () => authorizedCall);
    const result = await runMcpTool(
      deps,
      claims,
      makeTool(async () => {
        throw error;
      }),
      {},
    );

    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe(code);
    if (message) {
      expect(parse(result).error.message).toBe(message);
    }
    expect(access.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        errorCode: code,
        grantId: GRANT,
      }),
    );
  });

  it("hides unexpected handler errors behind internal_error and logs them", async () => {
    const { deps, logger } = scriptedDeps(async () => authorizedCall);
    const result = await runMcpTool(
      deps,
      claims,
      makeTool(async (): Promise<McpToolOutput> => {
        throw new Error("prisma: column secret_col does not exist");
      }),
      {},
    );

    expect(parse(result).error.code).toBe("internal_error");
    expect(JSON.stringify(result)).not.toContain("secret_col");
    expect(logger.error).toHaveBeenCalledWith(
      "[mcp] tool gagal",
      expect.objectContaining({ tool: "list_things" }),
    );
  });
});

/**
 * Gerbang + `McpAccessService` asli dengan repository palsu lokal: membuktikan
 * isolasi workspace dan pemakaian grant (bukan token) sebagai sumber otorisasi.
 */
describe("runMcpTool with the real McpAccessService", () => {
  function realWorld(options: {
    grants: McpGrant[];
    activeMembers?: { workspaceId: string; userId: string }[];
  }) {
    const audits: unknown[] = [];
    const grantRepo = {
      findActiveByConnection: async (key: {
        userId: string;
        clientId: string;
        workspaceId: string;
      }) =>
        options.grants.find(
          (grant) =>
            grant.revokedAt === null &&
            grant.userId === key.userId &&
            grant.clientId === key.clientId &&
            grant.workspaceId === key.workspaceId,
        ) ?? null,
      touchLastUsed: async () => undefined,
    } as unknown as IMcpGrantRepository;
    const auditRepo = {
      create: async (input: Record<string, unknown>) => {
        audits.push(input);
        return { id: asMcpAuditLogId("a-1"), ...input } as McpAuditEntry;
      },
    } as unknown as IMcpAuditRepository;
    const members = options.activeMembers ?? [
      { workspaceId: WS_A, userId: USER },
    ];
    const access = new McpAccessService(
      grantRepo,
      auditRepo,
      { revokeAtomically: async () => ({ revoked: true }) },
      {
        getMembership: async (workspaceId, userId) =>
          members.some(
            (m) => m.workspaceId === workspaceId && m.userId === userId,
          )
            ? { status: MemberStatus.Active }
            : null,
      },
    );
    return {
      deps: {
        access,
        services: {} as McpGateDeps["services"],
      } satisfies McpGateDeps,
      audits,
    };
  }

  const grantA: McpGrant = {
    id: GRANT,
    workspaceId: WS_A,
    userId: USER,
    clientId: CLIENT,
    clientName: "Claude",
    scopes: ["read"],
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    lastUsedAt: null,
    revokedAt: null,
  };

  it("serves a call covered by token scope, grant scope, and membership; audit carries no full caption", async () => {
    const { deps, audits } = realWorld({ grants: [grantA] });
    const tool = makeTool();
    const longCaption = "rahasia ".repeat(30);

    const result = await runMcpTool(deps, claims, tool, {
      caption: longCaption,
    });

    expect(result.isError).toBeUndefined();
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0])).not.toContain("rahasia");
    expect(audits[0]).toMatchObject({ status: "success", workspaceId: WS_A });
  });

  it("refuses a token for workspace B when the only grant is for workspace A (isolation)", async () => {
    const { deps, audits } = realWorld({
      grants: [grantA],
      activeMembers: [
        { workspaceId: WS_A, userId: USER },
        { workspaceId: WS_B, userId: USER },
      ],
    });
    const tool = makeTool();

    const result = await runMcpTool(
      deps,
      { ...claims, workspaceId: WS_B },
      tool,
      {},
    );

    expect(parse(result).error.code).toBe("no_active_grant");
    expect(tool.handler).not.toHaveBeenCalled();
    expect(audits[0]).toMatchObject({ status: "denied", workspaceId: WS_B });
  });

  it("refuses a revoked grant even though the token still carries the scope", async () => {
    const { deps } = realWorld({
      grants: [{ ...grantA, revokedAt: new Date("2026-10-27T00:00:00.000Z") }],
    });
    const result = await runMcpTool(deps, claims, makeTool(), {});
    expect(parse(result).error.code).toBe("no_active_grant");
  });

  it("refuses when the grant was narrowed below the token scope", async () => {
    const { deps } = realWorld({ grants: [{ ...grantA, scopes: ["draft"] }] });
    const result = await runMcpTool(deps, claims, makeTool(), {});
    expect(parse(result).error.code).toBe("grant_scope_insufficient");
  });

  it("refuses a user removed from the workspace", async () => {
    const { deps } = realWorld({ grants: [grantA], activeMembers: [] });
    const result = await runMcpTool(deps, claims, makeTool(), {});
    expect(parse(result).error.code).toBe("not_workspace_member");
  });

  it("refuses when the token lacks the scope", async () => {
    const { deps } = realWorld({ grants: [grantA] });
    const result = await runMcpTool(
      deps,
      { ...claims, scopes: [] },
      makeTool(),
      {},
    );
    expect(parse(result).error.code).toBe("token_scope_insufficient");
  });
});
