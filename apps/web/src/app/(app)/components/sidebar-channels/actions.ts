"use server";

import { asConnectedAccountId, asUserId } from "@postific/shared";
import { redirect } from "next/navigation";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { toActionError } from "@/lib/utils/errors";

// Pola sama seperti settings/members/actions.ts — workspaceId dari
// getWorkspaceContext() (header proxy.ts), actorUserId dari getCachedSession().

/**
 * Persist urutan channel sidebar personal user (T-012.1) — dipanggil
 * fire-and-forget dari `ChannelsSection.handleDrop` setelah reorder
 * optimistic di client. Tidak ada `revalidatePath`/`router.refresh()` di
 * sini secara sengaja — biarkan revalidasi natural di navigasi berikutnya,
 * hindari flicker sidebar.
 */
export async function reorderChannelsAction(
  orderedConnectedAccountIds: string[],
): Promise<{ error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);

  try {
    await workspaceService.saveChannelOrder(
      workspaceId,
      asUserId(session.user.id),
      orderedConnectedAccountIds.map(asConnectedAccountId),
    );
  } catch (error) {
    return toActionError(error);
  }

  return {};
}
