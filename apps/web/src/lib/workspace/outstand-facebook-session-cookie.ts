import { secureCookiesEnabled } from "@/lib/env";

/**
 * Cookie httpOnly untuk `session` token Facebook Pages (T-025.4 review
 * fix) — menggantikan query param `?connectFacebookSessionToken=` yang
 * sebelumnya membocorkan bearer ke address bar / Referer / history.
 *
 * Di-scope PER-NONCE (sama pola `outstand-connect-nonce-cookie.ts`) supaya
 * dua tab connect Facebook tidak saling menimpa token. Diset Route Handler
 * callback setelah CSRF nonce valid, dibaca Server Action
 * `listFacebookPendingPagesAction`/`confirmFacebookPagesConnectionAction`
 * lewat `state.nonce`, dihapus di titik akhir flow (confirm sukses/gagal
 * CSRF) bersama cookie nonce.
 */
const OUTSTAND_FACEBOOK_SESSION_COOKIE_PREFIX = "outstandFacebookSession_";

export function outstandFacebookSessionCookieName(nonce: string): string {
  return `${OUTSTAND_FACEBOOK_SESSION_COOKIE_PREFIX}${nonce}`;
}

/** ~30 menit — selaras TTL session Outstand untuk page-selection. */
export const OUTSTAND_FACEBOOK_SESSION_COOKIE_MAX_AGE = 60 * 30;

export function outstandFacebookSessionCookieOptions(): {
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
    maxAge: OUTSTAND_FACEBOOK_SESSION_COOKIE_MAX_AGE,
  };
}
