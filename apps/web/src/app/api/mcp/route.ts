import { mcpHandler } from "@better-auth/oauth-provider";

import {
  isMcpEnabled,
  isMcpOriginAllowed,
  mcpBaseUrl,
  mcpResourceUrl,
} from "@/lib/mcp/config";
import { handleMcpRequest } from "@/lib/mcp/handle-request";

// Endpoint MCP produksi (T-150, ADR-138/139). Route Handler tipis: flag,
// validasi Origin, verifikasi JWT lewat `mcpHandler`, lalu serahkan ke
// `lib/mcp`. Otorisasi per panggilan (grant, scope, member) dan audit ada di
// `McpAccessService` yang dipanggil `lib/mcp/run-tool.ts`.
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!isMcpEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  if (!isMcpOriginAllowed(request.headers.get("origin"))) {
    console.warn("[mcp] Origin ditolak", request.headers.get("origin"));
    return new Response("Origin tidak diizinkan", { status: 403 });
  }

  const base = mcpBaseUrl();
  if (!base) {
    console.error(
      "[mcp] BETTER_AUTH_URL kosong; endpoint MCP tidak dapat memverifikasi token",
    );
    return new Response("MCP belum dikonfigurasi", { status: 503 });
  }
  return mcpHandler(
    {
      jwksUrl: `${base}/api/auth/jwks`,
      verifyOptions: { issuer: base, audience: mcpResourceUrl() },
    },
    handleMcpRequest,
  )(request);
}

// Server stateless: GET membuka stream SSE standalone yang tidak pernah ditutup
// dan DELETE tidak punya sesi untuk dihapus, jadi keduanya 405 (pola SDK).
function methodNotAllowed(): Response {
  if (!isMcpEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export { handle as POST, methodNotAllowed as GET, methodNotAllowed as DELETE };
