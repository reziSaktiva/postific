"use server";

import {
  asConnectedAccountId,
  asUserId,
  SocialPlatform,
  type FacebookPendingPage,
} from "@postific/shared";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WorkspaceService } from "@/domains/workspace";
import { decodeConnectAccountState } from "@/lib/adapters/outstand/connect-state";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import {
  createImportPostsTriggerUseCase,
  createWorkspaceServiceWithOutstandAdapter,
} from "@/lib/workspace/outstand-workspace-service";
import {
  outstandConnectNonceCookieName,
  outstandConnectNonceCookieOptions,
  readConnectStateFromRedirectUrl,
} from "@/lib/workspace/outstand-connect-nonce-cookie";
import { outstandFacebookSessionCookieName } from "@/lib/workspace/outstand-facebook-session-cookie";
import { toActionError } from "@/lib/utils/errors";

/**
 * Simpan nonce CSRF (dari `state` yang dibentuk `connectAccount`) sebagai
 * cookie httpOnly SEBELUM redirect browser ke `redirectUrl` (ADR-105 poin
 * 4) — dibaca+dicocokkan kembali Route Handler callback. `redirectUrl`
 * adalah path relatif Fake (`/api/integrations/outstand/callback?...`),
 * jadi di-parse dengan base dummy murni untuk membaca `searchParams`, BUKAN
 * dipakai sebagai origin request sungguhan. `state` bisa di query tingkat
 * atas atau di dalam `redirect_uri` (Real adapter, ADR-112). Kalau format
 * `state` tidak dikenal, skip — callback nanti menolak tanpa cookie.
 */
async function persistConnectNonceCookie(redirectUrl: string): Promise<void> {
  const state = readConnectStateFromRedirectUrl(redirectUrl);
  if (!state) return;

  try {
    const decoded = decodeConnectAccountState(state);
    (await cookies()).set(
      outstandConnectNonceCookieName(decoded.nonce),
      "1",
      outstandConnectNonceCookieOptions(),
    );
  } catch {
    // Format state tidak dikenal — lihat docstring di atas.
  }
}

/**
 * Disconnect akun terhubung (T-014.2, ADR-048/ADR-049) — entry point tipis,
 * hanya resolve workspace context + session lalu memanggil
 * `WorkspaceService.disconnectAccount` (AGENTS.md #5). RBAC (Owner/Admin)
 * dan seluruh business logic sepenuhnya di Application Service, TIDAK di
 * sini. Dialog konfirmasi Tier 2 (KSP-08-F07) yang memanggil action ini
 * adalah scope T-014.3 (belum dikerjakan) — action ini sendiri tidak
 * mengasumsikan sudah dikonfirmasi, hanya mengeksekusi apa yang diminta
 * caller.
 */
export async function disconnectAccountAction(
  connectedAccountId: string,
): Promise<{ error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);

  try {
    await workspaceService.disconnectAccount(
      workspaceId,
      asUserId(session.user.id),
      asConnectedAccountId(connectedAccountId),
    );
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/settings/connected-accounts");
  return {};
}

/**
 * Facebook (T-025.4, KI-070) butuh perlakuan navigasi BEDA dari platform
 * single-page lain — lihat catatan Bug #2 di docstring
 * `initiateConnectAccountAction`/`initiateReconnectAccountAction` di
 * bawah. `true` berarti caller HARUS melakukan hard navigation sendiri
 * (`window.location.href = redirectUrl`) alih-alih mengandalkan
 * `redirect()` server-side.
 */
function requiresClientHardNavigation(platform: SocialPlatform): boolean {
  return platform === SocialPlatform.Facebook;
}

