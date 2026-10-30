/**
 * Konfigurasi endpoint MCP produksi (T-150.2). Hanya membaca env; tanpa I/O.
 *
 * Flag: `MCP_ENABLED`. Plugin OAuth (`lib/better-auth/mcp-spike.ts`) dan route
 * memakai `isMcpEnabled()` ini. Fallback `MCP_SPIKE_ENABLED` sengaja
 * dipertahankan supaya env lama tidak mematikan MCP diam-diam; hapus setelah
 * semua env dimigrasi.
 */

import {
  MCP_RATE_LIMIT_MAX_VALUE,
  type McpRateLimitConfig,
} from "@/domains/mcp-access";

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

/**
 * Batas rate limit MCP per workspace (T-154, ADR-138 poin 7): 60 panggilan per
 * menit, 30 aksi tulis per jam, 50 konten terjadwal per hari (dikonfirmasi King
 * Rezi 2026-10-26). Ini satu-satunya tempat angkanya; domain menerima
 * konfigurasi lewat konstruktor. Panjang jendela tetap (bagian arti kuota).
 */
export const MCP_RATE_LIMIT_DEFAULTS: McpRateLimitConfig = {
  calls: 60,
  write_actions: 30,
  scheduled_contents: 50,
};

const RATE_LIMIT_ENV_KEYS: Record<keyof McpRateLimitConfig, string> = {
  calls: "MCP_RATE_LIMIT_CALLS_PER_MINUTE",
  write_actions: "MCP_RATE_LIMIT_WRITES_PER_HOUR",
  scheduled_contents: "MCP_RATE_LIMIT_SCHEDULED_CONTENTS_PER_DAY",
};

/**
 * Batas efektif: default di atas, dapat ditimpa per env. Nilai env yang bukan
 * bilangan bulat positif, atau melebihi `int4` Postgres (penghitung disimpan
 * sebagai `int4`), diabaikan (kembali ke default) supaya salah ketik tidak
 * mematikan atau memperlonggar batas diam-diam.
 */
export function getMcpRateLimitConfig(
  env: Env = process.env,
): McpRateLimitConfig {
  const resolved = { ...MCP_RATE_LIMIT_DEFAULTS };
  for (const kind of Object.keys(RATE_LIMIT_ENV_KEYS) as Array<
    keyof McpRateLimitConfig
  >) {
    const raw = env[RATE_LIMIT_ENV_KEYS[kind]]?.trim();
    if (raw && /^\d+$/.test(raw)) {
      const value = Number(raw);
      if (
        Number.isSafeInteger(value) &&
        value > 0 &&
        value <= MCP_RATE_LIMIT_MAX_VALUE
      ) {
        resolved[kind] = value;
      }
    }
  }
  return resolved;
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
