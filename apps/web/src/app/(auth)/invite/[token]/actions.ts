"use server";

import { asUserId, MemberRole } from "@postific/shared";
import { cookies } from "next/headers";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { toActionError } from "@/lib/utils/errors";
import { createWorkspaceServiceWithInviteEmailSender } from "@/lib/workspace/invite-email-workspace-service";
import {
  ACTIVE_WORKSPACE_ID_COOKIE,
  activeWorkspaceCookieOptions,
} from "@/lib/workspace/active-workspace-cookie";

/**
 * Request kode verifikasi OTP (T-110.2, KI-053) — dipanggil
 * `AcceptInviteForm` SETELAH submit form Nama+Password, SEBELUM
 * `authClient.signUp.email` (jalur `isExistingUser: false` saja; akun
 * BELUM dibuat di titik ini, TIDAK ada sesi Better Auth untuk dibaca —
 * beda dari `acceptInviteAction` di bawah). Entry point ini HANYA
 * memanggil `WorkspaceService.requestInviteEmailVerification` (AGENTS.md
 * #5) — validasi/race-guard/generate-kode/kirim-email semuanya di
 * service+repository+adapter layer. Dipakai juga untuk tombol "Kirim
 * ulang" (composition root sama, tidak ada rate-limit tambahan di luar
 * `verificationAttempts` yang sudah ada untuk percobaan KODE — cooldown
 * "Kirim ulang" murni UX di client, lihat `AcceptInviteForm.tsx`).
 */
export async function requestAcceptInviteVerificationAction(
  token: string,
): Promise<{ error?: string }> {
  const workspaceService = createWorkspaceServiceWithInviteEmailSender();

  try {
    await workspaceService.requestInviteEmailVerification(token);
  } catch (error) {
    return toActionError(error);
  }

  return {};
}

/**
 * Konfirmasi kode verifikasi OTP (T-110.3, KI-053) — dipanggil
 * `AcceptInviteForm` setelah user submit kode 6 digit. TIDAK butuh
 * `InviteEmailSenderPort` (tidak mengirim email) — `WorkspaceService`
 * default (tanpa composition root khusus) sudah cukup, pola sama
 * `acceptInviteAction` di bawah.
 */
export async function confirmAcceptInviteVerificationAction(
  token: string,
  code: string,
): Promise<{ error?: string }> {
  const workspaceService = new WorkspaceService(workspaceRepository);

  try {
    await workspaceService.confirmInviteEmailVerification(token, code);
  } catch (error) {
    return toActionError(error);
  }

  return {};
}

/**
 * Finalisasi accept-invite (T-093.2/.3, ADR-080) — dipanggil dari
 * `AcceptInviteForm` SETELAH `authClient.signUp.email`/`signIn.email`
 * berhasil di client (sesi Better Auth sudah aktif saat request Server
 * Action ini sampai ke server, pola sama seperti `LoginForm`/`RegisterForm`
 * yang `router.push` setelah `authClient` resolve). Entry point ini HANYA
 * memanggil `WorkspaceService.acceptInvite` (AGENTS.md #5) — RBAC/validasi
 * email-bound/expiry/race-guard token semuanya di service+repository layer.
 *
 * Cookie `active-workspace-id` di-set ke workspace yang baru diikuti supaya
 * `proxy.ts` langsung meresolve context workspace itu begitu client
 * redirect ke "/" (pola identik `createWorkspaceAction`/`switchWorkspaceAction`).
 * TIDAK memanggil `redirect()` di sini — client menampilkan state "Success"
 * dulu (desain Claude Design) sebelum auto-redirect, jadi navigasi dilakukan
 * client-side (`router.push`) setelah action ini resolve.
 */
export async function acceptInviteAction(
  token: string,
): Promise<{ error?: string; workspaceId?: string; role?: MemberRole }> {
  const session = await getCachedSession();
  if (!session) {
    return {
      error: "Sesi tidak ditemukan. Coba masuk/buat akun lagi.",
    };
  }

  const workspaceService = new WorkspaceService(workspaceRepository);

  let result: Awaited<ReturnType<WorkspaceService["acceptInvite"]>>;
  try {
    result = await workspaceService.acceptInvite({
      token,
      actorUserId: asUserId(session.user.id),
      actorEmail: session.user.email,
    });
  } catch (error) {
    return toActionError(error);
  }

  (await cookies()).set(
    ACTIVE_WORKSPACE_ID_COOKIE,
    result.workspaceId,
    activeWorkspaceCookieOptions(),
  );

  return { workspaceId: result.workspaceId, role: result.role };
}
