/**
 * Konfigurasi endpoint MCP produksi (T-150.2). Hanya membaca env; tanpa I/O.
 *
 * Flag: `MCP_ENABLED`. Plugin OAuth (`lib/better-auth/mcp-spike.ts`) dan route
 * memakai `isMcpEnabled()` ini. Fallback `MCP_SPIKE_ENABLED` sengaja
 * dipertahankan supaya env lama tidak mematikan MCP diam-diam; hapus setelah
 * semua env dimigrasi.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://claude.ai",
  "https://www.claude.ai",
  "https://claude.com",
];

type Env = Record<string, string | undefined>;

export function isMcpEnabled(env: Env = process.env): boolean {
  return env.MCP_ENABLED === "true" || env.MCP_SPIKE_ENABLED === "true";
}

export function mcpBaseUrl(env: Env = process.env): string {
  return (env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
}

/** Resource server = audience token; sama dengan `validAudiences` plugin OAuth. */
export function mcpResourceUrl(env: Env = process.env): string {
  return `${mcpBaseUrl(env)}/api/mcp`;
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Validasi header `Origin` (anti DNS rebinding, ADR-139). Tanpa header
 * (klien non-browser seperti Claude Code dan SDK) diizinkan; dengan header,
 * harus ada di daftar: klien web default, URL basis sendiri, dan tambahan
 * dari `MCP_ALLOWED_ORIGINS` (atau `MCP_SPIKE_ALLOWED_ORIGINS` lama).
 */
export function isMcpOriginAllowed(
  origin: string | null,
  env: Env = process.env,
): boolean {
  if (!origin) {
    return true;
  }
  const allowed = [
    ...DEFAULT_ALLOWED_ORIGINS,
    mcpBaseUrl(env),
    ...splitList(env.MCP_ALLOWED_ORIGINS),
    ...splitList(env.MCP_SPIKE_ALLOWED_ORIGINS),
  ].filter(Boolean);
  return allowed.includes(origin);
}
