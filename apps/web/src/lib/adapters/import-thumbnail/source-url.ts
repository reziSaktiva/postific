/**
 * Validasi URL sumber thumbnail posting impor (T-230, ADR-158) — pagar SSRF:
 * hanya `https` ke host CDN platform yang dikenal, tanpa kredensial di URL
 * dan tanpa port khusus. URL berasal dari data Outstand (pihak ketiga),
 * jadi tidak dipercaya.
 */
const ALLOWED_HOST_SUFFIXES = [
  ".fbcdn.net",
  ".cdninstagram.com",
  ".tiktokcdn.com",
  ".tiktokcdn-us.com",
  ".tiktokcdn-eu.com",
];

export function isAllowedThumbnailSource(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Perkiraan video dari path (ekstensi) karena CDN platform tidak selalu memberi
 * `Content-Type` yang andal pada `HEAD`. Hanya keluarga MP4/MOV, sesuai
 * demuxer `mov` yang dipaksa pada `extractVideoFrame`.
 */
export function looksLikeVideoUrl(rawUrl: string): boolean {
  try {
    return /\.(mp4|mov|m4v)$/i.test(new URL(rawUrl).pathname);
  } catch {
    return false;
  }
}
