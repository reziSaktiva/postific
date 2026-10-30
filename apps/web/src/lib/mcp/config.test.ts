import { describe, expect, it } from "vitest";

import {
  getMcpRateLimitConfig,
  isMcpEnabled,
  isMcpOriginAllowed,
  MCP_RATE_LIMIT_DEFAULTS,
  mcpResourceUrl,
} from "./config";

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

describe("getMcpRateLimitConfig", () => {
  it("defaults to 60 calls/min, 30 writes/hour, 50 scheduled contents/day", () => {
    expect(getMcpRateLimitConfig({})).toEqual({
      calls: 60,
      write_actions: 30,
      scheduled_contents: 50,
    });
    expect(MCP_RATE_LIMIT_DEFAULTS).toEqual(getMcpRateLimitConfig({}));
  });

  it("lets env override each limit", () => {
    expect(
      getMcpRateLimitConfig({
        MCP_RATE_LIMIT_CALLS_PER_MINUTE: "120",
        MCP_RATE_LIMIT_WRITES_PER_HOUR: " 10 ",
        MCP_RATE_LIMIT_SCHEDULED_CONTENTS_PER_DAY: "5",
      }),
    ).toEqual({ calls: 120, write_actions: 10, scheduled_contents: 5 });
  });

  it("accepts the int4 maximum but rejects anything above it (counter is int4)", () => {
    expect(
      getMcpRateLimitConfig({ MCP_RATE_LIMIT_CALLS_PER_MINUTE: "2147483647" })
        .calls,
    ).toBe(2147483647);
    expect(
      getMcpRateLimitConfig({ MCP_RATE_LIMIT_CALLS_PER_MINUTE: "2147483648" })
        .calls,
    ).toBe(60);
  });

  it.each(["0", "-5", "abc", "1.5", "", "1e3", "99999999999999999999"])(
    "ignores invalid env value %j and keeps the default",
    (bad) => {
      expect(
        getMcpRateLimitConfig({ MCP_RATE_LIMIT_CALLS_PER_MINUTE: bad }).calls,
      ).toBe(60);
    },
  );
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
