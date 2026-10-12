"use server";

import { asUserId, asWorkspaceId } from "@postific/shared";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceService } from "@/domains/workspace";
import { auth } from "@/lib/better-auth/auth";
import { workspaceRepository } from "@/lib/repositories/workspace";
import {
  ConflictError,
  toActionError,
  ValidationError,
} from "@/lib/utils/errors";
import {
  ACTIVE_WORKSPACE_ID_COOKIE,
  activeWorkspaceCookieOptions,
} from "@/lib/workspace/active-workspace-cookie";

export async function createWorkspaceAction(
  name: string,
): Promise<{ error: string } | void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);

  let workspace;
  try {
    workspace = await workspaceService.createWorkspace({
      userId: asUserId(session.user.id),
      name,
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ConflictError) {
      return { error: error.message };
    }
    throw error;
  }

  (await cookies()).set(
    ACTIVE_WORKSPACE_ID_COOKIE,
    workspace.id,
    activeWorkspaceCookieOptions(),
  );
  redirect("/");
}

/**
 * T-039.4 — pilih salah satu workspace saat user existing kehilangan cookie
 * `active-workspace-id` dan punya >1 membership aktif (state "Pilih
 * Workspace" di `/onboarding`). Reuse `WorkspaceService.switchWorkspace`
 * untuk validasi membership aktif (bukan literal "switch dari workspace
 * lain" — di titik ini belum ada cookie aktif sama sekali), pola cookie
 * sama seperti `switchWorkspaceAction` (Settings → Account → Workspaces,
 * T-089.2).
 */
export async function selectWorkspaceAction(
  workspaceId: string,
): Promise<{ error: string } | void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);

  try {
    await workspaceService.switchWorkspace({
      userId: asUserId(session.user.id),
      targetWorkspaceId: asWorkspaceId(workspaceId),
    });
  } catch (error) {
    return toActionError(error);
  }

  (await cookies()).set(
    ACTIVE_WORKSPACE_ID_COOKIE,
    workspaceId,
    activeWorkspaceCookieOptions(),
  );
  redirect("/");
}
