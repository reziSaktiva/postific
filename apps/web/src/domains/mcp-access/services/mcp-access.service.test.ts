import {
  asMcpAuditLogId,
  asMcpGrantId,
  asUserId,
  asWorkspaceId,
  MemberStatus,
  type McpGrantId,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type {
  McpAuditEntry,
  McpAuditStatus,
} from "../entities/mcp-audit-entry";
import type { McpConnectionKey, McpGrant } from "../entities/mcp-grant";
import {
  McpAccessDeniedError,
  McpGrantNotFoundError,
  McpInvalidAuditInputError,
  McpInvalidGrantInputError,
  type McpDenialReason,
} from "../errors";
import type { IMcpAuditRepository } from "../repositories/mcp-audit.repository";
import type { IMcpGrantRepository } from "../repositories/mcp-grant.repository";
import type {
  IMcpGrantRevocationPort,
  McpGrantRevocationInput,
} from "../repositories/mcp-grant-revocation.port";
import type { McpRateLimitContext } from "../types";
import type { McpScope } from "../value-objects/mcp-scope";
import {
  MCP_AUDIT_RETENTION_DAYS,
  MCP_LAST_USED_THROTTLE_MS,
  McpAccessService,
} from "./mcp-access.service";

const WS_A = asWorkspaceId("ws-a");
const WS_B = asWorkspaceId("ws-b");
const USER_1 = asUserId("user-1");
const USER_2 = asUserId("user-2");
const CLIENT = "client-claude";
const T0 = new Date("2026-10-26T10:00:00.000Z");

function connectionKey(g: McpConnectionKey): string {
  return `${g.userId}|${g.clientId}|${g.workspaceId}`;
}

/** Repository grant in-memory yang meniru semantik upsert/aktif dari kontrak. */
class FakeGrantRepository implements IMcpGrantRepository {
  grants: McpGrant[] = [];
  touches: { id: McpGrantId; key: McpConnectionKey; usedAt: Date }[] = [];
  findByIdCalls: { id: McpGrantId; userId: UserId }[] = [];
  private seq = 0;

  seed(overrides: Partial<McpGrant> = {}): McpGrant {
    this.seq += 1;
    const grant: McpGrant = {
      id: asMcpGrantId(`grant-${this.seq}`),
      workspaceId: WS_A,
      userId: USER_1,
      clientId: CLIENT,
      clientName: "Claude",
      scopes: ["read", "draft"],
      createdAt: new Date(T0.getTime() - 3_600_000),
      lastUsedAt: null,
      revokedAt: null,
      ...overrides,
    };
    this.grants.push(grant);
    return grant;
  }

  /** Meniru kontrak: filter `id` DAN `userId`; milik pengguna lain = `null`. */
  async findById(id: McpGrantId, userId: UserId) {
    this.findByIdCalls.push({ id, userId });
    return this.grants.find((g) => g.id === id && g.userId === userId) ?? null;
  }

  async findActiveByConnection(key: McpConnectionKey) {
    return (
      this.grants.find(
        (g) => g.revokedAt === null && connectionKey(g) === connectionKey(key),
      ) ?? null
    );
  }

  async listActiveByUser(userId: UserId) {
    return this.grants.filter((g) => g.userId === userId && !g.revokedAt);
  }

  async upsertActive(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    clientId: string;
    clientName: string | null;
    scopes: McpScope[];
    createdAt: Date;
  }) {
    const existing = await this.findActiveByConnection(input);
    if (existing) {
      existing.scopes = input.scopes;
      existing.clientName = input.clientName ?? existing.clientName;
      return existing;
    }
    return this.seed({
      workspaceId: input.workspaceId,
      userId: input.userId,
      clientId: input.clientId,
      clientName: input.clientName,
      scopes: input.scopes,
      createdAt: input.createdAt,
    });
  }

  /** Meniru kontrak: `id` + kunci koneksi + masih aktif; selain itu no-op. */
  async touchLastUsed(id: McpGrantId, key: McpConnectionKey, usedAt: Date) {
    this.touches.push({ id, key, usedAt });
    const grant = this.grants.find(
      (g) =>
        g.id === id &&
        g.revokedAt === null &&
        connectionKey(g) === connectionKey(key),
    );
    if (grant) {
      grant.lastUsedAt = usedAt;
    }
  }
}

