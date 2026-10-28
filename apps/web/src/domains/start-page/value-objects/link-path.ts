/**
 * Path redirect tracked untuk satu tautan (T-074): `href` tautan di halaman
 * publik harus menunjuk ke sini (bukan URL tujuan langsung) supaya klik
 * terhitung. Handler: `app/u/[slug]/go/[linkId]/route.ts`.
 */
export function buildLinkRedirectPath(slug: string, linkId: string): string {
  return `/u/${encodeURIComponent(slug)}/go/${encodeURIComponent(linkId)}`;
}

/** Path halaman publik (`/u/[slug]`, ADR-128). */
export function buildPublicPagePath(slug: string): string {
  return `/u/${encodeURIComponent(slug)}`;
}
