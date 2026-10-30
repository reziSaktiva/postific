/**
 * Validasi URL untuk Start Page (T-071/T-072 prasyarat review T-070).
 * Berbasis `new URL()` + allowlist protocol (bukan regex): tautan dan
 * avatar berasal dari input workspace tapi dirender/di-redirect untuk
 * audiens anonim, jadi `javascript:`, `data:`, `vbscript:`, `file:` dst.
 * tidak boleh pernah lolos.
 */

export const URL_MAX_LENGTH = 2048;

function parseUrl(input: unknown, protocols: readonly string[]): URL | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > URL_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!protocols.includes(url.protocol)) return null;
  if (url.hostname.length === 0) return null;
  // Kredensial inline (`https://user:pass@host`) dipakai untuk menyamarkan
  // tujuan tautan — tidak ada kebutuhan sah di bio link.
  if (url.username !== "" || url.password !== "") return null;
  return url;
}

/**
 * URL tautan: hanya `http:`/`https:`. Mengembalikan bentuk kanonik
 * (`URL#href`: host lowercase, dst.) atau `null` bila tidak valid. Pakai
 * hasilnya (bukan input mentah) untuk disimpan/dirender/di-redirect.
 */
export function sanitizeLinkUrl(input: unknown): string | null {
  return parseUrl(input, ["http:", "https:"])?.href ?? null;
}

export function isSafeHttpUrl(input: unknown): boolean {
  return sanitizeLinkUrl(input) !== null;
}

/** URL avatar: hanya `https:` (tanpa mixed content di halaman publik). */
export function sanitizeAvatarUrl(input: unknown): string | null {
  return parseUrl(input, ["https:"])?.href ?? null;
}

/** Kunci ikon platform yang dikenali (UI memetakan ke ikon; `link` = generik). */
export const LINK_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "x",
  "linkedin",
  "threads",
  "pinterest",
  "whatsapp",
  "telegram",
  "github",
  "spotify",
  "link",
] as const;

export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

const PLATFORM_HOSTS: ReadonlyArray<readonly [LinkPlatform, string[]]> = [
  ["instagram", ["instagram.com"]],
  ["tiktok", ["tiktok.com"]],
  ["youtube", ["youtube.com", "youtu.be"]],
  ["facebook", ["facebook.com", "fb.com", "fb.me"]],
  ["x", ["x.com", "twitter.com"]],
  ["linkedin", ["linkedin.com"]],
  ["threads", ["threads.net", "threads.com"]],
  ["pinterest", ["pinterest.com", "pin.it"]],
  ["whatsapp", ["whatsapp.com", "wa.me"]],
  ["telegram", ["telegram.org", "t.me"]],
  ["github", ["github.com"]],
  ["spotify", ["spotify.com"]],
];

/**
 * Turunkan kunci ikon dari host URL (cocok persis atau subdomain; bukan
 * substring, jadi `notinstagram.com` tidak dianggap Instagram). URL tidak
 * valid atau host tak dikenal -> `"link"`.
 */
export function getLinkPlatform(url: string): LinkPlatform {
  const parsed = parseUrl(url, ["http:", "https:"]);
  if (!parsed) return "link";
  const host = parsed.hostname.toLowerCase();
  for (const [platform, domains] of PLATFORM_HOSTS) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) {
      return platform;
    }
  }
  return "link";
}

/** Host tanpa `www.` untuk teks sekunder di UI; `null` bila URL tak valid. */
export function getLinkDisplayHost(url: string): string | null {
  const parsed = parseUrl(url, ["http:", "https:"]);
  return parsed ? parsed.hostname.replace(/^www\./, "") : null;
}
