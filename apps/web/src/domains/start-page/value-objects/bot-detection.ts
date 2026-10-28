/**
 * Deteksi bot SEDERHANA untuk analytics Start Page (T-074). Heuristik
 * user-agent saja — BUKAN perlindungan anti-fraud:
 * - mudah dipalsukan (bot yang menyamar jadi browser tetap terhitung);
 * - tanpa dedup per pengunjung (refresh = +1 view, klik berulang = +N);
 * - UA kosong dianggap bot.
 * Tujuannya hanya menyaring crawler/preview-unfurler/monitor umum supaya
 * angka tidak melambung karena trafik mesin yang jujur.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|preview|unfurl|embedly|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python-requests|python-urllib|go-http-client|java\/|okhttp|axios|node-fetch|undici|httpclient|libwww|scrapy|whatsapp|telegram|slack|discord|skype|vkshare|quora link|bingpreview|duckduck|baidu|yandex/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true;
  return BOT_PATTERN.test(userAgent);
}
