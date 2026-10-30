import { describe, expect, it } from "vitest";

import { isMcpEnabled, isMcpOriginAllowed, mcpResourceUrl } from "./config";

describe("isMcpEnabled", () => {
  it("is off by default", () => {
    expect(isMcpEnabled({})).toBe(false);
    expect(isMcpEnabled({ MCP_ENABLED: "false" })).toBe(false);
  });

  it("accepts MCP_ENABLED", () => {
    expect(isMcpEnabled({ MCP_ENABLED: "true" })).toBe(true);
  });

  it("still accepts the harness flag MCP_SPIKE_ENABLED so OAuth plugin and route stay paired", () => {
    expect(isMcpEnabled({ MCP_SPIKE_ENABLED: "true" })).toBe(true);
  });
});

describe("mcpResourceUrl", () => {
  it("strips trailing slashes from BETTER_AUTH_URL", () => {
    expect(
      mcpResourceUrl({ BETTER_AUTH_URL: "https://app.example.com//" }),
    ).toBe("https://app.example.com/api/mcp");
  });
});

describe("isMcpOriginAllowed", () => {
  const env = {
    BETTER_AUTH_URL: "https://app.example.com",
    MCP_ALLOWED_ORIGINS: "https://a.example, https://b.example",
    MCP_SPIKE_ALLOWED_ORIGINS: "https://legacy.example",
  };

  it("allows requests without Origin (non-browser clients)", () => {
    expect(isMcpOriginAllowed(null, env)).toBe(true);
  });

  it("allows default web clients, own base URL, and configured origins", () => {
    for (const origin of [
      "https://claude.ai",
      "https://app.example.com",
      "https://a.example",
      "https://b.example",
      "https://legacy.example",
    ]) {
      expect(isMcpOriginAllowed(origin, env)).toBe(true);
    }
  });

  it("rejects any other Origin", () => {
    expect(isMcpOriginAllowed("https://evil.example", env)).toBe(false);
    expect(isMcpOriginAllowed("http://localhost:3000", {})).toBe(false);
  });

  it("does not treat an empty BETTER_AUTH_URL as an allowed empty origin", () => {
    expect(isMcpOriginAllowed("", {})).toBe(true); // "" == no header
  });
});
