import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemberRole,
  MemberStatus,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";

const {
  getMember,
  listWorkspacesForUser,
  countByWorkspace,
  upsert,
  findFirstChoice,
} = vi.hoisted(() => ({
  getMember: vi.fn(),
  listWorkspacesForUser: vi.fn(),
  countByWorkspace: vi.fn(),
  upsert: vi.fn(),
  findFirstChoice: vi.fn(),
}));

vi.mock("@/lib/repositories/workspace", () => ({
  workspaceRepository: {
    getMember,
    listWorkspacesForUser,
    countActiveConnectedAccountsByWorkspace: countByWorkspace,
  },
}));

vi.mock("@/lib/repositories/mcp-access", () => ({
  mcpWorkspaceChoiceRepository: { upsert, findActive: findFirstChoice },
  mcpClientIdentityRepository: { findRegistration: vi.fn() },
}));

import { getMcpConsentService } from "./get-mcp-consent-service";

const WS = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const USER = asUserId("user-1");

describe("getMcpConsentService (composition root)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("checks membership through WorkspaceService.getMembership before storing a choice", async () => {
    getMember.mockResolvedValue({
      status: MemberStatus.Active,
      role: MemberRole.Owner,
    });
    upsert.mockResolvedValue({});

    await getMcpConsentService().chooseWorkspace({
      sessionId: "sess-1",
      userId: USER,
      workspaceId: WS,
    });

    expect(getMember).toHaveBeenCalledWith(WS, USER);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("refuses and stores nothing when the user is not an active member", async () => {
    getMember.mockResolvedValue({ status: MemberStatus.Pending });

    await expect(
      getMcpConsentService().chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS,
      }),
    ).rejects.toMatchObject({ reason: "not_workspace_member" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("lists selectable workspaces from the workspace repository", async () => {
    listWorkspacesForUser.mockResolvedValue([]);
    countByWorkspace.mockResolvedValue(new Map());

    await expect(
      getMcpConsentService().listSelectableWorkspaces(USER),
    ).resolves.toEqual([]);
    expect(listWorkspacesForUser).toHaveBeenCalledWith(USER);
  });
});