/** Port pencabutan palsu: meniru kontrak atomik (grant + consent + refresh). */
class FakeRevocationPort implements IMcpGrantRevocationPort {
  calls: McpGrantRevocationInput[] = [];
  consents = new Set<string>();
  refreshTokens = new Set<string>();

  constructor(private readonly grants: FakeGrantRepository) {}

  async revokeAtomically(input: McpGrantRevocationInput) {
    this.calls.push(input);
    const grant = this.grants.grants.find((g) => g.id === input.grantId);
    if (!grant || grant.revokedAt !== null) {
      return { revoked: false };
    }
    grant.revokedAt = input.revokedAt;
    const key = connectionKey(input);
    this.consents.delete(key);
    this.refreshTokens.delete(key);
    return { revoked: true };
  }
}

class FakeAuditRepository implements IMcpAuditRepository {
  rows: McpAuditEntry[] = [];
  cutoffs: Date[] = [];

  async create(input: Omit<McpAuditEntry, "id">) {
    const row: McpAuditEntry = {
      id: asMcpAuditLogId(`audit-${this.rows.length + 1}`),
      ...input,
    };
    this.rows.push(row);
    return row;
  }

  async deleteOlderThan(cutoff: Date) {
    this.cutoffs.push(cutoff);
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.createdAt >= cutoff);
    return before - this.rows.length;
  }
}

function createHarness(
  options: { now?: () => Date; rateLimit?: boolean } = {},
) {
  const grants = new FakeGrantRepository();
  const audit = new FakeAuditRepository();
  const revocation = new FakeRevocationPort(grants);
  const members = new Map<string, MemberStatus>([
    [`${WS_A}|${USER_1}`, MemberStatus.Active],
    [`${WS_B}|${USER_1}`, MemberStatus.Active],
  ]);
  const rateLimitCalls: McpRateLimitContext[] = [];
  let now = T0;

  const service = new McpAccessService(
    grants,
    audit,
    revocation,
    {
      getMembership: async (workspaceId, userId) => {
        const status = members.get(`${workspaceId}|${userId}`);
        return status ? { status } : null;
      },
    },
    options.now ?? (() => now),
    options.rateLimit
      ? {
          assertWithinLimit: async (ctx) => {
            rateLimitCalls.push(ctx);
          },
          consumeQuota: async () => undefined,
          purgeExpired: async () => 0,
        }
      : undefined,
  );

  return {
    service,
    grants,
    audit,
    revocation,
    members,
    rateLimitCalls,
    setNow: (date: Date) => {
      now = date;
    },
  };
}

const callInput = {
  userId: USER_1,
  clientId: CLIENT,
  workspaceId: WS_A,
  tokenScopes: ["read", "draft"] as McpScope[],
  requiredScope: "read" as McpScope,
};

async function expectDenied(
  promise: Promise<unknown>,
  reason: McpDenialReason,
): Promise<McpAccessDeniedError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(McpAccessDeniedError);
  expect((error as McpAccessDeniedError).reason).toBe(reason);
  expect((error as McpAccessDeniedError).code).toBe(reason);
  return error as McpAccessDeniedError;
}

