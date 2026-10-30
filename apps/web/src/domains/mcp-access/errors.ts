import type { McpGrantId } from "@postific/shared";
import { MCP_QUOTA_LABEL, type McpQuotaKind } from "./value-objects/rate-limit";

/** Domain error classes for mcp-access. */
export class McpAccessDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAccessDomainError";
  }
}

/**
 * Alasan penolakan `authorizeCall`/`createGrant`, urut sesuai pemeriksaan
 * (`application-layer.md` § Aturan otorisasi). Nilainya dipakai apa adanya
 * sebagai `errorCode` di audit (`status = denied`).
 *
 * - `no_active_grant`: tidak ada grant aktif untuk (pengguna, klien,
 *   workspace); termasuk grant yang sudah dicabut.
 * - `token_scope_insufficient`: scope tool tidak ada di scope token.
 * - `grant_scope_insufficient`: scope tool tidak ada di grant (token boleh
 *   lebih lebar dari grant, mis. setelah grant disempitkan).
 * - `not_workspace_member`: pengguna bukan member aktif workspace (dikeluarkan,
 *   pending, atau tidak pernah member).
 */
export type McpDenialReason =
  | "no_active_grant"
  | "token_scope_insufficient"
  | "grant_scope_insufficient"
  | "not_workspace_member";

const DENIAL_MESSAGE: Record<McpDenialReason, string> = {
  no_active_grant: "Akses klien ini sudah dicabut atau belum disetujui",
  token_scope_insufficient: "Scope yang dibutuhkan tool ini tidak ada di token",
  grant_scope_insufficient:
    "Scope yang dibutuhkan tool ini tidak diizinkan untuk koneksi ini",
  not_workspace_member: "Pengguna bukan lagi member aktif workspace ini",
};

/**
 * Panggilan MCP ditolak (fail closed). Selalu error, tidak pernah data
 * kosong. `grantId` terisi bila grant aktif sudah ditemukan sebelum
 * penolakan, supaya caller (handler tool) bisa mengisinya di `recordAudit`.
 */
export class McpAccessDeniedError extends McpAccessDomainError {
  readonly reason: McpDenialReason;
  readonly grantId: McpGrantId | null;

  constructor(reason: McpDenialReason, grantId: McpGrantId | null = null) {
    super(DENIAL_MESSAGE[reason]);
    this.name = "McpAccessDeniedError";
    this.reason = reason;
    this.grantId = grantId;
  }

  /** Kode untuk `mcp_audit_logs.error_code`. */
  get code(): McpDenialReason {
    return this.reason;
  }
}

/**
 * Grant yang diminta tidak ada, atau bukan milik pengguna pemanggil. Kedua
 * kasus sengaja tidak dibedakan supaya keberadaan grant milik orang lain
 * tidak bocor.
 */
export class McpGrantNotFoundError extends McpAccessDomainError {
  constructor() {
    super("Koneksi klien AI tidak ditemukan");
    this.name = "McpGrantNotFoundError";
  }
}

/**
 * Input `recordAudit` tidak valid (`scope` bukan `read | draft | schedule`
 * atau `status` bukan `success | denied | error`). Tipe TypeScript sudah
 * membatasinya, tetapi handler menerima nilai dari batas sistem, dan baris
 * audit yang salah tidak boleh tertulis diam-diam.
 */
export class McpInvalidAuditInputError extends McpAccessDomainError {
  constructor(message: string) {
    super(message);
    this.name = "McpInvalidAuditInputError";
  }
}

/** Input grant tidak valid (mis. tidak ada scope `mcp:*` yang dikenal). */
export class McpInvalidGrantInputError extends McpAccessDomainError {
  constructor(message: string) {
    super(message);
    this.name = "McpInvalidGrantInputError";
  }
}

/**
 * Kuota rate limit workspace terlampaui (T-154). Bukan penolakan otorisasi:
 * grant, scope, dan member sudah lolos. `retryAfterSeconds` = detik sampai
 * jendela kuota berikutnya mulai (minimal 1); klien boleh mencoba lagi setelah
 * itu. `grantId` terisi bila dilempar dari `authorizeCall` (untuk audit).
 */
export class McpRateLimitExceededError extends McpAccessDomainError {
  readonly quota: McpQuotaKind;
  readonly limit: number;
  readonly retryAfterSeconds: number;
  readonly grantId: McpGrantId | null;

  constructor(input: {
    quota: McpQuotaKind;
    limit: number;
    retryAfterSeconds: number;
    grantId?: McpGrantId | null;
  }) {
    const label = MCP_QUOTA_LABEL[input.quota];
    super(
      `Batas ${label.name} workspace tercapai (${input.limit} per ${label.per}). Coba lagi dalam ${input.retryAfterSeconds} detik.`,
    );
    this.name = "McpRateLimitExceededError";
    this.quota = input.quota;
    this.limit = input.limit;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.grantId = input.grantId ?? null;
  }

  /** Kode untuk `mcp_audit_logs.error_code` dan error MCP. */
  get code(): "rate_limited" {
    return "rate_limited";
  }
}

/** Permintaan kuota tidak valid (jumlah bukan bilangan bulat positif, atau melebihi seluruh batas). */
export class McpInvalidRateLimitInputError extends McpAccessDomainError {
  constructor(message: string) {
    super(message);
    this.name = "McpInvalidRateLimitInputError";
  }
}
