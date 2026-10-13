import { secureCookiesEnabled } from "@/lib/env";

/**
 * Nama cookie CSRF nonce untuk loopback OAuth Connect/Reconnect Account
 * (T-013.1/T-013.2, T-015.3, ADR-105). Diset oleh Server Action inisiasi
 * (`initiateConnectAccountAction`/`initiateReconnectAccountAction`) sesaat
 * sebelum `redirect(redirectUrl)`, dibaca+dihapus kembali oleh Route Handler
 * callback (`/api/integrations/outstand/callback`) untuk mencocokkan
 * `nonce` yang dibawa lewat `state` — mencegah callback dipicu dari `state`
 * yang bukan hasil inisiasi milik sesi browser ini sendiri (ADR-105 poin 4:
 * "CSRF-check nyata (nonce dicocokkan sisi cookie/session) adalah
 * tanggung jawab Route Handler, bukan adapter").
 *
 * Nama cookie di-scope PER-NONCE (bukan satu nama tetap) — nonce sendiri
 * sudah berupa UUID acak (aman dipakai sebagai suffix nama cookie), jadi dua
 * percobaan connect/reconnect yang tumpang tindih (dua tab, atau
 * double-invoke) masing-masing dapat cookie sendiri, bukan saling menimpa
 * satu cookie bersama sebelum salah satunya sempat di-consume oleh
 * callback-nya.
 */
const OUTSTAND_CONNECT_NONCE_COOKIE_PREFIX = "outstand-connect-nonce-";

export function outstandConnectNonceCookieName(nonce: string): string {
  return `${OUTSTAND_CONNECT_NONCE_COOKIE_PREFIX}${nonce}`;
}

/**
 * Ambil `state` CSRF dari URL redirect Outstand.
 *
 * Fake loopback menaruh `state` sebagai query param tingkat atas. Real
 * adapter (ADR-112) menaruhnya di dalam `redirect_uri`
 * (`…/callback?state=…`), lalu URL Outstand hanya punya `redirect_uri`.
 * Kalau yang kedua diabaikan, cookie nonce tidak pernah diset dan callback
 * yang sah ditolak sebagai CSRF.
 */
export function readConnectStateFromRedirectUrl(
  redirectUrl: string,
): string | null {
  const url = new URL(redirectUrl, "http://outstand-connect.invalid");
  const topLevel = url.searchParams.get("state");
  if (topLevel) return topLevel;

  const redirectUri = url.searchParams.get("redirect_uri");
  if (!redirectUri) return null;

  try {
    return new URL(redirectUri).searchParams.get("state");
  } catch {
    return null;
  }
}

/** 10 menit — cukup untuk satu round-trip OAuth single-page. */
const OUTSTAND_CONNECT_NONCE_COOKIE_MAX_AGE = 60 * 10;

export function outstandConnectNonceCookieOptions(
  maxAge = OUTSTAND_CONNECT_NONCE_COOKIE_MAX_AGE,
): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    path: "/",
    maxAge,
  };
}