describe("McpAccessService.authorizeCall", () => {
  it("authorizes an active grant with covering scopes and an active member", async () => {
    const h = createHarness();
    const grant = h.grants.seed();

    const result = await h.service.authorizeCall(callInput);

    expect(result).toEqual({
      grantId: grant.id,
      userId: USER_1,
      workspaceId: WS_A,
      clientId: CLIENT,
      clientName: "Claude",
      grantScopes: ["read", "draft"],
    });
  });

  it("rejects when there is no grant at all", async () => {
    const h = createHarness();

    const error = await expectDenied(
      h.service.authorizeCall(callInput),
      "no_active_grant",
    );
    expect(error.grantId).toBeNull();
  });

  it("rejects a revoked grant even though the token is still valid", async () => {
    const h = createHarness();
    h.grants.seed({ revokedAt: new Date(T0.getTime() - 1000) });

    await expectDenied(h.service.authorizeCall(callInput), "no_active_grant");
    expect(h.grants.touches).toHaveLength(0);
  });

  it("rejects when the token lacks the scope although the grant has it", async () => {
    const h = createHarness();
    const grant = h.grants.seed({ scopes: ["read", "draft", "schedule"] });

    const error = await expectDenied(
      h.service.authorizeCall({
        ...callInput,
        tokenScopes: ["read", "draft"],
        requiredScope: "schedule",
      }),
      "token_scope_insufficient",
    );
    expect(error.grantId).toBe(grant.id);
  });

  it("rejects when the grant lacks the scope although the token has it", async () => {
    const h = createHarness();
    const grant = h.grants.seed({ scopes: ["read"] });

    const error = await expectDenied(
      h.service.authorizeCall({
        ...callInput,
        tokenScopes: ["read", "draft", "schedule"],
        requiredScope: "draft",
      }),
      "grant_scope_insufficient",
    );
    expect(error.grantId).toBe(grant.id);
  });

  it("takes effect immediately when a grant is narrowed after the token was issued", async () => {
    const h = createHarness();
    h.grants.seed({ scopes: ["read", "draft"] });
    const token = ["read", "draft"] as McpScope[];

    await h.service.authorizeCall({
      ...callInput,
      tokenScopes: token,
      requiredScope: "draft",
    });
    await h.service.ensureGrantFromConsent({
      workspaceId: WS_A,
      userId: USER_1,
      clientId: CLIENT,
      consentScopes: ["mcp:read"],
    });

    await expectDenied(
      h.service.authorizeCall({
        ...callInput,
        tokenScopes: token,
        requiredScope: "draft",
      }),
      "grant_scope_insufficient",
    );
  });

  it.each([
    ["removed", MemberStatus.Removed],
    ["pending", MemberStatus.Pending],
  ])("rejects a %s member", async (_label, status) => {
    const h = createHarness();
    const grant = h.grants.seed();
    h.members.set(`${WS_A}|${USER_1}`, status);

    const error = await expectDenied(
      h.service.authorizeCall(callInput),
      "not_workspace_member",
    );
    expect(error.grantId).toBe(grant.id);
    expect(h.grants.touches).toHaveLength(0);
  });

  it("rejects a user who was never a member", async () => {
    const h = createHarness();
    h.grants.seed({ userId: USER_2 });

    await expectDenied(
      h.service.authorizeCall({ ...callInput, userId: USER_2 }),
      "not_workspace_member",
    );
  });

  it("does not restrict by member role (any active member passes)", async () => {
    const h = createHarness();
    h.grants.seed({ scopes: ["read", "draft", "schedule"] });

    await expect(
      h.service.authorizeCall({
        ...callInput,
        tokenScopes: ["schedule"],
        requiredScope: "schedule",
      }),
    ).resolves.toMatchObject({ grantId: expect.any(String) });
  });

  it("isolates workspaces: a grant for workspace A does not authorize workspace B", async () => {
    const h = createHarness();
    h.grants.seed({ workspaceId: WS_A });

    await expect(
      h.service.authorizeCall({ ...callInput, workspaceId: WS_A }),
    ).resolves.toBeDefined();
    await expectDenied(
      h.service.authorizeCall({ ...callInput, workspaceId: WS_B }),
      "no_active_grant",
    );
  });

  it("isolates users and clients: another user's or client's grant does not authorize", async () => {
    const h = createHarness();
    h.grants.seed({ userId: USER_2 });
    h.grants.seed({ clientId: "other-client" });

    await expectDenied(h.service.authorizeCall(callInput), "no_active_grant");
  });

  it("fails closed when the repository returns a row for a different connection", async () => {
    const h = createHarness();
    const wrong = h.grants.seed({ workspaceId: WS_B });
    h.grants.findActiveByConnection = async () => wrong;

    await expectDenied(h.service.authorizeCall(callInput), "no_active_grant");
  });

  it("calls the rate limit hook only after grant, scope, and member pass", async () => {
    const h = createHarness({ rateLimit: true });
    const grant = h.grants.seed();

    await h.service.authorizeCall(callInput);
    expect(h.rateLimitCalls).toEqual([
      {
        workspaceId: WS_A,
        userId: USER_1,
        clientId: CLIENT,
        grantId: grant.id,
        requiredScope: "read",
      },
    ]);

    h.members.set(`${WS_A}|${USER_1}`, MemberStatus.Removed);
    await expectDenied(
      h.service.authorizeCall(callInput),
      "not_workspace_member",
    );
    expect(h.rateLimitCalls).toHaveLength(1);
  });

  it("propagates a rate limit rejection and does not touch last_used_at", async () => {
    const grants = new FakeGrantRepository();
    grants.seed();
    const limitError = new Error("rate limited");
    const service = new McpAccessService(
      grants,
      new FakeAuditRepository(),
      new FakeRevocationPort(grants),
      { getMembership: async () => ({ status: MemberStatus.Active }) },
      () => T0,
      {
        assertWithinLimit: async () => {
          throw limitError;
        },
        consumeQuota: async () => undefined,
        purgeExpired: async () => 0,
      },
    );

    await expect(service.authorizeCall(callInput)).rejects.toBe(limitError);
    expect(grants.touches).toHaveLength(0);
  });

  it("delegates consumeQuota and purgeRateLimitWindows to the rate limiter (T-154)", async () => {
    const grants = new FakeGrantRepository();
    const consumed: unknown[][] = [];
    const service = new McpAccessService(
      grants,
      new FakeAuditRepository(),
      new FakeRevocationPort(grants),
      { getMembership: async () => ({ status: MemberStatus.Active }) },
      () => T0,
      {
        assertWithinLimit: async () => undefined,
        consumeQuota: async (...args) => {
          consumed.push(args);
        },
        purgeExpired: async () => 7,
      },
    );

    await service.consumeQuota(WS_A, "scheduled_contents", 3);
    await service.consumeQuota(WS_A, "scheduled_contents");
    expect(consumed).toEqual([
      [WS_A, "scheduled_contents", 3],
      [WS_A, "scheduled_contents", 1],
    ]);
    await expect(service.purgeRateLimitWindows()).resolves.toEqual({
      deleted: 7,
    });
  });

  it("consumeQuota and purgeRateLimitWindows are no-ops without a rate limiter", async () => {
    const h = createHarness();

    await expect(
      h.service.consumeQuota(WS_A, "scheduled_contents", 99),
    ).resolves.toBeUndefined();
    await expect(h.service.purgeRateLimitWindows()).resolves.toEqual({
      deleted: 0,
    });
  });

  it("works without a rate limit hook (no-op)", async () => {
    const h = createHarness();
    h.grants.seed();

    await expect(h.service.authorizeCall(callInput)).resolves.toBeDefined();
  });
});

