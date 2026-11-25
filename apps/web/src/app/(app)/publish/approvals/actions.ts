"use server";

import { asPostId, asUserId, ContentStatus } from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ChangeContentStatusUseCase,
  type ContentStatusTransitionTarget,
} from "@/domains/publishing";
import { getCachedSession } from "@/lib/better-auth/session";
import { contentStatusRepository } from "@/lib/repositories/publishing";
import { toActionError } from "@/lib/utils/errors";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

/**
 * Approvals actions (T-289, S-008). Wiring only (hard rule 3): resolve the
 * workspace context and session, delegate to `ChangeContentStatusUseCase`
 * (RBAC, allowed source status, compare-and-set), then revalidate the
 * Publish page so tabs and counts follow.
 */
async function changeContentStatus(
  postId: string,
  to: ContentStatusTransitionTarget,
): Promise<{ error?: string }> {
  const { workspaceId, role } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  try {
    await new ChangeContentStatusUseCase(contentStatusRepository).execute({
      workspaceId,
      postId: asPostId(postId),
      to,
      actorRole: role,
      actingUserId: asUserId(session.user.id),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/publish");
  return {};
}

/** Mark Ready: In Review -> Ready to Schedule. */
export async function markReadyToScheduleAction(postId: string) {
  return changeContentStatus(postId, ContentStatus.ReadyToSchedule);
}

/** Back to Draft: In Review -> Draft. */
export async function backToDraftAction(postId: string) {
  return changeContentStatus(postId, ContentStatus.Draft);
}
