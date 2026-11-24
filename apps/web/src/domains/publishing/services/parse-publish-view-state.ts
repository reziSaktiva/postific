import { asPostId } from "@postific/shared";
import type { PostId } from "@postific/shared";

import { isValidTimeZone } from "@/lib/time/is-valid-time-zone";

import {
  parseCalendarViewState,
  type CalendarViewSearchParams,
  type CalendarViewState,
} from "./parse-calendar-view-state";

/**
 * View state of the single Publish page (T-286, S-008, ADR-165). Everything
 * the page shows is carried in the URL of `/publish`:
 *
 * - `view`: `calendar` | `list` | `board` (the header view switcher).
 * - `tab`: the List tab, `queue` | `drafts` | `approvals` | `history`.
 * - `range`, `date`, `status`, `accounts`: the Calendar state, parsed by
 *   `parseCalendarViewState` next to this file.
 * - `tz`: the display time zone (IANA). View-only: it never writes the
 *   Profile time zone (T-147); without it the Profile time zone is used.
 * - `post`: a post opened from an old `/publish/history/[postId]` link.
 *
 * When `view` is missing, the view last used by this user (cookie
 * `PUBLISH_VIEW_COOKIE`) is reopened; Calendar when there is none.
 * Pure functions, no I/O: used by `page.tsx` (raw `searchParams`) and by
 * client components, so both sides apply the same fallbacks.
 */

export const PUBLISH_VIEWS = ["calendar", "list", "board"] as const;
export type PublishView = (typeof PUBLISH_VIEWS)[number];

export const PUBLISH_LIST_TABS = [
  "queue",
  "drafts",
  "approvals",
  "history",
] as const;
export type PublishListTab = (typeof PUBLISH_LIST_TABS)[number];

export const DEFAULT_PUBLISH_VIEW: PublishView = "calendar";
export const DEFAULT_PUBLISH_LIST_TAB: PublishListTab = "queue";

/** Cookie holding the last used Publish view (server-readable, no schema). */
export const PUBLISH_VIEW_COOKIE = "publish_view";

export type PublishViewSearchParams = CalendarViewSearchParams;

export interface PublishViewState {
  view: PublishView;
  tab: PublishListTab;
  calendar: CalendarViewState;
  /** Display time zone for Publish only (URL `tz`, else the Profile zone). */
  timeZone: string;
  /** Post to show (old `/publish/history/[postId]` links), else `null`. */
  postId: PostId | null;
}

export interface PublishViewDefaults {
  /** Raw value of the `PUBLISH_VIEW_COOKIE` cookie, if any. */
  lastView?: string | null;
  /** Profile time zone (T-147); the display zone when `tz` is absent. */
  profileTimeZone: string;
}

export function isPublishView(value: unknown): value is PublishView {
  return (
    typeof value === "string" &&
    (PUBLISH_VIEWS as readonly string[]).includes(value)
  );
}

export function isPublishListTab(value: unknown): value is PublishListTab {
  return (
    typeof value === "string" &&
    (PUBLISH_LIST_TABS as readonly string[]).includes(value)
  );
}

/**
 * Parse the Publish view state. Invalid values fall back silently, like
 * `parseCalendarViewState`: an unknown `view` uses the last used view, an
 * unknown `tab` uses Queue, an unknown `tz` uses the Profile zone. The old
 * `?view=week|month` of `/publish/calendar` opens Calendar on that range.
 */
export function parsePublishViewState(
  searchParams: PublishViewSearchParams,
  defaults: PublishViewDefaults,
): PublishViewState {
  const rawView = firstValue(searchParams.view);
  const rawPost = firstValue(searchParams.post)?.trim();
  const rawTimeZone = firstValue(searchParams.tz)?.trim();
  const rawTab = firstValue(searchParams.tab);

  return {
    view: resolveView(rawView, defaults.lastView),
    tab: isPublishListTab(rawTab) ? rawTab : DEFAULT_PUBLISH_LIST_TAB,
    calendar: parseCalendarViewState(searchParams),
    timeZone:
      rawTimeZone && isValidTimeZone(rawTimeZone)
        ? rawTimeZone
        : defaults.profileTimeZone,
    postId: rawPost ? asPostId(rawPost) : null,
  };
}

function resolveView(
  rawView: string | undefined,
  lastView: string | null | undefined,
): PublishView {
  if (isPublishView(rawView)) return rawView;
  if (rawView === "week" || rawView === "month") return "calendar";
  if (isPublishView(lastView)) return lastView;
  return DEFAULT_PUBLISH_VIEW;
}

/**
 * Query string (with leading `?`, or `""`) for the Publish page. Keys that
 * belong to another view are left out, so switching views does not carry a
 * stale List tab or Calendar range. `timeZone` equal to `profileTimeZone`
 * is left out: the URL only names a zone the user picked on this page.
 */
export function buildPublishSearch(next: {
  view: PublishView;
  tab?: PublishListTab;
  postId?: string | null;
  timeZone?: string | null;
  profileTimeZone?: string;
  /** Calendar keys (`range`, `date`, `status`, `accounts`) to keep. */
  calendar?: CalendarSearch;
}): string {
  const params = new URLSearchParams();
  params.set("view", next.view);
  if (next.view === "list") {
    params.set("tab", next.tab ?? DEFAULT_PUBLISH_LIST_TAB);
    if (next.postId) params.set("post", next.postId);
  }
  if (next.view === "calendar" && next.calendar) {
    for (const key of ["range", "date", "status", "accounts"] as const) {
      const value = next.calendar[key];
      if (value) params.set(key, value);
    }
  }
  if (next.timeZone && next.timeZone !== next.profileTimeZone) {
    params.set("tz", next.timeZone);
  }
  return `?${params.toString()}`;
}

export type CalendarSearch = Partial<
  Record<"range" | "date" | "status" | "accounts", string>
>;

/**
 * Calendar keys of a Publish URL, to keep them when only another key (the
 * display zone) changes. The old `?view=week|month` becomes `range`.
 */
export function pickCalendarSearch(
  searchParams: PublishViewSearchParams,
): CalendarSearch {
  const legacyView = firstValue(searchParams.view);
  const picked: CalendarSearch = {
    range:
      firstValue(searchParams.range) ??
      (legacyView === "week" || legacyView === "month"
        ? legacyView
        : undefined),
    date: firstValue(searchParams.date),
    status: firstValue(searchParams.status),
    accounts: firstValue(searchParams.accounts),
  };
  for (const key of Object.keys(picked) as (keyof CalendarSearch)[]) {
    if (!picked[key]) delete picked[key];
  }
  return picked;
}

/** Old Publish routes that now land on the single page (S-008). */
export type LegacyPublishRoute = "calendar" | "queue" | "drafts" | "history";

/**
 * Address on the single Publish page for an old route:
 * `/publish/calendar` → Calendar (keeping range, date and filters; the old
 * `?view=week|month` becomes `range`), `/publish/queue|drafts|history` →
 * List on that tab, `/publish/history/[postId]` → List · History with that
 * post. A `tz` already in the URL is kept.
 */
export function legacyPublishHref(
  route: LegacyPublishRoute,
  searchParams: PublishViewSearchParams,
  postId?: string,
): string {
  const timeZone = firstValue(searchParams.tz) ?? null;
  if (route === "calendar") {
    return `/publish${buildPublishSearch({
      view: "calendar",
      timeZone,
      calendar: pickCalendarSearch(searchParams),
    })}`;
  }
  return `/publish${buildPublishSearch({
    view: "list",
    tab: route,
    postId: route === "history" ? (postId ?? null) : null,
    timeZone,
  })}`;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