describe("McpAccessService.authorizeCall last_used_at throttle", () => {
  it("writes last_used_at on the first authorized call", async () => {
    const h = createHarness();
    const grant = h.grants.seed({ lastUsedAt: null });

    await h.service.authorizeCall(callInput);

    expect(h.grants.touches).toEqual([
      {
        id: grant.id,
        key: { userId: USER_1, clientId: CLIENT, workspaceId: WS_A },
        usedAt: T0,
      },
    ]);
  });

  it("only touches the grant of the authorized connection, never another user's grant", async () => {
    const h = createHarness();
    const mine = h.grants.seed({ lastUsedAt: null });
    const theirs = h.grants.seed({ userId: USER_2, lastUsedAt: null });

    await h.service.authorizeCall(callInput);

    expect(mine.lastUsedAt).toEqual(T0);
    expect(theirs.lastUsedAt).toBeNull();
    // Fake menolak touch bila kunci koneksi tidak cocok dengan baris itu.
    await h.grants.touchLastUsed(theirs.id, callInput, T0);
    expect(theirs.lastUsedAt).toBeNull();
  });

  it("writes at most once per minute", async () => {
    const h = createHarness();
    h.grants.seed({ lastUsedAt: null });

    await h.service.authorizeCall(callInput);
    h.setNow(new Date(T0.getTime() + 30_000));
    await h.service.authorizeCall(callInput);
    h.setNow(new Date(T0.getTime() + MCP_LAST_USED_THROTTLE_MS - 1));
    await h.service.authorizeCall(callInput);
    expect(h.grants.touches).toHaveLength(1);

    const later = new Date(T0.getTime() + MCP_LAST_USED_THROTTLE_MS);
    h.setNow(later);
    await h.service.authorizeCall(callInput);
    expect(h.grants.touches).toHaveLength(2);
    expect(h.grants.touches[1].usedAt).toEqual(later);
  });

  it("does not write when a denied call is made", async () => {
    const h = createHarness();
    h.grants.seed({ lastUsedAt: null });

    await expectDenied(
      h.service.authorizeCall({ ...callInput, requiredScope: "schedule" }),
      "token_scope_insufficient",
    );
    expect(h.grants.touches).toHaveLength(0);
  });
});

