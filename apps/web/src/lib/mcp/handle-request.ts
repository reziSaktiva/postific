import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { JWTPayload } from "jose";

import { getMcpAccessService } from "@/lib/mcp-access/get-mcp-access-service";

import { readMcpClaims } from "./claims";
import { getMcpReadServices } from "./get-mcp-read-services";
import { createMcpServer } from "./server";

/**
 * Handler untuk `mcpHandler` (`@better-auth/oauth-provider`) setelah JWT valid
 * (T-150.2). Memisahkan composition root (Prisma, Outstand) dari builder
 * server murni di `server.ts` supaya builder bisa dites tanpa database.
 */
export async function handleMcpRequest(
  request: Request,
  jwt: JWTPayload,
): Promise<Response> {
  const claims = readMcpClaims(jwt);
  if (!claims) {
    return new Response("Token tanpa workspace_id, sub, atau azp.", {
      status: 403,
    });
  }

  const server = createMcpServer(claims, {
    access: getMcpAccessService(),
    services: getMcpReadServices(),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
