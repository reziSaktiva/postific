import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { asUserId, asWorkspaceId, MemberStatus } from "@postific/shared";

import { auth } from "@/lib/better-auth/auth";
import { WorkspaceService } from "@/domains/workspace";
import { getServerEnv } from "@/lib/env";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { ACTIVE_WORKSPACE_ID_COOKIE } from "@/lib/workspace/active-workspace-cookie";
import {
  WORKSPACE_ID_HEADER,
  WORKSPACE_ROLE_HEADER,
} from "@/lib/workspace/workspace-context-headers";

/**
 * Auth + workspace-context guard (ADR-076 — migrasi routing `[slug]` →
 * `(app)`). /api/auth/*, /api/jobs/*, /api/health, /api/v1/* are bypassed
 * (monorepo-setup.md). `/api/v1/*` (ADR-043, T-019) auth mobile Bearer,
 * bukan cookie session — gate cookie-based di bawah ini akan selalu redirect
 * ke /login karena request Bearer tidak pernah punya session cookie; auth
 * jalur itu divalidasi oleh Better Auth `bearer()` plugin di dalam handler
 * masing-masing endpoint `/api/v1`, bukan di sini.
 *
 * Renamed from `middleware` per Next.js 16 file convention
 * (https://nextjs.org/docs/messages/middleware-to-proxy) — behavior unchanged.
 *
 * Dua tahap:
 * 1. Gate murah: cek keberadaan session-cookie saja (tanpa DB call) untuk
 *    redirect cepat /login atau / pada halaman auth publik.
 * 2. Kalau lolos gate di atas dan bukan halaman `/onboarding`: validasi
 *    session penuh (`auth.api.getSession`) + resolve workspace context dari
 *    `ACTIVE_WORKSPACE_ID_COOKIE`, lalu inject sebagai request header
 *    (`x-workspace-id` / `x-workspace-role`) untuk dibaca `getWorkspaceContext()`
 *    di Server Component/Server Action downstream. Ini melakukan Prisma
 *    query — aman karena Proxy Next.js 16 selalu Node.js (tanpa
 *    `runtime` di `config`; opsi itu tidak diizinkan di Proxy file).
 */

// `/invite/[token]` (T-093.1, ADR-080) sengaja di-bypass sepenuhnya dari gate
// session/workspace di bawah — bukan ditambahkan ke `PUBLIC_AUTH_PATHS`
// (yang punya efek samping redirect user yang SUDAH login ke "/", tidak
// cocok untuk invite link yang bisa dibuka siapa pun kapan pun, login atau
// tidak). Halaman itu sendiri (Server Component) yang memvalidasi token dan
// menentukan form mana yang tampil — proxy tidak perlu tahu detail itu.
// `/api/webhooks/outstand` (T-026, ADR-040) ditambahkan ke daftar bypass ini
// karena Outstand mengirim request server-to-server tanpa cookie session
// sama sekali (bukan browser) — otentikasinya lewat HMAC-SHA256 signature
// yang divalidasi di dalam route handler webhook itu sendiri, sama seperti
// pola `/api/v1` di atas. Tanpa bypass ini, gate session di bawah
// me-redirect 307 ke /login SEBELUM request Outstand pernah sampai ke
// handler webhook — ditemukan Najwa QA lewat curl POST asli (v0.2 T-026
// Bug 1). Discope ke provider spesifik (bukan seluruh `/api/webhooks`)
// supaya route webhook provider lain yang ditambahkan nanti TIDAK otomatis
// mewarisi bypass ini tanpa verifikasi signature-nya sendiri direview.
const BYPASS_PREFIXES = [
  "/api/auth",
  "/api/jobs",
  "/api/health",
  "/api/v1",
  "/api/webhooks/outstand",
  "/invite",
];

const PUBLIC_AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function isUnderPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * `request.url` mencerminkan Host header yang benar-benar diterima proses
 * Next.js — di balik reverse proxy Railway, ini bisa jadi alamat bind
 * internal container (mis. `http://localhost:8080`) alih-alih domain
 * publik saat race di request awal (container baru start). Selalu bangun
 * origin redirect dari `BETTER_AUTH_URL` (base URL publik per environment,
 * sama seperti pola invite link di settings/members/actions.ts).
 */
function redirectTo(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, getServerEnv().BETTER_AUTH_URL));
}

/**
 * `x-workspace-id`/`x-workspace-role` HARUS hanya bisa datang dari blok
 * injection di bawah (setelah membership tervalidasi) — tanpa strip ini,
 * client bisa mengirim header itu sendiri lewat curl/devtools dan lolos
 * tanpa diubah di jalur bypass/`/onboarding` (`NextResponse.next()` tanpa
 * override meneruskan header request asli apa adanya). Dipanggil di setiap
 * `next()` supaya invariant ini ditegakkan lewat kode, bukan cuma disiplin
 * caller (temuan review arsitektur Ridwan).
 */
function stripWorkspaceHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete(WORKSPACE_ID_HEADER);
  headers.delete(WORKSPACE_ROLE_HEADER);
  return headers;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (BYPASS_PREFIXES.some((prefix) => isUnderPath(pathname, prefix))) {
    return NextResponse.next({
      request: { headers: stripWorkspaceHeaders(request) },
    });
  }

  const isPublicAuthPage = PUBLIC_AUTH_PATHS.some((path) =>
    isUnderPath(pathname, path),
  );
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (!hasSessionCookie && !isPublicAuthPage) {
    return redirectTo("/login");
  }

  if (hasSessionCookie && isPublicAuthPage) {
    return redirectTo("/");
  }

  if (isPublicAuthPage) {
    // !hasSessionCookie && isPublicAuthPage — satu-satunya kombinasi yang
    // tidak ditangani dua redirect di atas. Tanpa early-return ini, request
    // jatuh ke validasi session penuh di bawah, yang pasti `null` (memang
    // belum login) → redirect balik ke halaman yang sama → infinite loop
    // (QA Najwa: /login, /register, /forgot-password, /reset-password
    // semua ERR_TOO_MANY_REDIRECTS).
    return NextResponse.next({
      request: { headers: stripWorkspaceHeaders(request) },
    });
  }

  if (isUnderPath(pathname, "/onboarding")) {
    return NextResponse.next({
      request: { headers: stripWorkspaceHeaders(request) },
    });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return redirectTo("/login");
  }

  const workspaceIdFromCookie = request.cookies.get(
    ACTIVE_WORKSPACE_ID_COOKIE,
  )?.value;
  if (!workspaceIdFromCookie) {
    return redirectTo("/onboarding");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const membership = await workspaceService.getMembership(
    asWorkspaceId(workspaceIdFromCookie),
    asUserId(session.user.id),
  );

  if (!membership || membership.status !== MemberStatus.Active) {
    return redirectTo("/onboarding");
  }

  const requestHeaders = stripWorkspaceHeaders(request);
  requestHeaders.set(WORKSPACE_ID_HEADER, membership.workspaceId);
  requestHeaders.set(WORKSPACE_ROLE_HEADER, membership.role);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
