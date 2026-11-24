import { cookies } from "next/headers";

import {
  parsePublishViewState,
  pickCalendarSearch,
  PUBLISH_CALENDAR_RANGE_COOKIE,
  PUBLISH_VIEW_COOKIE,
  type PublishViewSearchParams,
  type PublishViewState,
} from "@/domains/publishing";
import { getCachedUserTimeZone } from "@/lib/better-auth/user-time-zone";
import { UserTimeZoneProvider } from "@/lib/time/user-time-zone-context";

import { buildDisplayTimeZoneGroups } from "./components/display-time-zone-groups";
import { DisplayTimeZoneProvider } from "./components/DisplayTimeZoneSelect";
import { PublishPageHeader } from "./components/PublishPageHeader";
import { PublishToolbar } from "./components/PublishToolbar";
import { BoardView } from "./components/views/BoardView";
import { CalendarView } from "./components/views/CalendarView";
import { HistoryPostView } from "./components/views/HistoryPostView";
import { ListFilterProvider } from "./components/views/ListFilter";
import {
  ApprovalsTab,
  DraftsTab,
  getPublishListFilterAccounts,
  getPublishListTabCounts,
  HistoryTab,
  QueueTab,
} from "./components/views/ListTabs";

/**
 * `/publish` — the single Publish page (T-286, S-008, ADR-165). Entry point
 * only: reads the raw `searchParams` and the last-used-view cookie, hands
 * them to `parsePublishViewState` (domain `publishing`), and composes the
 * header, the toolbar and the selected view. Each view calls its
 * Application Service (hard rule 3). Old routes `/publish/calendar|queue|
 * drafts|history[/postId]` redirect here (`legacyPublishHref`).
 *
 * The display time zone (URL `tz`, else the Profile zone) is given to the
 * Publish screens through a nested `UserTimeZoneProvider`, so they show
 * times in it without change; the Draft Editor, mounted by the `(app)`
 * layout, keeps the Profile zone, and the Profile is never written.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PublishViewSearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const cookieStore = await cookies();
  const lastView = cookieStore.get(PUBLISH_VIEW_COOKIE)?.value;
  const lastRange = cookieStore.get(PUBLISH_CALENDAR_RANGE_COOKIE)?.value;
  const profileTimeZone = await getCachedUserTimeZone();
  const state = parsePublishViewState(rawSearchParams, {
    lastView,
    lastRange,
    profileTimeZone,
  });
  // Tab counts and the Filter channels are only shown on the List (T-289).
  const [counts, filterAccounts] =
    state.view === "list"
      ? await Promise.all([
          getPublishListTabCounts(),
          getPublishListFilterAccounts(),
        ])
      : [undefined, undefined];

  const body = (
    <>
      <PublishToolbar
        view={state.view}
        tab={state.tab}
        counts={counts}
        filterAccounts={filterAccounts}
        timeZone={state.timeZone}
        profileTimeZone={profileTimeZone}
      />
      <UserTimeZoneProvider timeZone={state.timeZone}>
        <PublishViewContent state={state} />
      </UserTimeZoneProvider>
    </>
  );

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-286: Tailwind layout composition (ADR-097), not an Astryx stack.
    <div className="flex flex-col gap-3">
      <PublishPageHeader
        view={state.view}
        tab={state.tab}
        timeZone={state.timeZone}
        profileTimeZone={profileTimeZone}
      />
      {/* The time zone picker ends the toolbar row of each view (S-008 design gap 5). */}
      <DisplayTimeZoneProvider
        value={{
          view: state.view,
          tab: state.tab,
          postId: state.postId,
          calendarParams: pickCalendarSearch(rawSearchParams),
          timeZone: state.timeZone,
          profileTimeZone,
          timeZoneGroups: buildDisplayTimeZoneGroups(
            { profileTimeZone, timeZone: state.timeZone },
            new Date(),
          ),
        }}
      >
        {state.view === "list" ? (
          // The List Filter popover (toolbar) and the list share one state;
          // keyed by tab so each tab opens unfiltered (S-008 design gap 4).
          <ListFilterProvider key={state.tab}>{body}</ListFilterProvider>
        ) : (
          body
        )}
      </DisplayTimeZoneProvider>
    </div>
  );
}

function PublishViewContent({ state }: { state: PublishViewState }) {
  if (state.view === "calendar") {
    return <CalendarView calendar={state.calendar} timeZone={state.timeZone} />;
  }
  if (state.view === "board") {
    return <BoardView />;
  }
  switch (state.tab) {
    case "queue":
      return <QueueTab timeZone={state.timeZone} />;
    case "drafts":
      return <DraftsTab />;
    case "approvals":
      return <ApprovalsTab />;
    case "history":
      return state.postId ? (
        <HistoryPostView postId={state.postId} />
      ) : (
        <HistoryTab />
      );
  }
}
