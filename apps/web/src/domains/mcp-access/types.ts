/** Domain-specific types for mcp-access. */

import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";
import type { McpAuditStatus } from "./entities/mcp-audit-entry";
import type { McpScope } from "./value-objects/mcp-scope";

/** Jam yang diinjeksi ke service supaya perilaku berbasis waktu bisa dites. */
export type McpClock = () => Date;

/**
 * Konteks panggilan yang diteruskan ke hook rate limit (titik sambung T-154).
 * `McpAccessService.authorizeCall` memanggilnya setelah grant, scope, dan
 * member lolos, SEBELUM `last_used_at` diperbarui.
 */
export interface McpRateLimitContext {
  workspaceId: WorkspaceId;
  userId: UserId;
  clientId: string;
  grantId: McpGrantId;
  /** Scope yang dibutuhkan tool (`read` baca; `draft`/`schedule` tulis). */
  requiredScope: McpScope;
}

/**
 * Hook rate limit opsional (T-154 yang mengimplementasikan; T-149 hanya
 * menyediakan titik sambung). Melempar error bila batas terlampaui; kembali
 * normal bila boleh lanjut. Tanpa hook, `authorizeCall` tidak membatasi.
 */
export interface McpRateLimitHook {
  assertWithinLimit(context: McpRateLimitContext): Promise<void>;
}

/** Input `authorizeCall`; nilai diturunkan handler dari klaim token (`sub`, `azp`, workspace). */
export interface AuthorizeMcpCallInput {
  userId: UserId;
  clientId: string;
  workspaceId: WorkspaceId;
  /** Scope logis dari token (`parseMcpWireScopes` atas klaim `scope`). */
  tokenScopes: readonly McpScope[];
  /** Scope yang dibutuhkan tool yang dipanggil. */
  requiredScope: McpScope;
}

/** Hasil `authorizeCall` yang lolos; tidak pernah dikembalikan untuk panggilan ditolak (itu error). */
export interface McpAuthorizedCall {
  grantId: McpGrantId;
  userId: UserId;
  workspaceId: WorkspaceId;
  clientId: string;
  clientName: string | null;
  /** Scope grant di DB saat panggilan ini. */
  grantScopes: McpScope[];
}

export interface CreateMcpGrantInput {
  workspaceId: WorkspaceId;
  userId: UserId;
  clientId: string;
  clientName?: string | null;
  scopes: readonly McpScope[];
}

/** Input `ensureGrantFromConsent`: scope mentah (kabel) dari consent plugin. */
export interface EnsureGrantFromConsentInput {
  workspaceId: WorkspaceId;
  userId: UserId;
  clientId: string;
  clientName?: string | null;
  /** Scope consent apa adanya, mis. `["openid", "mcp:read", "mcp:draft"]`. */
  consentScopes: readonly string[];
}

export interface RecordMcpAuditInput {
  workspaceId: WorkspaceId;
  userId: UserId;
  /** Kosong bila ditolak karena tidak ada grant (`McpAccessDeniedError.grantId`). */
  grantId?: McpGrantId | null;
  clientId: string;
  toolName: string;
  scope: McpScope;
  /** Argumen mentah tool; service menyamarkannya (`summarizeToolInput`). */
  toolInput?: unknown;
  status: McpAuditStatus;
  errorCode?: string | null;
  durationMs?: number | null;
  targetId?: string | null;
}

export interface PurgeMcpAuditResult {
  deleted: number;
  /** Batas yang dipakai: baris dengan `created_at` sebelum ini dihapus. */
  cutoff: Date;
}
