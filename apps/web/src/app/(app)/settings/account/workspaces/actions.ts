"use server";

import { asUserId, asWorkspaceId, type UserId } from "@postific/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { toActionError } from "@/lib/utils/errors";
import {
  ACTIVE_WORKSPACE_ID_COOKIE,
  activeWorkspaceCookieOptions,
} from "@/lib/workspace/active-workspace-cookie";

// Server Actions untuk Settings → Account → Workspaces (T-089.3, ADR-088).
// Entry point ini HANYA memanggil `WorkspaceService` (AGENTS.md #5) — RBAC/
// validasi membership ada di domain/service layer, bukan di sini. Dipanggil
// LANGSUNG (bukan lewat <form action>) dari Client Component
// `WorkspacesSettingsView` (T-089.3/.4, dikerjakan paralel) — signature
// harus tetap `(arg: string) => Promise<{ error: string } | void>`.

/**
 * Guard sesi — satu-satunya prasyarat kedua action di file ini (beda dengan
 * `settings/actions.ts` yang juga butuh `workspaceId` context aktif; di
 * sini `workspaceId` aktif justru yang SEDANG diganti/dibuat, jadi tidak
 * diambil dari `getWorkspaceContext()`).
 */
async function requireUserId(): Promise<UserId> {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  return asUserId(session.user.id);
}

function createWorkspaceService(): WorkspaceService {
  return new WorkspaceService(workspaceRepository);
}

/**
 * Switch workspace aktif (T-089.2, ADR-088) — validasi membership lewat
 * `WorkspaceService.switchWorkspace`, lalu overwrite cookie
 * `active-workspace-id` dan redirect Home. Gagal (bukan anggota
 * aktif) → return `{ error }`, TIDAK redirect.
 */
export async function switchWorkspaceAction(
  targetWorkspaceId: string,
): Promise<{ error: string } | void> {
  const userId = await requireUserId();

  try {
    await createWorkspaceService().switchWorkspace({
      userId,
      targetWorkspaceId: asWorkspaceId(targetWorkspaceId),
    });
  } catch (error) {
    return toActionError(error);
  }

  (await cookies()).set(
    ACTIVE_WORKSPACE_ID_COOKIE,
    targetWorkspaceId,
    activeWorkspaceCookieOptions(),
  );
  redirect("/");
}

/**
 * Buat workspace baru dari halaman Workspace Switcher (T-089.4) — reuse
 * `WorkspaceService.createWorkspace` (T-006, sudah stabil). Sesuai copy
 * desain "Workspace baru akan langsung aktif dan Anda pindah ke sana
 * setelah dibuat" — cookie di-overwrite ke workspace baru, lalu redirect
 * Home, sama seperti alur `onboarding/components/actions.ts`.
 */
export async function createWorkspaceAction(
  name: string,
): Promise<{ error: string } | void> {
  const userId = await requireUserId();

  let workspace;
  try {
    workspace = await createWorkspaceService().createWorkspace({
      userId,
      name,
    });
  } catch (error) {
    return toActionError(error);
  }

  (await cookies()).set(
    ACTIVE_WORKSPACE_ID_COOKIE,
    workspace.id,
    activeWorkspaceCookieOptions(),
  );
  redirect("/");
}
