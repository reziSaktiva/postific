"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon } from "@hugeicons/core-free-icons";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildPublishSearch,
  PUBLISH_LIST_TABS,
  type CalendarSearch,
  type PublishListTab,
  type PublishListTabCounts,
  type PublishView,
} from "@/domains/publishing";
import { cn } from "@/lib/utils";

const TAB_LABEL: Record<PublishListTab, string> = {
  queue: "Queue",
  drafts: "Drafts",
  approvals: "Approvals",
  history: "History",
};

export interface DisplayTimeZoneGroup {
  region: string;
  options: { value: string; label: string }[];
}

/**
 * Toolbar row of the Publish page (T-286): the List tabs Queue · Drafts ·
 * Approvals · History when the List view is open (line tabs that navigate,
 * as the old route tabbar did; a dropdown with the same tabs and counts
 * below `sm`, T-292), and on the right the display time zone picker. Counts on the tabs and the per-view toolbar controls (Calendar
 * range, Filter, "No date", options menu) come with T-287 and T-289.
 *
 * The time zone picker only changes the `tz` of the URL: times on Publish
 * are shown in that zone, the Profile zone (T-147) is never written.
 */
export function PublishToolbar({
  view,
  tab,
  postId,
  calendarParams,
  timeZone,
  profileTimeZone,
  timeZoneGroups,
  counts,
}: {
  view: PublishView;
  tab: PublishListTab;
  /** Post open in List · History; kept when only the zone changes. */
  postId: string | null;
  /** Calendar keys of the current URL, kept when only the zone changes. */
  calendarParams: CalendarSearch;
  timeZone: string;
  profileTimeZone: string;
  timeZoneGroups: DisplayTimeZoneGroup[];
  /** Count per List tab (T-289); tabs show no number until it is given. */
  counts?: PublishListTabCounts;
}) {
  const router = useRouter();

  const href = (next: { tab?: PublishListTab; timeZone?: string }) =>
    `/publish${buildPublishSearch({
      view,
      tab: next.tab ?? tab,
      postId: next.tab ? null : postId,
      timeZone: next.timeZone ?? timeZone,
      profileTimeZone,
      calendar: calendarParams,
    })}`;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-286: Tailwind layout composition (ADR-097), not an Astryx stack.
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2",
        view === "list" && "border-b border-border pb-1.5",
      )}
    >
      {/* eslint-disable-next-line no-restricted-syntax -- T-286, same as above */}
      <div className="min-w-0 overflow-x-auto">
        {view === "list" ? (
          <Select
            value={tab}
            onValueChange={(next) => {
              if (next !== tab)
                router.push(href({ tab: next as PublishListTab }));
            }}
          >
            <SelectTrigger size="sm" aria-label="Daftar" className="sm:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {PUBLISH_LIST_TABS.map((value) => (
                <SelectItem key={value} value={value}>
                  {TAB_LABEL[value]}
                  {counts ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {counts[value]}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {view === "list" ? (
          <Tabs value={tab} activationMode="manual" className="max-sm:hidden">
            <TabsList variant="line" aria-label="Daftar">
              {PUBLISH_LIST_TABS.map((value) => (
                <TabsTrigger key={value} value={value} asChild>
                  <Link href={href({ tab: value })}>
                    {TAB_LABEL[value]}
                    {counts ? (
                      <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                        {counts[value]}
                      </span>
                    ) : null}
                  </Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>
      <Select
        value={timeZone}
        onValueChange={(next) => router.replace(href({ timeZone: next }))}
      >
        <SelectTrigger size="sm" aria-label="Zona waktu tampilan">
          <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {timeZoneGroups.map((group) => (
            <SelectGroup key={group.region}>
              <SelectLabel>{group.region}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
