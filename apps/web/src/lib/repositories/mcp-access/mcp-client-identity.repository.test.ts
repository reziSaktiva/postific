import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, db } = vi.hoisted(() => {
  type Row = { clientId: string; userId: string | null; createdAt: Date };
  const state = {
    clients: [] as Row[],
    consents: [] as string[],
    refresh: [] as string[],
    access: [] as string[],
    grants: [] as string[],
  };
  // Tabel palsu berperilaku seperti filter Prisma yang dipakai repository.
  const inList = (ids: string[]) => ({
    findMany: async ({ where }: { where: { clientId: { in: string[] } } }) =>
      ids
        .filter((id) => where.clientId.in.includes(id))
        .map((clientId) => ({ clientId })),
  });
  const tx = {
    oauthClient: {
      findMany: async ({
        where,
        take,
      }: {
        where: { userId: null; createdAt: { lt: Date } };
        take: number;
      }) =>
        state.clients
          .filter((c) => c.userId === null && c.createdAt < where.createdAt.lt)
          .slice(0, take)
          .map(({ clientId }) => ({ clientId })),
      deleteMany: async ({
        where,
      }: {
        where: { clientId: { in: string[] } };
      }) => {
        const before = state.clients.length;
        state.clients = state.clients.filter(
          (c) => !where.clientId.in.includes(c.clientId),
        );
        return { count: before - state.clients.length };
      },
    },
    oauthConsent: inList([]),
    oauthRefreshToken: inList([]),
    oauthAccessToken: inList([]),
    mcpGrant: inList([]),
  };
  Object.defineProperties(tx, {
    oauthConsent: { get: () => inList(state.consents) },
    oauthRefreshToken: { get: () => inList(state.refresh) },
    oauthAccessToken: { get: () => inList(state.access) },
    mcpGrant: { get: () => inList(state.grants) },
  });
  return {
    findUnique: vi.fn(),
    db: { state, tx },
  };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    oauthClient: { findUnique },
    $transaction: async (fn: (tx: unknown) => Promise<number>) => fn(db.tx),
  },
}));

import { mcpClientIdentityRepository } from "./mcp-client-identity.repository";

describe("mcpClientIdentityRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reads only name and redirect URIs (never the client secret)", async () => {
    findUnique.mockResolvedValue({
      name: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    });

    const registration =
      await mcpClientIdentityRepository.findRegistration("client-1");

    expect(findUnique).toHaveBeenCalledWith({
      where: { clientId: "client-1" },
      select: { name: true, redirectUris: true },
    });
    expect(registration).toEqual({
      name: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    });
  });

  it("returns null for an unregistered client id", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      mcpClientIdentityRepository.findRegistration("ghost"),
    ).resolves.toBeNull();
  });

  describe("deleteUnusedRegistrations", () => {
    const CUTOFF = new Date("2026-11-01T00:00:00Z");
    const old = new Date("2026-10-01T00:00:00Z");
    const recent = new Date("2026-11-02T00:00:00Z");

    beforeEach(() => {
      db.state.clients = [];
      db.state.consents = [];
      db.state.refresh = [];
      db.state.access = [];
      db.state.grants = [];
    });

    it("deletes old ownerless clients nobody uses and keeps the rest", async () => {
      db.state.clients = [
        { clientId: "unused", userId: null, createdAt: old },
        { clientId: "has-consent", userId: null, createdAt: old },
        { clientId: "has-refresh", userId: null, createdAt: old },
        { clientId: "has-access", userId: null, createdAt: old },
        { clientId: "has-revoked-grant", userId: null, createdAt: old },
        { clientId: "owned", userId: "user-1", createdAt: old },
        { clientId: "too-new", userId: null, createdAt: recent },
      ];
      db.state.consents = ["has-consent"];
      db.state.refresh = ["has-refresh"];
      db.state.access = ["has-access"];
      db.state.grants = ["has-revoked-grant"];

      await expect(
        mcpClientIdentityRepository.deleteUnusedRegistrations(CUTOFF),
      ).resolves.toBe(1);
      expect(db.state.clients.map((c) => c.clientId)).toEqual([
        "has-consent",
        "has-refresh",
        "has-access",
        "has-revoked-grant",
        "owned",
        "too-new",
      ]);
    });

    it("returns 0 when nothing qualifies", async () => {
      await expect(
        mcpClientIdentityRepository.deleteUnusedRegistrations(CUTOFF),
      ).resolves.toBe(0);
    });
  });
});
