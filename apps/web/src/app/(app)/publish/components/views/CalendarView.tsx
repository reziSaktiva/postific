import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import {
  getMonthRange,
  getWeekRange,
  PublishingService,
  type CalendarViewState,
} from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { CalendarScreen } from "../../calendar/components/CalendarScreen";

/**
 * Calendar view of the Publish page (T-286, moved from the old
 * `/publish/calendar` page as is; T-287 redesigns it). Composition only:
 * the state is parsed by `parsePublishViewState` in `page.tsx`, the range
 * comes from `getWeekRange`/`getMonthRange` in the display time zone, the
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

  const { from, to } =
    view === "month"
      ? getMonthRange(date, timeZone)
      : getWeekRange(date, timeZone);

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );
  const workspaceService = new WorkspaceService(workspaceRepository);

  const [items, accounts] = await Promise.all([
    publishingService.listCalendarPosts(
      { workspaceId, from, to, statuses, connectedAccountIds },
      userId,
    ),
    workspaceService.listConnectedAccounts(workspaceId, userId),
  ]);

  return (
    <CalendarScreen
      view={view}
      date={date}
      items={items}
      accounts={accounts}
      statuses={statuses}
      connectedAccountIds={connectedAccountIds}
      workspaceId={workspaceId}
    />
  );
}
