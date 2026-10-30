import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { oauthClient: { findUnique } },
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
});
