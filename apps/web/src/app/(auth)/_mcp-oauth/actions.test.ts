import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCachedSession, chooseWorkspace, isMcpEnabled } = vi.hoisted(() => ({
  getCachedSession: vi.fn(),
  chooseWorkspace: vi.fn(),
  isMcpEnabled: vi.fn(),
}));

vi.mock("@/lib/better-auth/session", () => ({ getCachedSession }));
vi.mock("@/lib/mcp/config", () => ({ isMcpEnabled }));
vi.mock("@/lib/mcp-access/get-mcp-consent-service", () => ({
  getMcpConsentService: () => ({ chooseWorkspace }),
}));

import { McpAccessDeniedError } from "@/domains/mcp-access";
import { chooseWorkspaceAction } from "./actions";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";

describe("chooseWorkspaceAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isMcpEnabled.mockReturnValue(true);
    getCachedSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { id: "sess-1" },
    });
  });

  it("stores the choice for the caller's own session and user", async () => {
    chooseWorkspace.mockResolvedValue(undefined);

    await expect(chooseWorkspaceAction(WORKSPACE)).resolves.toEqual({
      ok: true,
    });
    expect(chooseWorkspace).toHaveBeenCalledWith({
      sessionId: "sess-1",
      userId: "user-1",
      workspaceId: WORKSPACE,
    });
  });

  it("rejects when there is no session", async () => {
    getCachedSession.mockResolvedValue(null);

    const result = await chooseWorkspaceAction(WORKSPACE);

    expect(result.ok).toBe(false);
    expect(chooseWorkspace).not.toHaveBeenCalled();
  });

  it("rejects when MCP is disabled", async () => {
    isMcpEnabled.mockReturnValue(false);

    const result = await chooseWorkspaceAction(WORKSPACE);

    expect(result.ok).toBe(false);
    expect(chooseWorkspace).not.toHaveBeenCalled();
  });

  it("rejects a malformed workspace id before touching the database", async () => {
    const result = await chooseWorkspaceAction("ws; DROP TABLE");

    expect(result).toEqual({ ok: false, error: "Workspace tidak valid." });
    expect(chooseWorkspace).not.toHaveBeenCalled();
  });

  it("explains when the user is no longer an active member", async () => {
    chooseWorkspace.mockRejectedValue(
      new McpAccessDeniedError("not_workspace_member"),
    );

    await expect(chooseWorkspaceAction(WORKSPACE)).resolves.toEqual({
      ok: false,
      error: "Anda bukan lagi anggota aktif workspace ini.",
    });
  });

  it("maps unexpected failures to a retryable message without leaking details", async () => {
    chooseWorkspace.mockRejectedValue(new Error("connection refused 10.0.0.5"));

    const result = await chooseWorkspaceAction(WORKSPACE);

    expect(result).toEqual({
      ok: false,
      error: "Pilihan workspace gagal disimpan. Coba lagi.",
    });
  });
});
