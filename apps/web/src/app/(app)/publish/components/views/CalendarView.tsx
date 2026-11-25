import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import {
  PublishingService,
  type CalendarViewState,
} from "@/domains/publishing";
import { MediaService } from "@/domains/media";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { mediaRepository } from "@/lib/repositories/media";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";

import { CalendarScreen } from "../../calendar/components/CalendarScreen";
import { getCalendarFetchRange } from "../../calendar/components/calendar-fetch-range";
import { resolvePostThumbnails } from "../preview/post-thumbnails";

/**
 * Calendar view of the Publish page (T-286, redesigned by T-287). Composition only:
 * the state is parsed by `parsePublishViewState` in `page.tsx`, the range
 * comes from `getCalendarFetchRange` in the display time zone, the
 * data from `PublishingService` and `WorkspaceService` (hard rule 3).
 */
export async function CalendarView({
  calendar,
  timeZone,
}: {
  calendar: CalendarViewState;
  /** Display time zone of the Publish page (view-only, T-286). */
  timeZone: string;
}) {
  const { view, date, statuses, connectedAccountIds } = calendar;

  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  // The selected range plus the three days of the phone Calendar (T-292).
  const { from, to } = getCalendarFetchRange(view, date, timeZone);

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );
  const workspaceService = new WorkspaceService(workspaceRepository);

  const [items, accounts, undated] = await Promise.all([
    publishingService.listCalendarPosts(
      { workspaceId, from, to, statuses, connectedAccountIds },
      userId,
    ),
    workspaceService.listConnectedAccounts(workspaceId, userId),
    // "No date" panel (T-287): Draft, In Review and Ready to Schedule.
    publishingService.listDrafts(workspaceId, userId),
  ]);

  // Chip thumbnails (T-287): one batched lookup for the whole range.
  const thumbnails = await resolvePostThumbnails(
    items,
    workspaceId,
    userId,
    new MediaService(mediaRepository, supabaseMediaStorageAdapter),
  );

  return (
    <CalendarScreen
      view={view}
      date={date}
      items={items}
      accounts={accounts}
      statuses={statuses}
      connectedAccountIds={connectedAccountIds}
      workspaceId={workspaceId}
      thumbnails={thumbnails}
      undatedPosts={undated.map((post) => ({
        id: post.id,
        caption: post.caption,
        status: post.status,
        updatedAt: post.updatedAt,
      }))}
    />
  );
}
