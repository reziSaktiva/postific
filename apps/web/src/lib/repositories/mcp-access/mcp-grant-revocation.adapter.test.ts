import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";

const {
  grantUpdateMany,
  consentDeleteMany,
  refreshDeleteMany,
  transaction,
  calls,
} = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    grantUpdateMany: vi.fn(),
    consentDeleteMany: vi.fn(),
    refreshDeleteMany: vi.fn(),
    transaction: vi.fn(),
  };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: { $transaction: transaction },
}));

import { mcpGrantRevocationAdapter } from "./mcp-grant-revocation.adapter";

const INPUT = {
  grantId: "grant-1" as McpGrantId,
  userId: "user-1" as UserId,
  clientId: "client-1",
  workspaceId: "ws-1" as WorkspaceId,
  revokedAt: new Date("2026-10-26T12:00:00.000Z"),
};

describe("mcpGrantRevocationAdapter.revokeAtomically", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    calls.length = 0;
    const tx = {
      mcpGrant: { updateMany: grantUpdateMany },
      oauthConsent: { deleteMany: consentDeleteMany },
      oauthRefreshToken: { deleteMany: refreshDeleteMany },
    };
    // Tiruan $transaction: jalankan callback dengan tx palsu; tolak bila callback melempar.
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    );
    grantUpdateMany.mockImplementation(async () => {
      calls.push("grant");
      return { count: 1 };
    });
    consentDeleteMany.mockImplementation(async () => {
      calls.push("consent");
      return { count: 1 };
    });
    refreshDeleteMany.mockImplementation(async () => {
      calls.push("refresh");
      return { count: 1 };
    });
  });

  it("marks the grant revoked, then deletes consent and refresh token, all inside ONE transaction", async () => {
    const result = await mcpGrantRevocationAdapter.revokeAtomically(INPUT);

    expect(result).toEqual({ revoked: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["grant", "consent", "refresh"]);
    expect(grantUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "grant-1",
        userId: "user-1",
        clientId: "client-1",
        workspaceId: "ws-1",
        revokedAt: null,
      },
      data: { revokedAt: INPUT.revokedAt },
    });
  });

  it("scopes consent and refresh token deletion by clientId, userId AND referenceId = workspaceId", async () => {
    await mcpGrantRevocationAdapter.revokeAtomically(INPUT);

    const where = {
      where: { clientId: "client-1", userId: "user-1", referenceId: "ws-1" },
    };
    expect(consentDeleteMany).toHaveBeenCalledWith(where);
    expect(refreshDeleteMany).toHaveBeenCalledWith(where);
  });

  it("a mismatching key (grant of another user or connection) matches 0 rows and deletes nothing", async () => {
    // Tiruan DB: baris hanya cocok bila SEMUA kolom filter sama dengan baris grant.
    const stored = {
      id: "grant-1",
      userId: "user-1",
      clientId: "client-1",
      workspaceId: "ws-1",
      revokedAt: null as Date | null,
    };
    grantUpdateMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        const matches =
          where.id === stored.id &&
          where.userId === stored.userId &&
          where.clientId === stored.clientId &&
          where.workspaceId === stored.workspaceId &&
          where.revokedAt === stored.revokedAt;
        return { count: matches ? 1 : 0 };
      },
    );

    const result = await mcpGrantRevocationAdapter.revokeAtomically({
      ...INPUT,
      userId: "user-2" as UserId,
    });

    expect(result).toEqual({ revoked: false });
    expect(consentDeleteMany).not.toHaveBeenCalled();
    expect(refreshDeleteMany).not.toHaveBeenCalled();
  });

  it("does NOT delete consent or refresh token when the grant was already revoked", async () => {
    grantUpdateMany.mockImplementation(async () => {
      calls.push("grant");
      return { count: 0 };
    });

    const result = await mcpGrantRevocationAdapter.revokeAtomically(INPUT);

    expect(result).toEqual({ revoked: false });
    expect(calls).toEqual(["grant"]);
    expect(consentDeleteMany).not.toHaveBeenCalled();
    expect(refreshDeleteMany).not.toHaveBeenCalled();
  });

  it("propagates a failure in a later step so the transaction rolls back (no swallowed errors)", async () => {
    refreshDeleteMany.mockRejectedValue(new Error("deadlock"));

    await expect(
      mcpGrantRevocationAdapter.revokeAtomically(INPUT),
    ).rejects.toThrow("deadlock");
    expect(calls).toEqual(["grant", "consent"]);
  });
});
