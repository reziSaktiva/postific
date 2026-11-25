import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import { MediaService } from "@/domains/media";
import { PublishingService } from "@/domains/publishing";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { getCachedSession } from "@/lib/better-auth/session";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { mediaRepository } from "@/lib/repositories/media";
import { publishingRepository } from "@/lib/repositories/publishing";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { BoardScreen } from "../../board/components/BoardScreen";
import { resolvePostThumbnails } from "../preview/post-thumbnails";

/**
 * Board view of the Publish page (T-290, S-008). Composition only: the
 * columns come from `PublishingService.listBoardColumns` and the card
 * thumbnails from one batched media lookup (hard rules 3 and 5).
 */
export async function BoardView() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );
  const columns = await publishingService.listBoardColumns(workspaceId, userId);

  const thumbnails = await resolvePostThumbnails(
    columns.flatMap((column) => column.items),
    workspaceId,
    userId,
    new MediaService(mediaRepository, supabaseMediaStorageAdapter),
  );

  return <BoardScreen columns={columns} thumbnails={thumbnails} />;
}