/**
 * Connect Account baru (T-013.1/T-013.2, ADR-105) — entry point tipis,
 * hanya resolve context + memanggil `WorkspaceService.initiateConnectAccount`
 * (AGENTS.md #5). RBAC sepenuhnya di Application Service. Sukses berarti
 * `redirect()` ke `redirectUrl` OAuth (Fake: loopback ke callback route
 * kita sendiri, ADR-105) — signature `Promise<{ error?: string }>` konsisten
 * dengan `disconnectAccountAction`; kegagalan RBAC/validasi mengembalikan
 * `{ error }` TANPA redirect, sama seperti `switchWorkspaceAction`.
 *
 * **Pengecualian Facebook (Bug #2, investigasi King Rezi + Elon Backend
 * Engineer, 2026-09-24, T-025.4/KI-070):** untuk `platform === Facebook`,
 * fungsi ini SENGAJA TIDAK memanggil `redirect()` di server — dikembalikan
 * `{ redirectUrl }` mentah, caller (`ConnectPlatformMenu`) yang wajib
 * melakukan `window.location.href = redirectUrl` (hard navigation penuh).
 *
 * Kenapa: `redirectUrl` Facebook SELALU loopback ke domain KITA SENDIRI
 * (`/api/integrations/outstand/callback?session=...`, ADR-115/§7 — beda
 * dari platform single-page lain yang `redirectUrl`-nya domain EKSTERNAL
 * `outstand.so`). Next.js App Router: "In a Server Action, redirect
 * performs a client-side navigation when JavaScript is available"
 * (dokumentasi resmi) — untuk target domain eksternal ini otomatis jadi
 * hard nav (aman), TAPI untuk target SAME-ORIGIN yang BUKAN page (Route
 * Handler `/api/...`), client runtime App Router (dikonfirmasi reproduksi
 * berulang di Next.js 16.2.10/Turbopack dev) memperlakukan seluruh rantai
 * (Server Action → Route Handler kita sendiri → balik ke halaman ini)
 * seolah satu transisi App Router yang sama — padahal Route Handler di
 * tengah me-redirect pakai `NextResponse.redirect()` MENTAH (bukan
 * redirect()-nya Server Action), mismatch protokol ini menghasilkan 2 bug
 * nyata yang direproduksi di browser: (1) method HTTP request susulan ke
 * Route Handler itu TIDAK SELALU dikonversi ke GET sesuai semantik 303
 * (405 non-deterministic — lihat docstring `POST` di
 * `api/integrations/outstand/callback/route.ts`), (2) SETELAH sampai
 * kembali di halaman ini, dialog Facebook Pages Picker macet Loading
 * SELAMANYA karena internal action-dispatch queue App Router tidak pernah
 * benar-benar "selesai" mentransisikan — Server Action BERIKUTNYA
 * (`listFacebookPendingPagesAction` dari dalam dialog) TIDAK PERNAH
 * ter-resolve (dikonfirmasi lewat instrumentasi `console.log` manual di
 * `useEffect` dialog: fungsi terpanggil, network request tidak pernah
 * dikirim sama sekali, promise menggantung tanpa timeout).
 *
 * Memaksa hard navigation dari CLIENT (bukan `redirect()` server) memutus
 * rantai App Router soft-nav sepenuhnya — sama seperti yang SUDAH terjadi
 * otomatis untuk redirect ke domain eksternal (`outstand.so`), jadi
 * perilaku Real adapter TIDAK berubah sama sekali (di produksi,
 * `redirectUrl` Facebook tetap URL `outstand.so` — `window.location.href`
 * ke situ persis sama efeknya dengan `redirect()` server yang sudah
 * otomatis hard-nav untuk kasus itu). Platform lain (Instagram/X/dst)
 * TIDAK disentuh sama sekali oleh perubahan ini — tetap lewat `redirect()`
 * server seperti semula, tidak ada perubahan test/behavior untuk mereka.
 * Bukan keputusan arsitektur/ADR baru (tidak mengubah kontrak
 * `WorkspaceService`/`OutstandAdapter`, murni siapa yang memicu navigasi
 * browser) — didokumentasikan di sini + laporan ke King Rezi, bukan
 * `DECISIONS.md`.
 */
export async function initiateConnectAccountAction(
  platform: SocialPlatform,
): Promise<{ error?: string; redirectUrl?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  let redirectUrl: string;
  try {
    const result =
      await createWorkspaceServiceWithOutstandAdapter().initiateConnectAccount({
        workspaceId,
        actorId: asUserId(session.user.id),
        platform,
      });
    redirectUrl = result.redirectUrl;
  } catch (error) {
    return toActionError(error);
  }

  await persistConnectNonceCookie(redirectUrl);

  if (requiresClientHardNavigation(platform)) {
    return { redirectUrl };
  }

  redirect(redirectUrl);
}

