import { NextResponse } from "next/server";

import {
  MCP_SCOPES,
  mcpBaseUrl,
  mcpResourceUrl,
  mcpSpikeEnabled,
} from "@/lib/better-auth/mcp-spike";

// T-148 (spike MCP) — Protected Resource Metadata RFC 9728 untuk /api/mcp.
export const dynamic = "force-dynamic";

export function GET() {
  if (!mcpSpikeEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({
    resource: mcpResourceUrl(),
    authorization_servers: [mcpBaseUrl()],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
  });
}
