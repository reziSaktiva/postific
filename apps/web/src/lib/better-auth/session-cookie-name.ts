import { getCookies } from "better-auth/cookies";

import { auth } from "./auth";

/**
 * Nama cookie session Better Auth yang SEBENARNYA diset (T-140, KI-100) —
 * resolve dari `auth.options` lewat `getCookies()` (sama fungsi yang dipakai
 * Better Auth sendiri untuk menentukan nama cookie), bukan hardcode string
 * literal, supaya tidak drift kalau `advanced.cookiePrefix`/
 * `advanced.useSecureCookies` di `auth.ts` berubah nanti. Dipakai proxy.ts
 * dan `onboarding/resume/route.ts` untuk menghapus cookie session yang
 * terbukti stale/invalid (`auth.api.getSession()` resolve `null` padahal
 * cookie-nya ada) — tanpa ini, user dengan cookie stale bisa terjebak
 * infinite redirect loop `/` <-> `/login` (cookie tidak pernah hilang,
 * proxy terus menyangka masih login).
 */
export function getSessionCookieName(): string {
  return getCookies(auth.options).sessionToken.name;
}
