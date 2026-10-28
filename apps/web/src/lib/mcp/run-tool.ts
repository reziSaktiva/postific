import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  McpAccessDeniedError,
  type McpAccessService,
  type McpAuditStatus,
} from "@/domains/mcp-access";
import { NotFoundError } from "@/lib/utils/errors";

import type { McpClaims } from "./claims";
import { McpInvalidCursorError } from "./cursor";
import { McpToolInputError } from "./tool-input";
import type { McpReadServices, McpToolDefinition } from "./tool-types";

/**
 * Gerbang satu panggilan tool MCP (T-150.2): `authorizeCall` -> handler ->
 * `recordAudit`. Menegakkan kontrak `McpAccessService.recordAudit`:
 *
 * - Penolakan selalu error (`isError`), tidak pernah data kosong.
 * - Kegagalan `recordAudit` (DB, FK workspace terhapus, validasi) ditangkap dan
 *   dicatat di log server; TIDAK mengubah keputusan: yang ditolak tetap
 *   ditolak, yang lolos tidak dibatalkan.
 * - Gagal otorisasi karena sebab selain penolakan (mis. DB mati) juga ditolak
 *   (fail closed) sebagai `internal_error`.
 */

export interface McpGateDeps {
  access: Pick<McpAccessService, "authorizeCall" | "recordAudit">;
  services: McpReadServices;
  now?: () => number;
  logger?: Pick<Console, "error">;
}

export type McpErrorCode =
  | "no_active_grant"
  | "token_scope_insufficient"
  | "grant_scope_insufficient"
  | "not_workspace_member"
  | "invalid_input"
  | "invalid_cursor"
  | "not_found"
  | "internal_error";

function jsonResult(payload: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

export function mcpErrorResult(
  code: McpErrorCode,
  message: string,
): CallToolResult {
  return {
    isError: true,
    content: [
      { type: "text", text: JSON.stringify({ error: { code, message } }) },
    ],
  };
}

interface Failure {
  code: McpErrorCode;
  message: string;
  status: McpAuditStatus;
}

function classify(error: unknown): Failure | null {
  if (error instanceof McpToolInputError) {
    return { code: "invalid_input", message: error.message, status: "error" };
  }
  if (error instanceof McpInvalidCursorError) {
    return { code: "invalid_cursor", message: error.message, status: "error" };
  }
  if (error instanceof NotFoundError) {
    return { code: "not_found", message: error.message, status: "error" };
  }
  return null;
}

export async function runMcpTool(
  deps: McpGateDeps,
  claims: McpClaims,
  tool: McpToolDefinition,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? console;
  const startedAt = now();

  const audit = async (entry: {
    grantId?: Parameters<McpGateDeps["access"]["recordAudit"]>[0]["grantId"];
    status: McpAuditStatus;
    errorCode?: string;
    targetId?: string;
  }): Promise<void> => {
    try {
      await deps.access.recordAudit({
        workspaceId: claims.workspaceId,
        userId: claims.userId,
        grantId: entry.grantId ?? null,
        clientId: claims.clientId,
        toolName: tool.name,
        scope: tool.scope,
        toolInput: args,
        status: entry.status,
        errorCode: entry.errorCode ?? null,
        durationMs: now() - startedAt,
        targetId: entry.targetId ?? null,
      });
    } catch (auditError) {
      logger.error("[mcp] audit gagal ditulis", {
        tool: tool.name,
        workspaceId: claims.workspaceId,
        error: auditError,
      });
    }
  };

  let authorized;
  try {
    authorized = await deps.access.authorizeCall({
      userId: claims.userId,
      clientId: claims.clientId,
      workspaceId: claims.workspaceId,
      tokenScopes: claims.scopes,
      requiredScope: tool.scope,
    });
  } catch (error) {
    if (error instanceof McpAccessDeniedError) {
      await audit({
        grantId: error.grantId,
        status: "denied",
        errorCode: error.code,
      });
      return mcpErrorResult(error.code, error.message);
    }
    logger.error("[mcp] otorisasi gagal (ditolak, fail closed)", {
      tool: tool.name,
      error,
    });
    await audit({ status: "error", errorCode: "internal_error" });
    return mcpErrorResult(
      "internal_error",
      "Otorisasi tidak dapat diselesaikan. Coba lagi nanti.",
    );
  }

  try {
    const output = await tool.handler(
      {
        workspaceId: authorized.workspaceId,
        userId: authorized.userId,
        grantScopes: authorized.grantScopes,
        services: deps.services,
      },
      args,
    );
    await audit({
      grantId: authorized.grantId,
      status: "success",
      ...(output.targetId ? { targetId: output.targetId } : {}),
    });
    return jsonResult(output.data);
  } catch (error) {
    const failure = classify(error);
    if (failure) {
      await audit({
        grantId: authorized.grantId,
        status: failure.status,
        errorCode: failure.code,
      });
      return mcpErrorResult(failure.code, failure.message);
    }
    logger.error("[mcp] tool gagal", { tool: tool.name, error });
    await audit({
      grantId: authorized.grantId,
      status: "error",
      errorCode: "internal_error",
    });
    return mcpErrorResult(
      "internal_error",
      "Terjadi kesalahan saat memproses permintaan. Coba lagi nanti.",
    );
  }
}
