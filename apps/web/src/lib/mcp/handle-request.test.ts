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
    expect(body.result.tools).toHaveLength(12);
  });

  it("answers 400 and logs the reason for a body that is not JSON-RPC (T-179.1)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await handleMcpRequest(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: "{caption: rahasia-pengguna\nbaris palsu",
      }),
      { sub: "u", azp: "c", workspace_id: "w", scope: "mcp:read" },
    );
    expect(response.status).toBe(400);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("transport menolak request"),
    );
    // Isi body tidak boleh masuk log (potongan teks dan baris baru dari klien).
    const logged = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).not.toContain("rahasia-pengguna");
    expect(logged).not.toContain("baris palsu");
    warn.mockRestore();
  });
});
