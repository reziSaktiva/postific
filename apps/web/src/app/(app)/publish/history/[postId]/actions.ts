"use server";

import { asPostId, asPostTargetId, asUserId } from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { MediaService } from "@/domains/media";
import {
  RetryFailedTargetUseCase,
  type PostMediaLookupPort,
} from "@/domains/publishing";
import { toActionError } from "@/lib/utils/errors";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { publishingRepository } from "@/lib/repositories/publishing";
import { mediaRepository } from "@/lib/repositories/media";

function createPostMediaLookup(): PostMediaLookupPort {
  const mediaService = new MediaService(mediaRepository);
  return {
    listByIds: (input, userId) => mediaService.listByIds(input, userId),
    downloadBytes: (storagePath) =>
      supabaseMediaStorageAdapter.downloadMedia(storagePath),
    saveOutstandWorkingCopy: (input, userId) =>
      mediaService.saveOutstandWorkingCopy(input, userId),
  };
}

/**
 * Retry manual (T-034.4, ADR-092) — dipanggil dari tombol "Coba Lagi" di
 * halaman detail History (`components/HistoryDetail.tsx`) untuk satu
 * target yang berstatus `failed`. Business logic (RBAC, guard status
 * target, pola delete-lalu-create-ulang, recompute status post) hidup di
 * `RetryFailedTargetUseCase.execute` — action ini hanya wiring: resolve
 * workspace context/session, delegasikan ke use-case, lalu revalidate
 * halaman detail ini supaya badge status target langsung ter-update tanpa
 * perlu refresh manual.
 */
export async function retryFailedTargetAction(
  postId: string,
  targetId: string,
): Promise<{ error?: string }> {
  const { workspaceId, role } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  let result;
  try {
    result = await new RetryFailedTargetUseCase(
      publishingRepository,
      getOutstandAdapter(),
      createPostMediaLookup(),
    ).execute({
      workspaceId,
      postId: asPostId(postId),
      targetId: asPostTargetId(targetId),
      actorRole: role,
      actingUserId: asUserId(session.user.id),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/publish/history/${postId}`);
  return result.status === "failed"
    ? { error: result.error ?? "Retry gagal — silakan coba lagi." }
    : {};
}
