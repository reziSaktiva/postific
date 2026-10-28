/**
 * Scope akses MCP (BC-04, ADR-138, ADR-139 poin 4). Nama LOGIS yang disimpan
 * di `mcp_grants.scopes` dan `mcp_audit_logs.scope`; nama di kabel OAuth
 * (`mcp:read`, `mcp:draft`, `mcp:schedule`) hanya muncul di batas sistem
 * (token JWT dan baris consent plugin) lewat helper murni di bawah.
 *
 * Scope TIDAK berjenjang: `schedule` tidak otomatis mencakup `draft` atau
 * `read`. Pengguna mencentang tiap scope sendiri di layar persetujuan
 * (S-001), dan `authorizeCall` memeriksa kecocokan persis.
 */
export type McpScope = "read" | "draft" | "schedule";

/** Urutan kanonikal; dipakai untuk menormalkan daftar scope yang disimpan. */
export const MCP_SCOPES: readonly McpScope[] = ["read", "draft", "schedule"];

/** Awalan scope di kabel OAuth, mis. `mcp:read`. */
export const MCP_WIRE_SCOPE_PREFIX = "mcp:";

export function isMcpScope(value: unknown): value is McpScope {
  return (
    typeof value === "string" &&
    (MCP_SCOPES as readonly string[]).includes(value)
  );
}

/** `read` -> `mcp:read`. */
export function toMcpWireScope(scope: McpScope): string {
  return `${MCP_WIRE_SCOPE_PREFIX}${scope}`;
}

/**
 * `mcp:read` -> `read`. `null` untuk scope di luar keluarga `mcp:*` (mis.
 * `openid`, `offline_access`) dan untuk nama `mcp:*` yang tidak dikenal.
 */
export function fromMcpWireScope(wire: string): McpScope | null {
  if (!wire.startsWith(MCP_WIRE_SCOPE_PREFIX)) {
    return null;
  }
  const name = wire.slice(MCP_WIRE_SCOPE_PREFIX.length);
  return isMcpScope(name) ? name : null;
}

/**
 * Normalkan daftar scope: buang duplikat, urut kanonikal (`MCP_SCOPES`).
 * Dua daftar yang berisi himpunan sama selalu menghasilkan array yang sama,
 * jadi perbandingan dan penyimpanan stabil.
 */
export function normalizeMcpScopes(scopes: readonly McpScope[]): McpScope[] {
  const present = new Set<McpScope>(scopes);
  return MCP_SCOPES.filter((scope) => present.has(scope));
}

/**
 * Ambil scope logis dari daftar scope kabel mentah (klaim `scope` token atau
 * scope consent). Scope non-MCP (`openid`, `offline_access`, ...) dan nama
 * `mcp:*` yang tidak dikenal dibuang diam-diam: mereka bukan izin produk.
 */
export function parseMcpWireScopes(wireScopes: readonly string[]): McpScope[] {
  const parsed: McpScope[] = [];
  for (const wire of wireScopes) {
    const scope = fromMcpWireScope(wire);
    if (scope) {
      parsed.push(scope);
    }
  }
  return normalizeMcpScopes(parsed);
}

/** `true` bila `scopes` memuat `required` (kecocokan persis, tanpa jenjang). */
export function scopesInclude(
  scopes: readonly McpScope[],
  required: McpScope,
): boolean {
  return scopes.includes(required);
}