describe("McpAccessService.createGrant and ensureGrantFromConsent", () => {
  it("creates a grant with normalized scopes for an active member", async () => {
    const h = createHarness();

    const grant = await h.service.createGrant({
      workspaceId: WS_A,
      userId: USER_1,
      clientId: CLIENT,
      clientName: "  Claude Code ",
      scopes: ["draft", "read", "draft"],
    });

    expect(grant).toMatchObject({
      workspaceId: WS_A,
      userId: USER_1,
      clientId: CLIENT,
      clientName: "Claude Code",
      scopes: ["read", "draft"],
      revokedAt: null,
      createdAt: T0,
    });
  });

  it("rejects a user who is not an active member of the workspace", async () => {
    const h = createHarness();

    await expectDenied(
      h.service.createGrant({
        workspaceId: WS_A,
        userId: USER_2,
        clientId: CLIENT,
        scopes: ["read"],
      }),
      "not_workspace_member",
    );
    expect(h.grants.grants).toHaveLength(0);
  });

  it("rejects empty scopes and empty client id", async () => {
    const h = createHarness();

    await expect(
      h.service.createGrant({
        workspaceId: WS_A,
        userId: USER_1,
        clientId: CLIENT,
        scopes: [],
      }),
    ).rejects.toBeInstanceOf(McpInvalidGrantInputError);
    await expect(
      h.service.createGrant({
        workspaceId: WS_A,
        userId: USER_1,
        clientId: "  ",
        scopes: ["read"],
      }),
    ).rejects.toBeInstanceOf(McpInvalidGrantInputError);
  });

  it("is idempotent: re-consent with an active grant updates scopes, not a new row", async () => {
    const h = createHarness();
    const input = {
      workspaceId: WS_A,
      userId: USER_1,
      clientId: CLIENT,
      clientName: "Claude",
      consentScopes: ["openid", "mcp:read", "mcp:draft", "offline_access"],
    };

    const first = await h.service.ensureGrantFromConsent(input);
    const second = await h.service.ensureGrantFromConsent(input);

    expect(h.grants.grants).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.scopes).toEqual(["read", "draft"]);
  });

  it("narrows and widens scopes to match the latest consent", async () => {
    const h = createHarness();
    const base = { workspaceId: WS_A, userId: USER_1, clientId: CLIENT };

    await h.service.ensureGrantFromConsent({
      ...base,
      consentScopes: ["mcp:read", "mcp:draft", "mcp:schedule"],
    });
    const narrowed = await h.service.ensureGrantFromConsent({
      ...base,
      consentScopes: ["mcp:read"],
    });
    expect(narrowed.scopes).toEqual(["read"]);

    const widened = await h.service.ensureGrantFromConsent({
      ...base,
      consentScopes: ["mcp:read", "mcp:schedule"],
    });
    expect(widened.scopes).toEqual(["read", "schedule"]);
    expect(h.grants.grants).toHaveLength(1);
  });

  it("creates a new grant after the previous one was revoked", async () => {
    const h = createHarness();
    const old = h.grants.seed({ revokedAt: new Date(T0.getTime() - 1000) });

    const fresh = await h.service.ensureGrantFromConsent({
      workspaceId: WS_A,
      userId: USER_1,
      clientId: CLIENT,
      consentScopes: ["mcp:read"],
    });

    expect(fresh.id).not.toBe(old.id);
    expect(h.grants.grants).toHaveLength(2);
    expect(old.revokedAt).not.toBeNull();
  });

  it("rejects a consent that carries no MCP scope (fail closed)", async () => {
    const h = createHarness();

    await expect(
      h.service.ensureGrantFromConsent({
        workspaceId: WS_A,
        userId: USER_1,
        clientId: CLIENT,
        consentScopes: ["openid", "offline_access"],
      }),
    ).rejects.toBeInstanceOf(McpInvalidGrantInputError);
    expect(h.grants.grants).toHaveLength(0);
  });

  it("rejects a consent for a workspace the user is not a member of", async () => {
    const h = createHarness();
    h.members.set(`${WS_A}|${USER_1}`, MemberStatus.Removed);

    await expectDenied(
      h.service.ensureGrantFromConsent({
        workspaceId: WS_A,
        userId: USER_1,
        clientId: CLIENT,
        consentScopes: ["mcp:read"],
      }),
      "not_workspace_member",
    );
  });
});

