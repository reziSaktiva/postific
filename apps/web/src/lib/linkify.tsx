import type { ReactNode } from "react";

/**
 * URL (`http://`/`https://`, tanpa whitespace) ATAU hashtag (`#kata`,
 * unicode-aware supaya hashtag non-ASCII — mis. caption Bahasa Indonesia
 * dengan diakritik — tetap terdeteksi).
 */
const URL_OR_HASHTAG_PATTERN =
  /(https?:\/\/[^\s,.!?()]+(?:[^\s,.!?()]|\.(?!\s|$))*)|(#[\p{L}\p{N}_]+)/gu;

/**
 * Parse caption plain-text jadi array node React: URL dan hashtag dirender
 * sebagai `<a>`, sisanya teks biasa apa adanya. Utility baru (T-111.2,
 * belum ada sebelumnya di `apps/web/src`) — presentation-only (text
 * parsing), BUKAN domain/business logic, jadi aman di `lib/` tanpa
 * melanggar AGENTS.md #5/#6.
 *
 * **Keputusan disengaja — hashtag jadi `<span>` bergaya link, BUKAN
 * `<a>` (T-111.2):** caption post di sini bisa berasal dari platform
 * manapun (Instagram/Facebook/X/dst, ADR-039), jadi tidak ada satu URL
 * tujuan hashtag yang benar secara generik (beda dari URL asli yang
 * memang sudah membawa tujuannya sendiri). Hashtag tetap tampil dengan
 * styling link konsisten (warna + underline), tapi sebagai `<span>` —
 * `<a>` tanpa `href` bukan hyperlink valid secara semantik HTML
 * (jsx-a11y). Kalau King Rezi mau hashtag mengarah ke tujuan tertentu,
 * itu keputusan produk terpisah (perlu tahu platform target per-hashtag)
 * — laporkan, jangan diasumsikan.
 */
export function linkifyCaption(text: string): ReactNode[] {
  if (!text) {
    return [];
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  URL_OR_HASHTAG_PATTERN.lastIndex = 0;
  let match = URL_OR_HASHTAG_PATTERN.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    const isUrl = matched.startsWith("http");
    const linkClassName =
      "text-primary underline underline-offset-3 hover:text-foreground";

    nodes.push(
      isUrl ? (
        <a
          key={`linkify-${key++}`}
          href={matched}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {matched}
        </a>
      ) : (
        <span key={`linkify-${key++}`} className={linkClassName}>
          {matched}
        </span>
      ),
    );

    lastIndex = match.index + matched.length;
    match = URL_OR_HASHTAG_PATTERN.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
