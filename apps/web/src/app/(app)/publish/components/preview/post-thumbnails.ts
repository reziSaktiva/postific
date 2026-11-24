import type { MediaId, UserId, WorkspaceId } from "@postific/shared";

import type { MediaService, MediaThumbnailDto } from "@/domains/media";

import { resolveSnapshotThumbnail } from "../../../components/snapshot-thumbnail";

/** What the resolver reads from a post; `CalendarItemRecord` and the Board items fit. */
export interface PostThumbnailSource {
  id: string;
  mediaIds?: readonly string[];
  targets: readonly { thumbnailStoragePath?: string | null }[];
}

/**
 * One thumbnail per post for the Calendar chips and Board cards (T-287,
 * T-290, S-008), resolved for a whole list in two batched calls instead of
 * one per post: the first media of every post with `mediaIds` (signed URL,
 * `type` tells an image from a video, which gets the play mark), and the
 * stored thumbnail of an imported post that has no media of its own
 * (ADR-158). The resolver is the same one Engage and History use
 * (`resolveSnapshotThumbnail`), not a copy of its rules.
 *
 * Posts without a thumbnail are left out of the result. A failed lookup
 * never throws: the chips just show no thumbnail.
 */
export async function resolvePostThumbnails(
  posts: readonly PostThumbnailSource[],
  workspaceId: WorkspaceId,
  userId: UserId,
  mediaService: Pick<MediaService, "listByIds" | "signStoragePaths">,
): Promise<Record<string, MediaThumbnailDto>> {
  const firstMediaIds = new Set<string>();
  const storagePaths = new Set<string>();
  for (const post of posts) {
    const firstMediaId = post.mediaIds?.[0];
    if (firstMediaId) {
      firstMediaIds.add(firstMediaId);
      continue;
    }
    const path = firstStoragePath(post);
    if (path) storagePaths.add(path);
  }

  const thumbnailByMediaId = new Map<string, MediaThumbnailDto>();
  if (firstMediaIds.size > 0) {
    try {
      const items = await mediaService.listByIds(
        { workspaceId, mediaIds: [...firstMediaIds] as MediaId[] },
        userId,
      );
      for (const item of items) {
        if (item.url) {
          thumbnailByMediaId.set(item.id, { url: item.url, type: item.type });
        }
      }
    } catch (error) {
      console.error("resolvePostThumbnails: gagal resolve media", error);
    }
  }

  let signedStoragePaths = new Map<string, string>();
  if (storagePaths.size > 0) {
    try {
      signedStoragePaths = await mediaService.signStoragePaths(workspaceId, [
        ...storagePaths,
      ]);
    } catch (error) {
      console.error("resolvePostThumbnails: gagal tanda tangan", error);
    }
  }

  const result: Record<string, MediaThumbnailDto> = {};
  for (const post of posts) {
    const thumbnail = resolveSnapshotThumbnail(
      {
        mediaIds: [...(post.mediaIds ?? [])],
        thumbnailStoragePath: firstStoragePath(post),
      },
      thumbnailByMediaId,
      signedStoragePaths,
    );
    if (thumbnail) result[post.id] = thumbnail;
  }
  return result;
}

function firstStoragePath(post: PostThumbnailSource): string | null {
  return (
    post.targets.find((target) => target.thumbnailStoragePath)
      ?.thumbnailStoragePath ?? null
  );
}