describe("McpAccessService.revokeGrant", () => {
  it("revokes through the atomic port with the grant's connection key", async () => {
    const h = createHarness();
    const grant = h.grants.seed();
    h.revocation.consents.add(connectionKey(grant));
    h.revocation.refreshTokens.add(connectionKey(grant));

    await h.service.revokeGrant(grant.id, USER_1);

    expect(h.revocation.calls).toEqual([
      {
        grantId: grant.id,
        userId: USER_1,
        clientId: CLIENT,
        workspaceId: WS_A,
        revokedAt: T0,
      },
    ]);
    expect(grant.revokedAt).toEqual(T0);
    expect(h.revocation.consents.size).toBe(0);
    expect(h.revocation.refreshTokens.size).toBe(0);
  });

  it("makes the next call fail with no_active_grant", async () => {
    const h = createHarness();
    const grant = h.grants.seed();
    await h.service.authorizeCall(callInput);

    await h.service.revokeGrant(grant.id, USER_1);

    await expectDenied(h.service.authorizeCall(callInput), "no_active_grant");
  });

  it("is idempotent: a second revoke does not error or touch anything", async () => {
    const h = createHarness();
    const grant = h.grants.seed();

    await h.service.revokeGrant(grant.id, USER_1);
    await expect(
      h.service.revokeGrant(grant.id, USER_1),
    ).resolves.toBeUndefined();

    expect(h.revocation.calls).toHaveLength(1);
  });

  it("does not delete the consent of a newer connection when a stale grant is revoked again", async () => {
    const h = createHarness();
    const old = h.grants.seed();
    await h.service.revokeGrant(old.id, USER_1);

    const fresh = await h.service.ensureGrantFromConsent({
      workspaceId: WS_A,
      userId: USER_1,
      clientId: CLIENT,
      consentScopes: ["mcp:read"],
    });
    h.revocation.consents.add(connectionKey(fresh));

    await h.service.revokeGrant(old.id, USER_1);

    expect(h.revocation.consents.has(connectionKey(fresh))).toBe(true);
    expect(fresh.revokedAt).toBeNull();
  });

  it("looks the grant up scoped to the acting user (repository filter, not only a post-check)", async () => {
    const h = createHarness();
    const grant = h.grants.seed();

    await h.service.revokeGrant(grant.id, USER_1);

    expect(h.grants.findByIdCalls).toEqual([{ id: grant.id, userId: USER_1 }]);
  });

  it("rejects a grant that does not exist or belongs to another user, without revoking", async () => {
    const h = createHarness();
    const grant = h.grants.seed({ userId: USER_2 });

    await expect(
      h.service.revokeGrant(grant.id, USER_1),
    ).rejects.toBeInstanceOf(McpGrantNotFoundError);
    await expect(
      h.service.revokeGrant(asMcpGrantId("missing"), USER_1),
    ).rejects.toBeInstanceOf(McpGrantNotFoundError);

    expect(h.revocation.calls).toHaveLength(0);
    expect(grant.revokedAt).toBeNull();
  });

  it("propagates an atomic revocation failure (nothing is half-revoked)", async () => {
    const h = createHarness();
    const grant = h.grants.seed();
    const failure = new Error("transaction failed");
    h.revocation.revokeAtomically = async () => {
      throw failure;
    };

    await expect(h.service.revokeGrant(grant.id, USER_1)).rejects.toBe(failure);
    expect(grant.revokedAt).toBeNull();
  });
});

