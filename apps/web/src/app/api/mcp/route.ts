import { mcpHandler } from "@better-auth/oauth-provider";

import {
  mcpBaseUrl,
  mcpResourceUrl,
  mcpSpikeEnabled,
} from "@/lib/better-auth/mcp-spike";
import { handleSpikeMcpRequest } from "@/lib/mcp-spike/server";

// T-148 (spike MCP) — SEMENTARA. Route Handler tipis: validasi Origin, verifikasi
// JWT, lalu serahkan ke lib/mcp-spike. Digantikan T-150.
export const dynamic = "force-dynamic";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://claude.ai",
  "https://www.claude.ai",
  "https://claude.com",
];

function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true; // klien non-browser (Claude Code, SDK) tidak mengirim Origin
  }
  const extra = process.env.MCP_SPIKE_ALLOWED_ORIGINS?.split(",") ?? [];
  const allowed = [...DEFAULT_ALLOWED_ORIGINS, mcpBaseUrl(), ...extra]
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

async function handle(request: Request): Promise<Response> {
  if (!mcpSpikeEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  if (!isOriginAllowed(request)) {
    console.warn("[mcp-spike] Origin ditolak", request.headers.get("origin"));
    return new Response("Origin tidak diizinkan", { status: 403 });
  }

  const base = mcpBaseUrl();
  return mcpHandler(
    {
      jwksUrl: `${base}/api/auth/jwks`,
      verifyOptions: { issuer: base, audience: mcpResourceUrl() },
    },
    handleSpikeMcpRequest,
  )(request);
}

export { handle as GET, handle as POST, handle as DELETE };
