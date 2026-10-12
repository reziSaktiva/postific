import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { asConnectedAccountId, asUserId } from "@postific/shared";
import { decodeConnectAccountState } from "@/lib/adapters/outstand/connect-state";
import { getCachedSession } from "@/lib/better-auth/session";
import { getServerEnv } from "@/lib/env";
import { AlreadyConnectedError, ApplicationError } from "@/lib/utils/errors";
import type { ConnectResult } from "@/domains/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { createWorkspaceServiceWithOutstandAdapter } from "@/lib/workspace/outstand-workspace-service";
import {
  outstandConnectNonceCookieName,
  outstandConnectNonceCookieOptions,
} from "@/lib/workspace/outstand-connect-nonce-cookie";
import {
  outstandFacebookSessionCookieName,
  outstandFacebookSessionCookieOptions,
  OUTSTAND_FACEBOOK_SESSION_COOKIE_MAX_AGE,
} from "@/lib/workspace/outstand-facebook-session-cookie";

const CONNECTED_ACCOUNTS_PATH = "/settings/connected-accounts";

/**
 * Route Handler callback Connect/Reconnect Account (T-013.1/T-013.2,
 * T-015.3, ADR-105, redesain ADR-112 — SCOPE: single-page account saja,
 * lihat KI-070 untuk Facebook Pages, `integration-layer.md` § "Alur
 * Connect Account"). TIDAK boleh berisi business logic (AGENTS.md #5) —
 * satu-satunya keputusan di sini adalah marshalling (baca query param,
 * decode `state`, cocokkan nonce CSRF) sebelum delegasi penuh ke
 * `WorkspaceService.completeAccountConnection`; CREATE vs UPDATE
 * `ConnectedAccount`, RBAC, dan validasi kepemilikan akun semuanya ada di
 * Application Service, bukan di sini.
 *
 * **ADR-112 (2026-09-23):** Outstand TIDAK mengirim `code` untuk
 * di-exchange — setelah OAuth selesai, browser diarahkan balik dengan
 * `account_id`/`username`/`network_unique_id` LANGSUNG sebagai query
 * param (data akun sudah lengkap di URL callback ini sendiri). Handler
 * ini karena itu membaca ketiganya, bukan `code`.
 *
 * **Facebook Pages (T-025.4, ADR-115, wire-format dikoreksi ADR-116,
 * menutup KI-070; review fix session cookie):** route SATU ini TETAP
 * dipakai untuk Facebook — TIDAK ada route terpisah. Outstand redirect
 * balik dengan query param `session` (BUKAN `account_id`/`username`) —
 * percabangan di awal handler mendeteksi ini, CSRF-check nonce (TANPA
 * menghapus cookie-nya, flow belum selesai), simpan `session` ke cookie
 * httpOnly `outstandFacebookSession_<nonce>`, lalu redirect ke Connected
 * Accounts dengan `?connectFacebook=1&connectFacebookState=<state>` SAJA
 * (TANPA bearer di query). Dialog Page-selection + Server Action
 * `listFacebookPendingPagesAction`/`confirmFacebookPagesConnectionAction`
 * membaca token dari cookie lewat `state.nonce`.
 *
 * `proxy.ts` TIDAK meng-exclude path ini dari gate sesi/workspace (beda
 * dengan `/api/webhooks/outstand` yang server-to-server) — jadi begitu
 * handler ini dieksekusi, sesi user dan membership workspace aktif sudah
 * tervalidasi oleh proxy, header `x-workspace-id`/`x-workspace-role` sudah
 * di-inject. `getWorkspaceContext()` di bawah membaca context itu — BUKAN
 * `workspaceId` dari `state` (`state` hanya dipakai untuk `redirectAccountId`
 * + nonce CSRF), supaya `workspaceId` yang dipakai untuk RBAC/create/update
 * selalu berasal dari sumber yang sudah divalidasi proxy, bukan dari query
 * param publik yang bisa ditamper di browser.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const appOrigin = getServerEnv().BETTER_AUTH_URL;

  // ADR-112: query param Outstand asli untuk single-page account —
  // BUKAN `code` (lihat docstring di atas). `networkUniqueId` opsional,
  // tidak ikut menentukan lengkap/tidaknya request (lihat ADR-112 §3).
  const accountId = request.nextUrl.searchParams.get("account_id");
  const username = request.nextUrl.searchParams.get("username");
  const networkUniqueId = request.nextUrl.searchParams.get("network_unique_id");
  const state = request.nextUrl.searchParams.get("state");
  // Facebook Pages flow (T-025.4, ADR-115, menutup KI-070) — query param
  // ASLI Outstand adalah `session` (BUKAN `session_token`, tebakan awal
  // ADR-115 yang dikoreksi ADR-116 setelah verifikasi dokumentasi resmi
  // Outstand). Kalau ADA, ini bukan flow single-page — percabangan di
  // bawah SEBELUM pengecekan `account_id`/`username`.
  const facebookSessionToken = request.nextUrl.searchParams.get("session");

  // Facebook Pages (ADR-115 §7) — TIDAK bergabung dengan alur single-page
  // di bawah: Outstand mengarahkan balik dengan `session` (bukan
  // `account_id`/`username`), butuh langkah page-selection terpisah
  // sebelum ConnectedAccount benar-benar dibuat. `state` (nonce CSRF) tetap
  // WAJIB ada bareng `session` — kalau cuma satu, itu request bermasalah
  // (`?connect=error`), bukan no-op.
  if (facebookSessionToken) {
    if (!state) {
      return NextResponse.redirect(
        new URL(`${CONNECTED_ACCOUNTS_PATH}?connect=error`, appOrigin),
      );
    }

    let decodedForFacebook: ReturnType<typeof decodeConnectAccountState>;
    try {
      decodedForFacebook = decodeConnectAccountState(state);
    } catch {
      return NextResponse.redirect(
        new URL(`${CONNECTED_ACCOUNTS_PATH}?connect=error`, appOrigin),
      );
    }

    // CSRF-check nonce SAMA seperti alur single-page di bawah — TAPI
    // cookie TIDAK dihapus di sini (beda dari `redirectWithStatus`
    // existing): flow BELUM selesai, user masih perlu memilih Page lewat
    // `listFacebookPendingPagesAction`/`confirmFacebookPagesConnectionAction`
    // (Server Action yang menghapus cookie nonce + session di titik akhirnya).
    const facebookNonceCookieName = outstandConnectNonceCookieName(
      decodedForFacebook.nonce,
    );
    if (!request.cookies.has(facebookNonceCookieName)) {
      return NextResponse.redirect(
        new URL(`${CONNECTED_ACCOUNTS_PATH}?connect=error`, appOrigin),
      );
    }

    // Session token Outstand → httpOnly cookie (bukan query string) —
    // dialihkan ke Connected Accounts hanya dengan flag + state CSRF.
    const sessionCookieName = outstandFacebookSessionCookieName(
      decodedForFacebook.nonce,
    );
    const response = NextResponse.redirect(
      new URL(
        `${CONNECTED_ACCOUNTS_PATH}?connectFacebook=1&connectFacebookState=${encodeURIComponent(state)}`,
        appOrigin,
      ),
    );
    response.cookies.set(
      sessionCookieName,
      facebookSessionToken,
      outstandFacebookSessionCookieOptions(),
    );
    // Nonce awal berumur 10 menit sejak klik Connect. Page-picker butuh
    // sisa waktu yang sama dengan session token (30 menit) setelah OAuth.
    response.cookies.set(
      facebookNonceCookieName,
      "1",
      outstandConnectNonceCookieOptions(
        OUTSTAND_FACEBOOK_SESSION_COOKIE_MAX_AGE,
      ),
    );
    return response;
  }

  // Bug QA Najwa (T-015, 2026-09-11): setiap redirect() sukses dari Server
  // Action (`initiateConnectAccountAction`/`initiateReconnectAccountAction`)
  // ke path relatif Route Handler ini, App Router Next.js memperlakukan
  // target sebagai navigasi internal dan menyusulkan 1-2 request
  // prefetch/revalidasi ke PATHNAME YANG SAMA TANPA query string (perilaku
  // cache prefetch bawaan Next.js, bukan bug kode kita — reproducible di
  // semua platform/reconnect). Request susulan itu SAMA SEKALI tidak
  // membawa `account_id`/`username`/`state` (beda dari request OAuth asli
  // yang selalu membawa ketiganya, atau request malformed/tampered yang
  // membawa sebagian). Kalau ketiganya kosong, diamkan (no-op, redirect
  // polos tanpa `?connect=`) — JANGAN dianggap gagal, supaya tidak
  // menumpuk toast error palsu di atas toast sukses dari request asli.
  // Kalau ADA salah satu yang terisi tapi tidak lengkap ketiganya, itu
  // tetap request bermasalah sungguhan → tetap error (ADR-112 §3).
  if (!accountId && !username && !state) {
    return NextResponse.redirect(new URL(CONNECTED_ACCOUNTS_PATH, appOrigin));
  }
  if (!accountId || !username || !state) {
    return NextResponse.redirect(
      new URL(`${CONNECTED_ACCOUNTS_PATH}?connect=error`, appOrigin),
    );
  }

  let decoded: ReturnType<typeof decodeConnectAccountState>;
  try {
    decoded = decodeConnectAccountState(state);
  } catch {
    return NextResponse.redirect(
      new URL(`${CONNECTED_ACCOUNTS_PATH}?connect=error`, appOrigin),
    );
  }

  // Nama cookie di-scope per-nonce (`outstandConnectNonceCookieName`,
  // bukan satu nama tetap) — dua percobaan connect/reconnect yang tumpang
  // tindih (dua tab, double-invoke) masing-masing dapat cookie sendiri,
  // tidak saling menimpa sebelum salah satunya sempat consume oleh
  // callback-nya sendiri (lihat docstring di `outstand-connect-nonce-cookie.ts`).
  const nonceCookieName = outstandConnectNonceCookieName(decoded.nonce);

  function redirectWithStatus(status: ConnectResult): NextResponse {
    const response = NextResponse.redirect(
      new URL(`${CONNECTED_ACCOUNTS_PATH}?connect=${status}`, appOrigin),
    );
    response.cookies.delete(nonceCookieName);
    return response;
  }

  // CSRF-check (ADR-105 poin 4) — cookie bernama `nonceCookieName` HARUS
  // ada (diset Server Action inisiasi, lihat `outstand-connect-nonce-cookie.ts`).
  // Cookie hilang berarti callback ini TIDAK berasal dari inisiasi yang
  // baru saja dilakukan sesi browser ini — tolak, jangan diam-diam lanjut.
  if (!request.cookies.has(nonceCookieName)) {
    return redirectWithStatus("error");
  }

  const session = await getCachedSession();
  if (!session) {
    // Nonce sudah tervalidasi (percobaan ini genuinely valid) — tetap
    // bersihkan cookie-nya sebelum redirect ke /login, sama seperti
    // redirectWithStatus, supaya cookie yang sudah dikonsumsi tidak
    // bertahan sampai TTL 10 menit habis sendiri.
    const response = NextResponse.redirect(new URL("/login", appOrigin));
    response.cookies.delete(nonceCookieName);
    return response;
  }

  const { workspaceId } = await getWorkspaceContext();
  const workspaceService = createWorkspaceServiceWithOutstandAdapter();

  try {
    await workspaceService.completeAccountConnection({
      workspaceId,
      actorId: asUserId(session.user.id),
      accountId,
      username,
      networkUniqueId: networkUniqueId ?? undefined,
      state,
      redirectAccountId: decoded.redirectAccountId
        ? asConnectedAccountId(decoded.redirectAccountId)
        : undefined,
    });
  } catch (error) {
    if (error instanceof AlreadyConnectedError) {
      // KI-079 — `WorkspaceService.createOrRecoverConnectedAccount` sudah
      // membedakan double-submit genuine (diserap diam-diam, tidak sampai
      // ke sini) dari percobaan Connect ke akun yang SUDAH terhubung dari
      // alur/waktu berbeda. Hanya kasus KEDUA yang tiba di sini — beri
      // tahu user secara eksplisit, JANGAN redirect "success" diam-diam.
      return redirectWithStatus("already-connected");
    }
    if (error instanceof ApplicationError) {
      return redirectWithStatus("error");
    }
    // Kegagalan tak terduga (bukan ApplicationError) — tetap dilempar apa
    // adanya (bukan diam-diam disamarkan jadi redirect error), tapi nonce
    // yang sudah tervalidasi ini tetap dibersihkan lebih dulu supaya tidak
    // bertahan sampai TTL habis sendiri (pola sama redirectWithStatus).
    (await cookies()).delete(nonceCookieName);
    throw error;
  }

  return redirectWithStatus("success");
}

/**
 * Alias POST → GET (investigasi King Rezi + Elon Backend Engineer,
 * 2026-09-24, lanjutan T-025.4/KI-070). Direproduksi konsisten (dev server
 * Turbopack, Next.js 16.2.10): klik natural "Connect Account → Facebook"
 * memicu Server Action `initiateConnectAccountAction`, yang di dalamnya
 * memanggil `redirect(redirectUrl)` ke path RELATIF route ini (bukan page
 * di app router — hanya Route Handler). Next.js App Router melakukan
 * client-side navigation untuk redirect dari Server Action (dokumentasi
 * resmi: "In a Server Action, redirect performs a client-side navigation
 * when JavaScript is available") — TAPI karena target bukan bagian dari
 * page tree yang bisa di-render ulang lewat RSC soft-navigation, client
 * runtime kadang (non-deterministic, tergantung timing/cache router)
 * menembak ulang URL redirect dengan method ASLI (POST) alih-alih
 * mengonversi ke GET seperti semantik 303 See Other standar (yang berlaku
 * benar untuk navigasi non-JS / full page reload). Ini murni idiosinkrasi
 * client-side navigation Next.js, BUKAN bug kode di sini — dikonfirmasi
 * lewat reproduksi berulang (network log: request YANG SAMA persis kadang
 * sukses 200 lewat GET, kadang gagal 405 lewat POST, tanpa perubahan kode
 * di antaranya) dan tidak ditemukan pengaturan resmi Next.js untuk
 * memaksa GET pada kasus ini.
 *
 * Aman di-alias ke `GET` karena handler ini murni idempoten: baca query
 * param + cookie, decode `state`, delegasikan penuh ke
 * `WorkspaceService.completeAccountConnection`, lalu redirect — tidak ada
 * efek samping yang berbahaya kalau dieksekusi dua kali (idempotency
 * sudah dijamin di level `WorkspaceService`/repository, bukan di route
 * ini). Bukan keputusan arsitektur (tidak mengubah kontrak Outstand/ACL,
 * ADR-040) — murni workaround robustness terhadap perilaku framework,
 * sehingga TIDAK dicatat sebagai ADR baru.
 */
export const POST = GET;
