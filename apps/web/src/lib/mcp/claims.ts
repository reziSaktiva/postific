import type { JWTPayload } from "jose";
import { asUserId, asWorkspaceId } from "@postific/shared";
import type { UserId, WorkspaceId } from "@postific/shared";
import { parseMcpWireScopes, type McpScope } from "@/domains/mcp-access";

/** Klaim access token MCP yang dipakai gerbang otorisasi. */
export interface McpClaims {
  userId: UserId;
  clientId: string;
  /** Dari klaim `workspace_id` (`customAccessTokenClaims`, = `referenceId` consent). */
  workspaceId: WorkspaceId;
  /** Scope logis dari klaim `scope` (`mcp:read` -> `read`); scope non-MCP dibuang. */
  scopes: McpScope[];
}

/** `null` bila `sub`, `azp`, atau `workspace_id` tidak ada (token tidak bisa dipakai). */
export function readMcpClaims(jwt: JWTPayload): McpClaims | null {
  const sub = typeof jwt.sub === "string" ? jwt.sub : "";
  const azp = typeof jwt.azp === "string" ? jwt.azp : "";
  const workspaceId =
    typeof jwt.workspace_id === "string" ? jwt.workspace_id : "";
  if (!sub || !azp || !workspaceId) {
    return null;
  }
  const wireScopes =
    typeof jwt.scope === "string" ? jwt.scope.split(" ").filter(Boolean) : [];
  return {
    userId: asUserId(sub),
    clientId: azp,
    workspaceId: asWorkspaceId(workspaceId),
    scopes: parseMcpWireScopes(wireScopes),
  };
}
