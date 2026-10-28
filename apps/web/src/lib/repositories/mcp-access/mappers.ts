import {
  asMcpAuditLogId,
  asMcpGrantId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import type {
  McpAuditEntry,
  McpAuditStatus,
  McpGrant,
  McpScope,
} from "@/domains/mcp-access";
import { isMcpScope, normalizeMcpScopes } from "@/domains/mcp-access";

/** Bentuk baris `mcp_grants` (model Prisma `McpGrant` dan hasil SQL mentah yang dipetakan ke camelCase). */
export interface McpGrantRow {
  id: string;
  workspaceId: string;
  userId: string;
  clientId: string;
  clientName: string | null;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/** Bentuk baris `mcp_audit_logs` (model Prisma `McpAuditLog`). */
export interface McpAuditRow {
  id: string;
  workspaceId: string;
  userId: string;
  grantId: string | null;
  clientId: string;
  toolName: string;
  scope: string;
  inputSummary: string | null;
  status: string;
  errorCode: string | null;
  durationMs: number | null;
  targetId: string | null;
  createdAt: Date;
}

/**
 * Kolom `scopes` adalah `text[]` bebas. Nilai di luar `McpScope` dibuang
 * (fail closed: scope tak dikenal tidak pernah menjadi izin), sisanya
 * dinormalkan ke urutan kanonikal.
 */
export function toMcpScopes(values: readonly string[]): McpScope[] {
  return normalizeMcpScopes(values.filter(isMcpScope));
}

export function toMcpGrant(row: McpGrantRow): McpGrant {
  return {
    id: asMcpGrantId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    userId: asUserId(row.userId),
    clientId: row.clientId,
    clientName: row.clientName,
    scopes: toMcpScopes(row.scopes),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}

export function toMcpAuditEntry(row: McpAuditRow): McpAuditEntry {
  return {
    id: asMcpAuditLogId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    userId: asUserId(row.userId),
    grantId: row.grantId === null ? null : asMcpGrantId(row.grantId),
    clientId: row.clientId,
    toolName: row.toolName,
    // Kolom `scope`/`status` adalah `text`; satu-satunya writer (service)
    // memvalidasi keduanya saat runtime di `recordAudit` (`isMcpScope`,
    // `isMcpAuditStatus`) sebelum menulis, jadi cast ini aman.
    scope: row.scope as McpScope,
    inputSummary: row.inputSummary,
    status: row.status as McpAuditStatus,
    errorCode: row.errorCode,
    durationMs: row.durationMs,
    targetId: row.targetId,
    createdAt: row.createdAt,
  };
}
