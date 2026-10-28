import { describe, expect, it } from "vitest";
import {
  fromMcpWireScope,
  isMcpScope,
  normalizeMcpScopes,
  parseMcpWireScopes,
  scopesInclude,
  toMcpWireScope,
} from "./mcp-scope";

describe("McpScope wire mapping", () => {
  it("maps logical scopes to wire names and back", () => {
    expect(toMcpWireScope("read")).toBe("mcp:read");
    expect(toMcpWireScope("schedule")).toBe("mcp:schedule");
    expect(fromMcpWireScope("mcp:draft")).toBe("draft");
  });

  it("returns null for non-MCP and unknown wire scopes", () => {
    expect(fromMcpWireScope("openid")).toBeNull();
    expect(fromMcpWireScope("offline_access")).toBeNull();
    expect(fromMcpWireScope("mcp:publish")).toBeNull();
    expect(fromMcpWireScope("mcp:")).toBeNull();
  });

  it("parses a raw consent scope list, dropping non-MCP scopes", () => {
    expect(
      parseMcpWireScopes([
        "openid",
        "mcp:draft",
        "offline_access",
        "mcp:read",
        "mcp:read",
        "mcp:publish",
      ]),
    ).toEqual(["read", "draft"]);
  });

  it("returns an empty list when no MCP scope is present", () => {
    expect(parseMcpWireScopes(["openid", "profile"])).toEqual([]);
  });
});

describe("McpScope helpers", () => {
  it("recognises only the three logical scopes", () => {
    expect(isMcpScope("read")).toBe(true);
    expect(isMcpScope("publish")).toBe(false);
    expect(isMcpScope("mcp:read")).toBe(false);
    expect(isMcpScope(undefined)).toBe(false);
  });

  it("normalizes to canonical order without duplicates", () => {
    expect(normalizeMcpScopes(["schedule", "read", "schedule"])).toEqual([
      "read",
      "schedule",
    ]);
  });

  it("does not treat scopes as hierarchical", () => {
    expect(scopesInclude(["schedule"], "draft")).toBe(false);
    expect(scopesInclude(["read", "draft"], "draft")).toBe(true);
  });
});
