"use server";

import {
  asMemberId,
  asUserId,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import { redirect } from "next/navigation";
import { NotificationService } from "@/domains/notification";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { notificationRepository } from "@/lib/repositories/notification";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { toActionError } from "@/lib/utils/errors";

// Server Actions untuk Workspace Settings → General + Danger Zone (T-008.2,
// T-008.3, ADR-049, ADR-050). Entry point ini HANYA memanggil
// `WorkspaceService` (AGENTS.md #5) — business logic (RBAC, validasi target,
// atomic role swap) ada di domain/service layer, bukan di sini.
//
// UI yang mengonsumsi action ini (dialog konfirmasi Tier 1 "ketik nama
// workspace", banner pending transfer) — T-008.4, lihat
// `components/WorkspaceGeneralSettings.tsx`. `renameWorkspaceAction` di
// bawah juga T-008.4 (field "Nama Workspace" di card General, tanpa
// konfirmasi — reversible/low-stakes).

/**
 * Guard sesi + workspace context yang sebelumnya diulang identik di tiap
 * Server Action di file ini — satu tempat untuk redirect ke `/login` kalau
 * belum login.
 */
async function requireActionContext(): Promise<{
  workspaceId: WorkspaceId;
  userId: UserId;
}> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  return { workspaceId, userId: asUserId(session.user.id) };
}

/**
 * Composition root untuk `WorkspaceService` di file ini — menyuplai
 * `NotificationService` lewat `NotificationPort` (cross-domain
 * `workspace` → `notification`, AGENTS.md #7).
 */
function createWorkspaceService(): WorkspaceService {
  const notificationService = new NotificationService(notificationRepository);
  return new WorkspaceService(
    workspaceRepository,
    undefined,
    notificationService,
  );
}

export async function deleteWorkspaceAction(): Promise<{ error?: string }> {
  const { workspaceId, userId } = await requireActionContext();

  try {
    await createWorkspaceService().deleteWorkspace(workspaceId, userId);
  } catch (error) {
    return toActionError(error);
  }

  // Workspace aktif sudah terhapus — sama seperti `(app)/layout.tsx` saat
  // tidak ada default workspace ditemukan untuk user ini.
  redirect("/onboarding");
}

export async function transferOwnershipAction(
  targetMemberId: string,
): Promise<{ error?: string }> {
  const { workspaceId, userId } = await requireActionContext();

  try {
    await createWorkspaceService().transferOwnership(
      workspaceId,
      userId,
      asMemberId(targetMemberId),
    );
  } catch (error) {
    return toActionError(error);
  }

  return {};
}

export async function cancelOwnershipTransferAction(): Promise<{
  error?: string;
}> {
  const { workspaceId, userId } = await requireActionContext();

  try {
    await createWorkspaceService().cancelOwnershipTransfer(workspaceId, userId);
  } catch (error) {
    return toActionError(error);
  }

  return {};
}

export type RenameWorkspaceActionResult =
  { ok: false; error: string } | { ok: true; name: string };

export async function renameWorkspaceAction(
  name: string,
): Promise<RenameWorkspaceActionResult> {
  const { workspaceId, userId } = await requireActionContext();

  try {
    const workspace = await createWorkspaceService().renameWorkspace(
      workspaceId,
      userId,
      name,
    );
    return { ok: true, name: workspace.name };
  } catch (error) {
    const { error: message } = toActionError(error);
    return { ok: false, error: message };
  }
}

export async function acceptOwnershipTransferAction(): Promise<{
  error?: string;
}> {
  const { workspaceId, userId } = await requireActionContext();

  try {
    await createWorkspaceService().acceptOwnershipTransfer(workspaceId, userId);
  } catch (error) {
    return toActionError(error);
  }

  return {};
}
