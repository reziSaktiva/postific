"use server";

import { asPostId, asUserId } from "@postific/shared";

import { AnalyticsService } from "@/domains/analytics";
import { IdentityService } from "@/domains/identity";
import { MediaService, type MediaThumbnailDto } from "@/domains/media";
import {
  PublishingService,
  type HistoryDetailItem,
} from "@/domains/publishing";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { getCachedSession } from "@/lib/better-auth/session";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { identityRepository } from "@/lib/repositories/identity";
import { mediaRepository } from "@/lib/repositories/media";
import { publishingRepository } from "@/lib/repositories/publishing";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { resolveHistoryThumbnail } from "../../history/[postId]/history-thumbnail";

export interface PostPreviewData {
  item: HistoryDetailItem;
  /** First media of the post, `type` "video" plays inline; `null` without media. */
  thumbnail: MediaThumbnailDto | null;
}

/**
 * Data of the post preview (T-288, S-008), fetched when a preview opens from
 * a Calendar chip, a Queue or History card or a Board card: the post in any
 * status with its metrics, author and media. Entry point only: composes
 * `PublishingService.getPostPreview` and the thumbnail resolver shared with
 * History (hard rules 3 and 5). `null` when the post is gone or the session
 * expired (the preview closes quietly; no redirect from a background fetch).
 */
export async function getPostPreviewAction(
  postId: string,
): Promise<PostPreviewData | null> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) return null;
  const userId = asUserId(session.user.id);

  const identityService = new IdentityService(
    identityRepository,
    supabaseAvatarStorageAdapter,
  );
  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
    undefined,
    { findById: (id) => identityService.getProfile(id) },
  );

  const item = await publishingService.getPostPreview(
    workspaceId,
    asPostId(postId),
    userId,
  );
  if (!item) return null;

  const thumbnail = await resolveHistoryThumbnail(
    item,
    workspaceId,
    userId,
    new MediaService(mediaRepository, supabaseMediaStorageAdapter),
  );
  return { item, thumbnail };
}
