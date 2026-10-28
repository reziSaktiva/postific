import type { McpGrantId } from "@postific/shared";

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
