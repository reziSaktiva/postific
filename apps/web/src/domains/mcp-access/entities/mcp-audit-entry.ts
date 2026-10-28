import type {
  McpAuditLogId,
  McpGrantId,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type { McpScope } from "../value-objects/mcp-scope";

/** Hasil satu panggilan tool (`mcp_audit_logs.status`). */
export type McpAuditStatus = "success" | "denied" | "error";

/** Daftar nilai sah `McpAuditStatus`; dipakai validasi runtime di service. */
export const MCP_AUDIT_STATUSES: readonly McpAuditStatus[] = [
  "success",
  "denied",
  "error",
];

export function isMcpAuditStatus(value: unknown): value is McpAuditStatus {
  return (
    typeof value === "string" &&
    (MCP_AUDIT_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * `McpAuditEntry` (BC-04; model Prisma `McpAuditLog`) — satu baris per
 * panggilan tool, berhasil maupun ditolak. Retensi 90 hari (JOB-08,
 * `MCP_AUDIT_RETENTION_DAYS`).
 *
 * `inputSummary` SELALU ringkasan tersamar (`summarizeToolInput`): tanpa
 * caption penuh dan tanpa URL berparameter rahasia (S-001).
 */
export interface McpAuditEntry {
  id: McpAuditLogId;
  workspaceId: WorkspaceId;
  userId: UserId;
  /** Kosong bila panggilan ditolak karena tidak ada grant. */
  grantId: McpGrantId | null;
  clientId: string;
  toolName: string;
  scope: McpScope;
  inputSummary: string | null;
  status: McpAuditStatus;
  errorCode: string | null;
  durationMs: number | null;
  /** ID hasil aksi, mis. `PostId`. */
  targetId: string | null;
  createdAt: Date;
}
