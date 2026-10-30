import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  McpAccessDeniedError,
  McpRateLimitExceededError,
  type McpAccessService,
  type McpAuditStatus,
} from "@/domains/mcp-access";
import { PublishingDomainError } from "@/domains/publishing";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";

import type { McpClaims } from "./claims";
import { McpInvalidCursorError } from "./cursor";
import { McpToolInputError, McpToolTemporaryError } from "./tool-input";
import type { McpToolServices, McpToolDefinition } from "./tool-types";

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

/** Batas tunggu audit di jalur respons; audit tidak boleh menahan hasil tool. */
const AUDIT_TIMEOUT_MS = 2000;

/**
 * Audit penolakan `rate_limited` dibatasi satu baris per workspace, klien, dan
 * kuota per menit (per proses): klien yang terus mencoba setelah ditolak tidak
 * menambah baris `mcp_audit_logs` tanpa batas.
 */
const RATE_LIMIT_AUDIT_INTERVAL_MS = 60_000;
const RATE_LIMIT_AUDIT_MAX_KEYS = 1000;
const rateLimitAuditedAt = new Map<string, number>();

function shouldAuditRateLimit(key: string, nowMs: number): boolean {
  const last = rateLimitAuditedAt.get(key);
  if (last !== undefined && nowMs - last < RATE_LIMIT_AUDIT_INTERVAL_MS) {
    return false;
  }
  if (rateLimitAuditedAt.size >= RATE_LIMIT_AUDIT_MAX_KEYS) {
    for (const [k, at] of rateLimitAuditedAt) {
      if (nowMs - at >= RATE_LIMIT_AUDIT_INTERVAL_MS) {
        rateLimitAuditedAt.delete(k);
      }
    }
  }
  rateLimitAuditedAt.set(key, nowMs);
  return true;
}

export interface McpGateDeps {
  access: Pick<McpAccessService, "authorizeCall" | "recordAudit">;
  services: McpToolServices;
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
  | "conflict"
  | "rate_limited"
  | "temporarily_unavailable"
  | "internal_error";

/** Rincian tambahan error `rate_limited` (T-154); klien memakai `retryAfterSeconds`. */
export interface McpRateLimitedDetails {
  retryAfterSeconds: number;
  quota: string;
  limit: number;
}

function jsonResult(payload: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

export function mcpErrorResult(
  code: McpErrorCode,
  message: string,
  details?: McpRateLimitedDetails,
): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: { code, message, ...details } }),
      },
    ],
  };
}

interface Failure {
  code: McpErrorCode;
  message: string;
  status: McpAuditStatus;
  details?: McpRateLimitedDetails;
}

function rateLimitFailure(error: McpRateLimitExceededError): Failure {
  return {
    code: "rate_limited",
    message: error.message,
    status: "denied",
    details: {
      retryAfterSeconds: error.retryAfterSeconds,
      quota: error.quota,
      limit: error.limit,
    },
  };
}

function classify(error: unknown): Failure | null {
  if (error instanceof McpRateLimitExceededError) {
    return rateLimitFailure(error);
  }
  if (error instanceof McpToolInputError) {
    return { code: "invalid_input", message: error.message, status: "error" };
  }
  if (error instanceof McpToolTemporaryError) {
    return {
      code: "temporarily_unavailable",
      message: error.message,
      status: "error",
    };
  }
  if (error instanceof McpInvalidCursorError) {
    return { code: "invalid_cursor", message: error.message, status: "error" };
  }
  if (error instanceof NotFoundError) {
    return { code: "not_found", message: error.message, status: "error" };
  }
  // Aturan domain tulis (T-152): input tidak valid menurut matriks format,
  // batas media, kepemilikan akun/media, dsb. Pesannya aman dan memang untuk
  // ditampilkan ke AI klien supaya bisa memperbaiki panggilannya.
  if (
    error instanceof ValidationError ||
    error instanceof PublishingDomainError
  ) {
    return { code: "invalid_input", message: error.message, status: "error" };
  }
  if (error instanceof ConflictError) {
    return { code: "conflict", message: error.message, status: "error" };
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const write = deps.access.recordAudit({
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
      write.catch(() => undefined);
      await Promise.race([
        write,
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            logger.error("[mcp] audit melewati batas waktu", {
              tool: tool.name,
              workspaceId: claims.workspaceId,
            });
            resolve();
          }, AUDIT_TIMEOUT_MS);
        }),
      ]);
    } catch (auditError) {
      logger.error("[mcp] audit gagal ditulis", {
        tool: tool.name,
        workspaceId: claims.workspaceId,
        error: auditError,
      });
    } finally {
      clearTimeout(timer);
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
    if (error instanceof McpRateLimitExceededError) {
      const failure = rateLimitFailure(error);
      if (
        shouldAuditRateLimit(
          `${claims.workspaceId}:${claims.clientId}:${error.quota}`,
          now(),
        )
      ) {
        await audit({
          grantId: error.grantId,
          status: failure.status,
          errorCode: failure.code,
        });
      }
      return mcpErrorResult(failure.code, failure.message, failure.details);
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
        clientId: authorized.clientId,
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
      return mcpErrorResult(failure.code, failure.message, failure.details);
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