describe("McpAccessService.revokeGrantForConnection", () => {
  it("revokes the active grant of the connection", async () => {
    const h = createHarness();
    const grant = h.grants.seed();

    await h.service.revokeGrantForConnection({
      userId: USER_1,
      clientId: CLIENT,
      workspaceId: WS_A,
    });

    expect(h.revocation.calls).toHaveLength(1);
    expect(grant.revokedAt).not.toBeNull();
  });

  it("does nothing when there is no active grant for the connection", async () => {
    const h = createHarness();
    h.grants.seed({ workspaceId: WS_B });

    await h.service.revokeGrantForConnection({
      userId: USER_1,
      clientId: CLIENT,
      workspaceId: WS_A,
    });

    expect(h.revocation.calls).toHaveLength(0);
  });
});

describe("McpAccessService.listGrants", () => {
  it("returns only the caller's active grants across workspaces", async () => {
    const h = createHarness();
    const own = h.grants.seed({ workspaceId: WS_A });
    const ownOther = h.grants.seed({ workspaceId: WS_B });
    h.grants.seed({ userId: USER_2 });
    h.grants.seed({ revokedAt: new Date(T0.getTime() - 1000) });

    const result = await h.service.listGrants(USER_1);

    expect(result.map((g) => g.id).sort()).toEqual(
      [own.id, ownOther.id].sort(),
    );
    expect(result.every((g) => g.userId === USER_1)).toBe(true);
  });

  it("filters out foreign or revoked rows even if the repository returns them", async () => {
    const h = createHarness();
    const own = h.grants.seed();
    const foreign = h.grants.seed({ userId: USER_2 });
    const revoked = h.grants.seed({ revokedAt: T0 });
    h.grants.listActiveByUser = async () => [own, foreign, revoked];

    const result = await h.service.listGrants(USER_1);

    expect(result).toEqual([own]);
  });

  it("returns an empty list for a user without grants", async () => {
    const h = createHarness();
    h.grants.seed();

    await expect(h.service.listGrants(USER_2)).resolves.toEqual([]);
  });
});

describe("McpAccessService.recordAudit", () => {
  const base = {
    workspaceId: WS_A,
    userId: USER_1,
    clientId: CLIENT,
    toolName: "create_draft",
    scope: "draft" as McpScope,
    status: "success" as const,
  };

  it("stores a redacted summary without the full caption or secret URL parameters", async () => {
    const h = createHarness();
    const caption =
      "Caption rahasia kampanye Q4 yang belum boleh bocor ke mana pun";

    await h.service.recordAudit({
      ...base,
      grantId: asMcpGrantId("grant-1"),
      toolInput: {
        caption,
        mediaUrl: "https://cdn.example.com/a.jpg?X-Amz-Signature=topsecret",
        accountIds: ["a", "b"],
      },
      durationMs: 123.6,
      targetId: "post-1",
    });

    expect(h.audit.rows).toHaveLength(1);
    const row = h.audit.rows[0];
    expect(row.inputSummary).toBe(
      `accountIds=[2 item], caption=[teks ${caption.length} karakter], mediaUrl=https://cdn.example.com/[disamarkan]`,
    );
    expect(JSON.stringify(row)).not.toContain("rahasia");
    expect(JSON.stringify(row)).not.toContain("topsecret");
    expect(row).toMatchObject({
      grantId: "grant-1",
      toolName: "create_draft",
      scope: "draft",
      status: "success",
      durationMs: 124,
      targetId: "post-1",
      createdAt: T0,
    });
  });

  it("records a denied call without a grant and keeps the error code", async () => {
    const h = createHarness();

    await h.service.recordAudit({
      ...base,
      status: "denied",
      errorCode: "no_active_grant",
    });

    expect(h.audit.rows[0]).toMatchObject({
      grantId: null,
      status: "denied",
      errorCode: "no_active_grant",
      inputSummary: null,
      durationMs: null,
      targetId: null,
    });
  });

  it("does not hand raw tool input to the repository", async () => {
    const h = createHarness();
    const seen: unknown[] = [];
    const original = h.audit.create.bind(h.audit);
    h.audit.create = async (input) => {
      seen.push(input);
      return original(input);
    };

    await h.service.recordAudit({
      ...base,
      toolInput: { caption: "isi caption lengkap" },
    });

    expect(Object.keys(seen[0] as object)).not.toContain("toolInput");
    expect(JSON.stringify(seen[0])).not.toContain("isi caption lengkap");
  });

  it("rejects an unknown scope or status at runtime and writes nothing", async () => {
    const h = createHarness();

    await expect(
      h.service.recordAudit({ ...base, scope: "admin" as McpScope }),
    ).rejects.toBeInstanceOf(McpInvalidAuditInputError);
    await expect(
      h.service.recordAudit({
        ...base,
        scope: undefined as unknown as McpScope,
      }),
    ).rejects.toBeInstanceOf(McpInvalidAuditInputError);
    await expect(
      h.service.recordAudit({
        ...base,
        status: "ok" as unknown as McpAuditStatus,
      }),
    ).rejects.toBeInstanceOf(McpInvalidAuditInputError);
    await expect(
      h.service.recordAudit({
        ...base,
        status: "SUCCESS" as unknown as McpAuditStatus,
      }),
    ).rejects.toBeInstanceOf(McpInvalidAuditInputError);

    expect(h.audit.rows).toHaveLength(0);
  });

  it.each(["read", "draft", "schedule"] as const)(
    "accepts scope %s",
    async (scope) => {
      const h = createHarness();
      await h.service.recordAudit({ ...base, scope });
      expect(h.audit.rows[0].scope).toBe(scope);
    },
  );

  it.each(["success", "denied", "error"] as const)(
    "accepts status %s",
    async (status) => {
      const h = createHarness();
      await h.service.recordAudit({ ...base, status });
      expect(h.audit.rows[0].status).toBe(status);
    },
  );

  it("propagates a repository failure (e.g. FK on a deleted workspace) so the handler can catch it", async () => {
    const h = createHarness();
    const failure = new Error("FK violation workspace_id");
    h.audit.create = async () => {
      throw failure;
    };

    await expect(h.service.recordAudit(base)).rejects.toBe(failure);
  });

  it("clamps invalid durations and truncates oversized identifiers", async () => {
    const h = createHarness();

    await h.service.recordAudit({
      ...base,
      toolName: "t".repeat(500),
      durationMs: -5,
      errorCode: "e".repeat(500),
      targetId: "x".repeat(500),
    });
    await h.service.recordAudit({ ...base, durationMs: Number.NaN });

    expect(h.audit.rows[0].toolName).toHaveLength(100);
    expect(h.audit.rows[0].durationMs).toBe(0);
    expect(h.audit.rows[0].errorCode).toHaveLength(100);
    expect(h.audit.rows[0].targetId).toHaveLength(200);
    expect(h.audit.rows[1].durationMs).toBeNull();
  });
});

