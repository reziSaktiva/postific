/**
 * CSP berbasis nonce untuk rute publik Start Page `/u/*` (T-160, RS-D08,
 * ADR-144). Pola resmi Next.js: nonce dibuat di `proxy.ts` per request,
 * dikirim ke render lewat request header `Content-Security-Policy` (Next
 * mengekstrak `'nonce-...'` dan memasangnya ke script framework) dan `x-nonce`.
 *
 * Modul ini murni (tanpa I/O) supaya bisa diuji unit. Hanya dipakai untuk
 * `/u/*`; rute lain (auth/app) tidak mendapat CSP ini.
 */

export const NONCE_HEADER = "x-nonce";
export const CSP_HEADER = "Content-Security-Policy";

/** Prefix rute publik Start Page yang mendapat CSP nonce. */
const PUBLIC_START_PAGE_BASE = "/u";

/** True untuk `/u` dan `/u/...` saja (bukan `/user`, `/uploads`). */
export function isPublicStartPagePath(pathname: string): boolean {
  return (
    pathname === PUBLIC_START_PAGE_BASE ||
    pathname.startsWith(`${PUBLIC_START_PAGE_BASE}/`)
  );
}

/** Nonce acak 128 bit (base64), unik per request. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export type PublicCspOptions = {
  nonce: string;
  /** `next dev`: butuh `'unsafe-eval'` (React) dan HMR websocket. */
  isDev?: boolean;
};

/**
 * Kebijakan untuk halaman publik.
 *
 * - `script-src`: nonce + `'strict-dynamic'` (chunk Next yang dimuat oleh
 *   script ber-nonce ikut dipercaya); `'self'` hanya fallback browser lama.
 * - `style-src`: `'self'` + nonce (stylesheet Tailwind/font dari `'self'`;
 *   `<style>` SSR Next ber-nonce otomatis). Tidak ada `'unsafe-inline'`: kunci
 *   agar tidak ada komponen yang menyuntik `<style>` runtime di `/u/*` (mis.
 *   sonner `Toaster`, sengaja tidak dirender di rute publik, T-160).
 * - `img-src`: `https:` karena `avatarUrl` profil berupa URL https bebas
 *   (divalidasi hanya https, ADR-144); tanpa `http:`.
 * - `connect-src 'self'`: fetch RSC internal. `form-action 'self'`: tidak ada
 *   form ke luar. `frame-ancestors 'none'`: anti clickjacking (setara
 *   `X-Frame-Options: DENY`).
 *
 * `upgrade-insecure-requests` sengaja tidak dipasang: sub-resource sudah
 * same-origin/https dan direktif itu memecah `next start` di http://localhost
 * (uji lokal); TLS dijamin oleh edge Railway.
 */
export function buildPublicPageCsp({
  nonce,
  isDev = false,
}: PublicCspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}
