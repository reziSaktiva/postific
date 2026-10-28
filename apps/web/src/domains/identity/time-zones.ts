/**
 * Daftar & label zona waktu IANA (T-147, ADR-146). Pure function, tanpa I/O,
 * aman dipakai server (validasi) maupun client (opsi Select di Settings →
 * Profile). Daftar TIDAK hard-code: berasal dari
 * `Intl.supportedValuesOf("timeZone")` runtime, ditambah "UTC" (tidak selalu
 * ada di daftar itu); label offset/singkatan dihitung lewat
 * `Intl.DateTimeFormat` supaya DST ikut benar.
 */

const EXTRA_TIME_ZONES = ["UTC"] as const;

let cachedZones: string[] | null = null;
let cachedZoneSet: Set<string> | null = null;

/** Seluruh nama zona IANA yang diterima aplikasi (urut abjad, unik). */
export function getSupportedTimeZones(): string[] {
  if (!cachedZones) {
    const fromRuntime =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    cachedZones = [...new Set([...fromRuntime, ...EXTRA_TIME_ZONES])].sort();
    cachedZoneSet = new Set(cachedZones);
  }
  return cachedZones;
}

/**
 * Bentuk kanonik nama zona yang diterima aplikasi, atau `null` bila ditolak.
 * Nama yang ada di `Intl.supportedValuesOf("timeZone")` (+ "UTC") dikembalikan
 * apa adanya. Alias IANA yang ditulis persis (mis. browser mengirim
 * "Asia/Kolkata" sementara runtime server mendaftar "Asia/Calcutta") dipetakan
 * ke nama kanonik runtime; variasi huruf besar/kecil, nama tanpa "/" (mis.
 * "EST") dan nama tak dikenal ditolak.
 */
export function canonicalizeTimeZone(timeZone: string): string | null {
  if (typeof timeZone !== "string" || timeZone.length === 0) return null;
  getSupportedTimeZones();
  if (cachedZoneSet?.has(timeZone)) return timeZone;
  if (!timeZone.includes("/")) return null;

  let canonical: string;
  try {
    canonical = new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
  // Variasi huruf ("asia/jakarta", "ASIA/KOLKATA") ditolak, bukan dinormalkan
  // diam-diam: Intl mengabaikan huruf besar/kecil, daftar kita tidak.
  if (
    timeZone === timeZone.toLowerCase() ||
    timeZone === timeZone.toUpperCase()
  ) {
    return null;
  }
  return cachedZoneSet?.has(canonical) ? canonical : null;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  return canonicalizeTimeZone(timeZone) !== null;
}

/**
 * Zona IANA dari browser dalam bentuk kanonik bila diterima aplikasi, selain
 * itu `null` (zona yang tak dikenal tidak dikirim ke server).
 */
export function normalizeDetectedTimeZone(
  timeZone: string | undefined | null,
): string | null {
  if (!timeZone) return null;
  return canonicalizeTimeZone(timeZone);
}

function isValidRuntimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Nama wilayah (segmen pertama IANA); "UTC" berdiri sendiri. */
export function getTimeZoneRegion(timeZone: string): string {
  if (INDONESIA_TIME_ZONES.includes(timeZone)) return "Indonesia";
  const slash = timeZone.indexOf("/");
  return slash === -1 ? timeZone : timeZone.slice(0, slash);
}

export const INDONESIA_TIME_ZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
];

/** "UTC+7", "UTC-4", "UTC+5:30", "UTC+0" untuk `timeZone` pada instan `at`. */
export function formatUtcOffset(timeZone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // "GMT+05:30" / "GMT-4" / "GMT" -> "UTC+5:30" / "UTC-4" / "UTC+0"
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(raw);
  if (!match || !match[1]) return "UTC+0";
  const hours = String(Number(match[2]));
  const minutes = match[3] && match[3] !== "00" ? `:${match[3]}` : "";
  return `UTC${match[1]}${hours}${minutes}`;
}

function shortName(timeZone: string, locale: string, at: Date): string | null {
  const name = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  if (!name || /^(GMT|UTC)/.test(name)) return null;
  return name;
}

/**
 * Label item Select: "<IANA> (<singkatan>, UTC<offset>)", mis.
 * "Asia/Jakarta (WIB, UTC+7)"; tanpa singkatan bila runtime hanya punya
 * bentuk "GMT+x" ("Asia/Kolkata (UTC+5:30)").
 */
export function formatTimeZoneLabel(timeZone: string, at: Date): string {
  const offset = formatUtcOffset(timeZone, at);
  const abbreviation =
    shortName(timeZone, "id-ID", at) ?? shortName(timeZone, "en-US", at);
  if (timeZone === "UTC") return "UTC (UTC+0)";
  return abbreviation
    ? `${timeZone} (${abbreviation}, ${offset})`
    : `${timeZone} (${offset})`;
}

export interface TimeZoneOption {
  value: string;
  label: string;
}

export interface TimeZoneOptionGroup {
  region: string;
  options: TimeZoneOption[];
}

/**
 * Opsi Select berkelompok per wilayah: "Indonesia" paling atas, wilayah IANA
 * lain urut abjad, "UTC" terakhir (pola terkunci rancangan T-147).
 */
export function buildTimeZoneOptionGroups(
  at: Date,
  /** Zona yang harus ada walau tak ada di daftar runtime ini (mis. nilai tersimpan dari runtime lain). */
  ensure?: string,
): TimeZoneOptionGroup[] {
  const byRegion = new Map<string, TimeZoneOption[]>();
  const add = (region: string, timeZone: string) => {
    const list = byRegion.get(region) ?? [];
    list.push({ value: timeZone, label: formatTimeZoneLabel(timeZone, at) });
    byRegion.set(region, list);
  };

  for (const timeZone of INDONESIA_TIME_ZONES) {
    if (isSupportedTimeZone(timeZone)) add("Indonesia", timeZone);
  }
  const zones = getSupportedTimeZones();
  const allZones =
    ensure && !zones.includes(ensure) && isValidRuntimeZone(ensure)
      ? [...zones, ensure]
      : zones;
  for (const timeZone of allZones) {
    if (INDONESIA_TIME_ZONES.includes(timeZone)) continue;
    add(getTimeZoneRegion(timeZone), timeZone);
  }

  const regions = [...byRegion.keys()];
  const rank = (region: string) =>
    region === "Indonesia" ? 0 : region === "UTC" ? 2 : 1;
  regions.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  return regions.map((region) => ({
    region,
    options: byRegion.get(region) ?? [],
  }));
}
