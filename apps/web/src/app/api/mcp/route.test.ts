import { beforeEach, describe, expect, it, vi } from "vitest";

const mcpHandlerMock = vi.hoisted(() => vi.fn());
vi.mock("@better-auth/oauth-provider", () => ({
  mcpHandler: (...args: unknown[]) => mcpHandlerMock(...args),
}));
vi.mock("@/lib/mcp/handle-request", () => ({
  handleMcpRequest: vi.fn(),
}));

import { DELETE, GET, POST } from "./route";

const BASE = "https://postific.test";

function request(init: RequestInit = {}): Request {
  return new Request(`${BASE}/api/mcp`, { method: "POST", ...init });
}

describe("/api/mcp route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mcpHandlerMock.mockReset();
    mcpHandlerMock.mockReturnValue(async () => new Response("ok"));
    vi.stubEnv("MCP_ENABLED", "true");
    vi.stubEnv("MCP_SPIKE_ENABLED", "");
    vi.stubEnv("BETTER_AUTH_URL", BASE);
  });

  it("returns 404 for POST, GET, and DELETE when the flag is off", async () => {
    vi.stubEnv("MCP_ENABLED", "");
    expect((await POST(request())).status).toBe(404);
    expect(GET().status).toBe(404);
    expect(DELETE().status).toBe(404);
    expect(mcpHandlerMock).not.toHaveBeenCalled();
  });

  it("returns 405 with Allow: POST for GET and DELETE when enabled", () => {
    for (const response of [GET(), DELETE()]) {
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("POST");
    }
  });

  it("returns 403 for a disallowed Origin before verifying the token", async () => {
    const response = await POST(
      request({ headers: { origin: "https://evil.example" } }),
    );
    expect(response.status).toBe(403);
    expect(mcpHandlerMock).not.toHaveBeenCalled();
  });

  it("returns 503 when BETTER_AUTH_URL is empty", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mcpHandlerMock).not.toHaveBeenCalled();
  });

  it("delegates to mcpHandler with the issuer, audience, and JWKS URL", async () => {
    const response = await POST(request({ headers: { origin: BASE } }));
    expect(response.status).toBe(200);
    expect(mcpHandlerMock).toHaveBeenCalledWith(
      {
        jwksUrl: `${BASE}/api/auth/jwks`,
        verifyOptions: { issuer: BASE, audience: `${BASE}/api/mcp` },
      },
      expect.any(Function),
    );
  });
});
