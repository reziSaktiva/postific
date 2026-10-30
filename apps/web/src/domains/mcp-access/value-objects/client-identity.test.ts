import { describe, expect, it } from "vitest";
import { describeMcpClient, normalizeClientName } from "./client-identity";

describe("normalizeClientName", () => {
  it("returns null for missing, empty, or whitespace-only names", () => {
    expect(normalizeClientName(null)).toBeNull();
    expect(normalizeClientName(undefined)).toBeNull();
    expect(normalizeClientName("")).toBeNull();
    expect(normalizeClientName("   \n\t ")).toBeNull();
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeClientName("  Claude \n  Code  ")).toBe("Claude Code");
  });

  it("truncates very long self-asserted names with an ellipsis", () => {
    const result = normalizeClientName("A".repeat(200));
    expect(result).toHaveLength(80);
    expect(result?.endsWith("…")).toBe(true);
  });
});

describe("describeMcpClient", () => {
  it("treats a named client on a public https host as usual", () => {
    expect(
      describeMcpClient({
        name: "Claude",
        redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      }),
    ).toEqual({ name: "Claude", hosts: ["claude.ai"], isUnusual: false });
  });

  it("accepts a custom-scheme redirect with a real host (Claude Code app callback)", () => {
    expect(
      describeMcpClient({
        name: "Claude Code",
        redirectUris: ["claude://claude.ai/mcp-auth-callback/sdk"],
      }),
    ).toEqual({
      name: "Claude Code",
      hosts: ["claude.ai"],
      isUnusual: false,
    });
  });

  it("deduplicates hosts across redirect URIs, keeping order", () => {
    const identity = describeMcpClient({
      name: "Cursor",
      redirectUris: [
        "https://www.cursor.com/agents/mcp/oauth/callback",
        "https://www.cursor.com/other",
        "https://cursor.sh/cb",
      ],
    });
    expect(identity.hosts).toEqual(["www.cursor.com", "cursor.sh"]);
    expect(identity.isUnusual).toBe(false);
  });

  it("flags a client without a name even on a public host", () => {
    for (const name of [null, "", "   "]) {
      const identity = describeMcpClient({
        name,
        redirectUris: ["https://example.com/callback"],
      });
      expect(identity.name).toBeNull();
      expect(identity.isUnusual).toBe(true);
    }
  });

  it.each([
    [
      "localhost with port",
      "http://localhost:6274/oauth/callback",
      "localhost:6274",
    ],
    ["IPv4 loopback", "http://127.0.0.1:53682/callback", "127.0.0.1:53682"],
    ["IPv6 loopback", "http://[::1]:8080/cb", "[::1]:8080"],
    ["https IP literal", "https://203.0.113.7/cb", "203.0.113.7"],
    ["plain http on a public name", "http://claude.ai/cb", "claude.ai"],
    ["single-label internal name", "https://intranet/cb", "intranet"],
    ["*.local", "https://my-mac.local/cb", "my-mac.local"],
    ["*.internal", "https://tools.internal/cb", "tools.internal"],
  ])("flags an unusual host: %s", (_label, redirect, host) => {
    expect(
      describeMcpClient({ name: "Klien Uji", redirectUris: [redirect] }),
    ).toEqual({ name: "Klien Uji", hosts: [host], isUnusual: true });
  });

  it("flags the whole client when any redirect URI is unusual", () => {
    expect(
      describeMcpClient({
        name: "Mixed",
        redirectUris: ["https://claude.ai/cb", "http://localhost:3000/cb"],
      }).isUnusual,
    ).toBe(true);
  });

  it("flags unreadable or host-less redirect URIs and shows no host", () => {
    for (const redirect of ["not a url", "myapp:/callback", ""]) {
      expect(
        describeMcpClient({ name: "X", redirectUris: [redirect] }),
      ).toEqual({ name: "X", hosts: [], isUnusual: true });
    }
  });

  it("flags a client with no redirect URIs at all", () => {
    expect(describeMcpClient({ name: "X", redirectUris: [] })).toEqual({
      name: "X",
      hosts: [],
      isUnusual: true,
    });
  });

  it("is safe for an unknown client (null registration): unnamed, no host, unusual", () => {
    expect(describeMcpClient(null)).toEqual({
      name: null,
      hosts: [],
      isUnusual: true,
    });
  });
});
