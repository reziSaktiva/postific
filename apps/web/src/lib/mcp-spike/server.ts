import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { JWTPayload } from "jose";
import { asUserId, asWorkspaceId } from "@postific/shared";

import { WorkspaceService } from "@/domains/workspace";
import { workspaceRepository } from "@/lib/repositories/workspace";

import {
  authorizeSpikeCall,
  readClaims,
  type SpikeAuthorizeDeps,
  type SpikeClaims,
} from "./authorize";
import { getSpikeGrantStore } from "./grant-store";

/**
 * T-148 (spike MCP) — SEMENTARA, dibuang oleh T-149/T-150. Membuktikan tiga
 * hal di HTTPS nyata: klaim `workspace_id` ada di JWT, validasi member dan
 * grant di DB tiap panggilan, dan scope kustom benar-benar membatasi tool.
 */

const workspaceService = new WorkspaceService(workspaceRepository);

// T-149.2: grant (bukan consent plugin) adalah sumber otorisasi. Store di
// memori sementara menggantikan tabel `mcp_grants` (T-149.3).
const authorizeDeps: SpikeAuthorizeDeps = {
  getMembership: (workspaceId, userId) =>
    workspaceService.getMembership(
      asWorkspaceId(workspaceId),
      asUserId(userId),
    ),
  findActiveGrant: (key) => getSpikeGrantStore().findActive(key),
};

function authorize(
  claims: SpikeClaims,
  requiredScope: string,
): Promise<string | null> {
  return authorizeSpikeCall(authorizeDeps, claims, requiredScope);
}

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function guardedTool(
  claims: SpikeClaims,
  requiredScope: string,
  run: () => Promise<unknown>,
) {
  return async () => {
    const denied = await authorize(claims, requiredScope);
    return denied ? errorResult(denied) : textResult(await run());
  };
}

function buildServer(claims: SpikeClaims): McpServer {
  const server = new McpServer({ name: "postific-spike", version: "0.0.1" });

  server.registerTool(
    "get_workspace",
    {
      description:
        "Spike T-148: nama workspace yang terikat ke koneksi ini (scope mcp:read).",
    },
    guardedTool(claims, "mcp:read", async () => {
      const workspace = await workspaceService.getWorkspaceById(
        asWorkspaceId(claims.workspaceId),
      );
      return {
        workspaceId: claims.workspaceId,
        name: workspace?.name ?? null,
        grantedScopes: claims.scopes,
      };
    }),
  );

  server.registerTool(
    "schedule_probe",
    {
      description:
        "Spike T-148: tidak menjadwalkan apa pun, hanya membuktikan gerbang scope mcp:schedule.",
    },
    guardedTool(claims, "mcp:schedule", async () => ({
      ok: true,
      note: "scope schedule diterima",
    })),
  );

  return server;
}

export async function handleSpikeMcpRequest(
  request: Request,
  jwt: JWTPayload,
): Promise<Response> {
  const claims = readClaims(jwt);
  if (!claims) {
    return new Response("Token tanpa workspace_id, sub, atau azp.", {
      status: 403,
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await buildServer(claims).connect(transport);
  return transport.handleRequest(request);
}
