/**
 * Kuota rate limit MCP per workspace (T-154, ADR-138 poin 7). Tiga kuota,
 * semuanya fixed window dengan panjang jendela tetap (bagian dari arti kuota:
 * "per menit", "per jam", "per hari"). Yang dapat dikonfigurasi hanya BATAS
 * per jendela (`McpRateLimitConfig`), diisi composition root dari
 * `lib/mcp/config.ts`; domain tidak menyimpan angka bisnisnya.
 *
 * - `calls`: setiap panggilan tool yang lolos otorisasi (baca maupun tulis).
 * - `write_actions`: panggilan tool bercakup `draft` atau `schedule`.
 * - `scheduled_contents`: jumlah KONTEN yang dijadwalkan (per konten, bukan
 *   per akun target atau per panggilan); dikonsumsi tool `schedule_posts` (T-153)
 *   lewat `McpAccessService.consumeQuota`.
 */
export type McpQuotaKind = "calls" | "write_actions" | "scheduled_contents";

export const MCP_QUOTA_KINDS: readonly McpQuotaKind[] = [
  "calls",
  "write_actions",
  "scheduled_contents",
];

export function isMcpQuotaKind(value: unknown): value is McpQuotaKind {
  return (
    typeof value === "string" &&
    (MCP_QUOTA_KINDS as readonly string[]).includes(value)
  );
}

/** Panjang jendela per kuota, dalam detik. */
export const MCP_QUOTA_WINDOW_SECONDS: Readonly<Record<McpQuotaKind, number>> =
  {
    calls: 60,
    write_actions: 60 * 60,
    scheduled_contents: 24 * 60 * 60,
  };

/** Batas maksimum per jendela untuk setiap kuota; bilangan bulat positif. */
export type McpRateLimitConfig = Readonly<Record<McpQuotaKind, number>>;

/** Nama kuota dan satuan jendela untuk pesan error (Bahasa Indonesia). */
export const MCP_QUOTA_LABEL: Readonly<
  Record<McpQuotaKind, { name: string; per: string }>
> = {
  calls: { name: "panggilan", per: "menit" },
  write_actions: { name: "aksi tulis", per: "jam" },
  scheduled_contents: { name: "konten terjadwal", per: "hari" },
};

export interface McpQuotaWindow {
  start: Date;
  end: Date;
}

/**
 * Jendela tetap yang memuat `now`: kelipatan panjang jendela sejak epoch UTC.
 * Hari = 00:00 sampai 24:00 UTC (07:00 WIB), bukan tengah malam lokal.
 * Fixed window (bukan sliding) dipilih supaya satu baris per jendela dan satu
 * upsert atomik; harganya, dua jendela bersebelahan dapat memuat sampai 2x
 * batas dalam rentang singkat di sekitar pergantian jendela.
 */
export function quotaWindowAt(kind: McpQuotaKind, now: Date): McpQuotaWindow {
  const windowMs = MCP_QUOTA_WINDOW_SECONDS[kind] * 1000;
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  return { start: new Date(startMs), end: new Date(startMs + windowMs) };
}

/** Detik sampai jendela berakhir, dibulatkan ke atas, minimal 1. */
export function secondsUntilWindowEnd(
  window: McpQuotaWindow,
  now: Date,
): number {
  return Math.max(1, Math.ceil((window.end.getTime() - now.getTime()) / 1000));
}

/** Validasi konfigurasi: setiap batas bilangan bulat positif. Melempar `Error` bila tidak. */
export function assertValidRateLimitConfig(config: McpRateLimitConfig): void {
  for (const kind of MCP_QUOTA_KINDS) {
    const limit = config[kind];
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(
        `Batas rate limit MCP "${kind}" harus bilangan bulat positif`,
      );
    }
  }
}
