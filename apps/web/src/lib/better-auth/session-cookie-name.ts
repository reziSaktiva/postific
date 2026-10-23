import type { NextResponse } from "next/server";
import { getCookies } from "better-auth/cookies";

import { auth } from "./auth";

let sessionTokenCookie:
  ReturnType<typeof getCookies>["sessionToken"] | undefined;

/**
 * Nama + atribut cookie session Better Auth yang SEBENARNYA diset (T-140,
 * KI-100) — resolve dari `auth.options` lewat `getCookies()` (sama fungsi
 * yang dipakai Better Auth sendiri), bukan hardcode, supaya tidak drift
 * kalau `advanced.cookiePrefix`/`advanced.useSecureCookies` di `auth.ts`
 * berubah. Konstan selama proses hidup, jadi di-memoize.
 */
function getSessionTokenCookie() {
  return (sessionTokenCookie ??= getCookies(auth.options).sessionToken);
}

/**
 * Kedaluwarsakan cookie session yang terbukti stale/invalid
 * (`auth.api.getSession()` resolve `null` padahal cookie-nya ada) — tanpa
 * ini, user bisa terjebak infinite redirect loop `/` <-> `/login` (cookie
 * tidak pernah hilang, proxy terus menyangka masih login). Dipakai
 * `proxy.ts` dan `onboarding/resume/route.ts`.
 *
 * Atribut (`secure`, `path`, `domain`, ...) HARUS sama dengan saat cookie
 * diset: browser menolak Set-Cookie berprefix `__Secure-` yang tidak
 * `Secure`, jadi `response.cookies.delete(name)` polos tidak menghapus
 * apa pun di HTTPS.
 */
export function expireSessionCookie(response: NextResponse): void {
  const { name, attributes } = getSessionTokenCookie();
  response.cookies.set({
    name,
    value: "",
    path: attributes.path,
    domain: attributes.domain,
    secure: attributes.secure,
    httpOnly: attributes.httpOnly,
    sameSite: attributes.sameSite.toLowerCase() as "strict" | "lax" | "none",
    partitioned: attributes.partitioned,
    expires: new Date(0),
    maxAge: 0,
  });
}
