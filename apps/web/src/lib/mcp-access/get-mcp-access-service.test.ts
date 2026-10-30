import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemberStatus,
  asUserId,
  asWorkspaceId,
  type McpGrantId,
} from "@postific/shared";

const { getMember, findActiveByConnection } = vi.hoisted(() => ({
  getMember: vi.fn(),
  findActiveByConnection: vi.fn(),
}));

vi.mock("@/lib/repositories/workspace", () => ({
  workspaceRepository: { getMember },
}));

vi.mock("@/lib/repositories/mcp-access", () => ({
  mcpGrantRepository: {
    findActiveByConnection,
    touchLastUsed: vi.fn(),
  },
  mcpAuditRepository: {},
  mcpGrantRevocationAdapter: {},
}));

import { getMcpAccessService } from "./get-mcp-access-service";

const WS = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const USER = asUserId("user-1");

describe("getMcpAccessService (composition root)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("memeriksa keanggotaan lewat WorkspaceService.getMembership yang memakai workspaceRepository.getMember", async () => {
    findActiveByConnection.mockResolvedValue({
      id: "grant-1" as McpGrantId,
      workspaceId: WS,
      userId: USER,
      clientId: "client-1",
      clientName: null,
      scopes: ["read"],
      createdAt: new Date("2026-10-26T00:00:00Z"),
      lastUsedAt: new Date(),
      revokedAt: null,
    });
    getMember.mockResolvedValue({ status: MemberStatus.Active });

    const authorized = await getMcpAccessService().authorizeCall({
      userId: USER,
      clientId: "client-1",
      workspaceId: WS,
      tokenScopes: ["read"],
      requiredScope: "read",
    });

    expect(getMember).toHaveBeenCalledWith(WS, USER);
    expect(authorized.workspaceId).toBe(WS);
  });

  it("menolak bila workspaceRepository.getMember tidak menemukan member", async () => {
    findActiveByConnection.mockResolvedValue({
      id: "grant-1" as McpGrantId,
      workspaceId: WS,
      userId: USER,
      clientId: "client-1",
      clientName: null,
      scopes: ["read"],
      createdAt: new Date("2026-10-26T00:00:00Z"),
      lastUsedAt: new Date(),
      revokedAt: null,
    });
    getMember.mockResolvedValue(null);

    await expect(
      getMcpAccessService().authorizeCall({
        userId: USER,
        clientId: "client-1",
        workspaceId: WS,
        tokenScopes: ["read"],
        requiredScope: "read",
      }),
    ).rejects.toMatchObject({ reason: "not_workspace_member" });
  });
});
