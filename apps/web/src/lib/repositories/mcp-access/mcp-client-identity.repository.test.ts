import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, executeRaw } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    oauthClient: { findUnique },
    $executeRaw: executeRaw,
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

    function sqlOf(call: unknown[]): string {
      return (call[0] as string[]).join("?");
    }

    it("deletes in one atomic statement that excludes every kind of use", async () => {
      executeRaw.mockResolvedValueOnce(3);

      await expect(
        mcpClientIdentityRepository.deleteUnusedRegistrations(CUTOFF),
      ).resolves.toBe(3);

      expect(executeRaw).toHaveBeenCalledTimes(1);
      const sql = sqlOf(executeRaw.mock.calls[0]);
      expect(sql).toContain("DELETE FROM identity_oauth_client");
      expect(sql).toContain('"userId" IS NULL');
      for (const table of [
        "identity_oauth_consent",
        "identity_oauth_refresh_token",
        "identity_oauth_access_token",
        "mcp_grants",
      ]) {
        expect(sql).toMatch(new RegExp(`NOT EXISTS \\([^)]*${table}`));
      }
      expect(executeRaw.mock.calls[0]).toContain(CUTOFF);
    });

    it("keeps going while batches are full and stops at the first partial batch", async () => {
      executeRaw
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(7);

      await expect(
        mcpClientIdentityRepository.deleteUnusedRegistrations(CUTOFF),
      ).resolves.toBe(1007);
      expect(executeRaw).toHaveBeenCalledTimes(3);
    });

    it("caps the work per run", async () => {
      executeRaw.mockResolvedValue(500);

      await expect(
        mcpClientIdentityRepository.deleteUnusedRegistrations(CUTOFF),
      ).resolves.toBe(500 * 20);
      expect(executeRaw).toHaveBeenCalledTimes(20);
    });

    it("returns 0 when nothing is deletable (idempotent)", async () => {
      executeRaw.mockResolvedValueOnce(0);

      await expect(
        mcpClientIdentityRepository.deleteUnusedRegistrations(CUTOFF),
      ).resolves.toBe(0);
      expect(executeRaw).toHaveBeenCalledTimes(1);
    });
  });
});