/**
 * Reconnect akun existing (T-015.3, ADR-105) — sama pola dengan
 * `initiateConnectAccountAction`, `redirectAccountId` diisi supaya
 * `WorkspaceService` tahu ini UPDATE (bukan CREATE) saat callback nanti.
 * `platform` diteruskan dari `ConnectedAccountRecord` yang sudah dimiliki
 * caller (`ConnectedAccountsList`) — dicocokkan ulang ke akun di
 * `WorkspaceService.initiateConnectAccount` (defense-in-depth, lihat
 * docstring method itu).
 *
 * Pengecualian Facebook (Bug #2) sama persis dengan
 * `initiateConnectAccountAction` di atas — lihat docstring-nya untuk
 * detail lengkap. Berlaku juga di sini karena "Reconnect" akun Facebook
 * Page yang sudah ada memanggil `connectAccount()` yang sama, dengan
 * `redirectUrl` loopback yang sama persis.
 */
export async function initiateReconnectAccountAction(
  connectedAccountId: string,
  platform: SocialPlatform,
): Promise<{ error?: string; redirectUrl?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  let redirectUrl: string;
  try {
    const result =
      await createWorkspaceServiceWithOutstandAdapter().initiateConnectAccount({
        workspaceId,
        actorId: asUserId(session.user.id),
        platform,
        redirectAccountId: asConnectedAccountId(connectedAccountId),
      });
    redirectUrl = result.redirectUrl;
  } catch (error) {
    return toActionError(error);
  }

  await persistConnectNonceCookie(redirectUrl);

  if (requiresClientHardNavigation(platform)) {
    return { redirectUrl };
  }

  redirect(redirectUrl);
}

/**
 * Baca session token Facebook dari cookie httpOnly yang di-bind ke
 * `state.nonce` (diset Route Handler callback). Jangan terima token dari
 * client — bearer tidak boleh round-trip lewat props/query.
 */
async function readFacebookSessionTokenFromCookie(
  nonce: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(
    outstandFacebookSessionCookieName(nonce),
  )?.value;
  return value && value.length > 0 ? value : null;
}

function clearFacebookConnectCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  nonce: string,
): void {
  cookieStore.delete(outstandConnectNonceCookieName(nonce));
  cookieStore.delete(outstandFacebookSessionCookieName(nonce));
}

/**
 * Facebook Pages — list pending Pages (T-025.4, ADR-115) — dipanggil dialog
 * Page-selection saat mount (state Loading → Default), setelah Route
 * Handler callback redirect ke Connected Accounts dengan
 * `?connectFacebook=1&connectFacebookState=` (session token di cookie
 * httpOnly, bukan query). `state` di-decode untuk mencocokkan nonce CSRF
 * + lookup cookie session — cookie HANYA dibaca, TIDAK dihapus (flow belum
 * selesai, dihapus di `confirmFacebookPagesConnectionAction` / CSRF fail).
 */
