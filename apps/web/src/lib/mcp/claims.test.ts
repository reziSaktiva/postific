import { describe, expect, it } from "vitest";

import { readMcpClaims } from "./claims";

describe("readMcpClaims", () => {
  it("maps sub, azp, workspace_id and keeps only logical MCP scopes", () => {
    const claims = readMcpClaims({
      sub: "user-1",
      azp: "client-1",
      workspace_id: "ws-1",
      scope: "openid offline_access mcp:read mcp:schedule mcp:unknown",
    });
    expect(claims).toEqual({
      userId: "user-1",
      clientId: "client-1",
      workspaceId: "ws-1",
      scopes: ["read", "schedule"],
    });
  });

  it("returns null when workspace_id, sub or azp is missing", () => {
    const base = { sub: "u", azp: "c", workspace_id: "w", scope: "mcp:read" };
    expect(readMcpClaims({ ...base, workspace_id: undefined })).toBeNull();
    expect(readMcpClaims({ ...base, sub: undefined })).toBeNull();
    expect(readMcpClaims({ ...base, azp: "" })).toBeNull();
  });

  it("treats a missing scope claim as no scopes", () => {
    expect(
      readMcpClaims({ sub: "u", azp: "c", workspace_id: "w" })?.scopes,
    ).toEqual([]);
  });
});
