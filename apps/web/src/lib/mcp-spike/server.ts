import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { JWTPayload } from "jose";
import { asUserId, asWorkspaceId, MemberStatus } from "@postific/shared";

import { WorkspaceService } from "@/domains/workspace";
import { prisma } from "@/lib/prisma/client";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * T-148 (spike MCP) — SEMENTARA, dibuang oleh T-149/T-150. Membuktikan tiga
 * hal di HTTPS nyata: klaim `workspace_id` ada di JWT, validasi member dan
 * grant di DB tiap panggilan, dan scope kustom benar-benar membatasi tool.
 */

type SpikeClaims = {
  userId: string;
  workspaceId: string;
  clientId: string;
  scopes: string[];
};

function readClaims(jwt: JWTPayload): SpikeClaims | null {
  const userId = typeof jwt.sub === "string" ? jwt.sub : undefined;
  const clientId = typeof jwt.azp === "string" ? jwt.azp : undefined;
  const workspaceId =
    typeof jwt.workspace_id === "string" ? jwt.workspace_id : undefined;
  if (!userId || !clientId || !workspaceId) {
    return null;
  }
  const scopes = typeof jwt.scope === "string" ? jwt.scope.split(" ") : [];
  return { userId, workspaceId, clientId, scopes };
}

/** Member aktif dan grant (consent) masih ada. Dijalankan di setiap panggilan. */
async function assertStillAuthorized(claims: SpikeClaims): Promise<void> {
  const membership = await new WorkspaceService(
    workspaceRepository,
  ).getMembership(asWorkspaceId(claims.workspaceId), asUserId(claims.userId));
  if (!membership || membership.status !== MemberStatus.Active) {
    throw new Error("Bukan member aktif workspace ini.");
  }

  const grant = await prisma.oauthConsent.findFirst({
    where: {
      clientId: claims.clientId,
      userId: claims.userId,
      referenceId: claims.workspaceId,
    },
    select: { id: true },
  });
  if (!grant) {
    throw new Error("Akses klien ini sudah dicabut.");
  }
}

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function buildServer(claims: SpikeClaims): McpServer {
  const server = new McpServer({ name: "postific-spike", version: "0.0.1" });

  server.registerTool(
    "get_workspace",
    {
      description:
        "Spike T-148: nama workspace yang terikat ke koneksi ini (scope mcp:read).",
    },
    async () => {
      if (!claims.scopes.includes("mcp:read")) {
        return errorResult("Scope mcp:read tidak diberikan.");
      }
      try {
        await assertStillAuthorized(claims);
      } catch (error) {
        return errorResult((error as Error).message);
      }
      const workspace = await new WorkspaceService(
        workspaceRepository,
      ).getWorkspaceById(asWorkspaceId(claims.workspaceId));
      return textResult({
        workspaceId: claims.workspaceId,
        name: workspace?.name ?? null,
        grantedScopes: claims.scopes,
      });
    },
  );

  server.registerTool(
    "schedule_probe",
    {
      description:
        "Spike T-148: tidak menjadwalkan apa pun, hanya membuktikan gerbang scope mcp:schedule.",
    },
    async () => {
      if (!claims.scopes.includes("mcp:schedule")) {
        return errorResult("Scope mcp:schedule tidak diberikan.");
      }
      try {
        await assertStillAuthorized(claims);
      } catch (error) {
        return errorResult((error as Error).message);
      }
      return textResult({ ok: true, note: "scope schedule diterima" });
    },
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