export async function listFacebookPendingPagesAction(
  state: string,
): Promise<{ pages?: FacebookPendingPage[]; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  let decoded: ReturnType<typeof decodeConnectAccountState>;
  try {
    decoded = decodeConnectAccountState(state);
  } catch {
    return { error: "Sesi koneksi Facebook tidak valid." };
  }

  const cookieStore = await cookies();
  const nonceCookieName = outstandConnectNonceCookieName(decoded.nonce);
  if (!cookieStore.has(nonceCookieName)) {
    clearFacebookConnectCookies(cookieStore, decoded.nonce);
    return { error: "Sesi koneksi Facebook tidak valid atau kedaluwarsa." };
  }

  const sessionToken = await readFacebookSessionTokenFromCookie(decoded.nonce);
  if (!sessionToken) {
    clearFacebookConnectCookies(cookieStore, decoded.nonce);
    return { error: "Sesi koneksi Facebook tidak valid atau kedaluwarsa." };
  }

  const workspaceService = createWorkspaceServiceWithOutstandAdapter();
  try {
    const pages = await workspaceService.listFacebookPendingPages({
      workspaceId,
      actorId: asUserId(session.user.id),
      sessionToken,
    });
    return { pages };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Facebook Pages — confirm selected Pages (T-025.4, ADR-115) — dipanggil
 * saat user submit dialog Page-selection (tombol "Hubungkan N Page
 * Terpilih"). `state` di-decode LAGI + cookie CSRF/session dicocokkan LAGI
 * (defense-in-depth). Cookie nonce + session dihapus hanya setelah
 * finalize dan simpan Page berhasil, atau kalau CSRF sudah tidak valid.
 * Kegagalan jaringan/DB membiarkan cookie supaya user bisa mengulang
 * tanpa OAuth dari awal.
 */
export async function confirmFacebookPagesConnectionAction(
  state: string,
  selectedPageIds: string[],
): Promise<{ connectedCount?: number; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  let decoded: ReturnType<typeof decodeConnectAccountState>;
  try {
    decoded = decodeConnectAccountState(state);
  } catch {
    return { error: "Sesi koneksi Facebook tidak valid." };
  }

  const cookieStore = await cookies();
  const nonceCookieName = outstandConnectNonceCookieName(decoded.nonce);
  const hasNonce = cookieStore.has(nonceCookieName);
  const sessionToken = await readFacebookSessionTokenFromCookie(decoded.nonce);

  if (!hasNonce || !sessionToken) {
    clearFacebookConnectCookies(cookieStore, decoded.nonce);
    return { error: "Sesi koneksi Facebook tidak valid atau kedaluwarsa." };
  }

  const workspaceService = createWorkspaceServiceWithOutstandAdapter();
  try {
    const created = await workspaceService.confirmFacebookPagesConnection({
      workspaceId,
      actorId: asUserId(session.user.id),
      sessionToken,
      selectedPageIds,
    });
    clearFacebookConnectCookies(cookieStore, decoded.nonce);
    revalidatePath("/settings/connected-accounts");
    return { connectedCount: created.length };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Sync Now manual (T-090.3, ADR-093 poin 9) — entry point tipis, hanya
 * resolve context + fetch akun yang relevan lalu memanggil
 * `ImportPostsTriggerUseCase.triggerManual` (AGENTS.md #5). RBAC
 * (Owner/Admin), cap mingguan, cooldown 24 jam, dan guard concurrent-import
 * SEPENUHNYA di Application Service, TIDAK di sini — lihat
 * `assertActorCanTriggerManualImportSync`/`ImportPostsTriggerUseCase` di
 * domain `publishing`.
 *
 * **Di luar scope aksi ini (T-090.5, blocked):** tombol UI yang memanggil
 * action ini, dan render pesan cooldown/cap — menunggu rancangan Claude
 * Design (AGENTS.md rule 17).
 *
 * Lookup akun lewat `WorkspaceService.getConnectedAccountById` (code review
 * Ridwan) — Server Action TIDAK boleh mengimpor `workspaceRepository`
 * langsung untuk akses data (AGENTS.md #5), konsisten dengan seluruh action
 * lain di file ini yang selalu lewat Application Service.
 */
export async function syncNowAction(connectedAccountId: string): Promise<{
  error?: string;
  outcome?: string;
  importedCount?: number;
  skippedDuplicateCount?: number;
}> {
  const { workspaceId, role } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const actorId = asUserId(session.user.id);
  const accountId = asConnectedAccountId(connectedAccountId);

  const workspaceService = new WorkspaceService(workspaceRepository);
  const account = await workspaceService.getConnectedAccountById(
    workspaceId,
    accountId,
    actorId,
  );
  if (!account) {
    return { error: "Akun terhubung tidak ditemukan." };
  }

  try {
    const result = await createImportPostsTriggerUseCase().triggerManual({
      actorRole: role,
      workspaceId,
      connectedAccountId: account.id,
      outstandAccountId: account.outstandAccountId,
      platform: account.platform,
      actingUserId: actorId,
      lastImportedUntil: account.lastImportedUntil,
      lastImportRequestedAt: account.lastImportRequestedAt,
    });

    if (
      result.outcome === "rejected_cap" ||
      result.outcome === "rejected_cooldown" ||
      result.outcome === "rejected_concurrent" ||
      result.outcome === "failed"
    ) {
      return { error: result.message, outcome: result.outcome };
    }

    revalidatePath("/settings/connected-accounts");
    return {
      outcome: result.outcome,
      importedCount: result.importedCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
    };
  } catch (error) {
    return toActionError(error);
  }
}
