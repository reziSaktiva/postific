import { describe, expect, it, vi } from "vitest";

// Composition root memuat Prisma di level modul; tes ini hanya memeriksa
// penyambungan handler, jadi keduanya diganti.
vi.mock("@/lib/mcp-access/get-mcp-access-service", () => ({
  getMcpAccessService: () => ({}),
}));
vi.mock("./get-mcp-tool-services", () => ({
  getMcpToolServices: () => ({}),
}));

import { handleMcpRequest } from "./handle-request";

function post(body: unknown): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

describe("handleMcpRequest", () => {
  it("answers 403 for a token without workspace_id", async () => {
    const response = await handleMcpRequest(post({}), {
      sub: "u",
      azp: "c",
      scope: "mcp:read",
    });
    expect(response.status).toBe(403);
  });

  it("serves tools/list for a token with workspace_id", async () => {
    const response = await handleMcpRequest(
      post({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      { sub: "u", azp: "c", workspace_id: "w", scope: "mcp:read" },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { tools: unknown[] } };
    expect(body.result.tools).toHaveLength(11);
  });
});