describe("McpAccessService.purgeAudit", () => {
  const day = 24 * 60 * 60 * 1000;

  function auditRow(createdAt: Date): McpAuditEntry {
    return {
      id: asMcpAuditLogId(`a-${createdAt.getTime()}`),
      workspaceId: WS_A,
      userId: USER_1,
      grantId: null,
      clientId: CLIENT,
      toolName: "get_workspace",
      scope: "read",
      inputSummary: null,
      status: "success",
      errorCode: null,
      durationMs: 1,
      targetId: null,
      createdAt,
    };
  }

  it("keeps the retention at 90 days", () => {
    expect(MCP_AUDIT_RETENTION_DAYS).toBe(90);
  });

  it("deletes rows older than 90 days and keeps newer ones", async () => {
    const h = createHarness();
    const cutoff = new Date(T0.getTime() - 90 * day);
    h.audit.rows = [
      auditRow(new Date(cutoff.getTime() - day)),
      auditRow(new Date(cutoff.getTime() - 1)),
      auditRow(cutoff),
      auditRow(new Date(T0.getTime() - 89 * day)),
      auditRow(T0),
    ];

    const result = await h.service.purgeAudit();

    expect(result.cutoff).toEqual(cutoff);
    expect(result.deleted).toBe(2);
    expect(h.audit.rows).toHaveLength(3);
    expect(h.audit.cutoffs).toEqual([cutoff]);
  });

  it("is idempotent: a second run with nothing expired deletes nothing", async () => {
    const h = createHarness();
    h.audit.rows = [auditRow(new Date(T0.getTime() - 100 * day))];

    expect((await h.service.purgeAudit()).deleted).toBe(1);
    expect((await h.service.purgeAudit()).deleted).toBe(0);
    expect(h.audit.rows).toHaveLength(0);
  });
});
