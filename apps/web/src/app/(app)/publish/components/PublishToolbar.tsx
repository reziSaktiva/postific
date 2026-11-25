"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildPublishSearch,
  PUBLISH_LIST_TABS,
  type PublishListTab,
  type PublishListTabCounts,
  type PublishView,
} from "@/domains/publishing";
import { cn } from "@/lib/utils";

import { DisplayTimeZoneSelect } from "./DisplayTimeZoneSelect";
import { ListFilterPopover, type ListFilterAccount } from "./views/ListFilter";

const TAB_LABEL: Record<PublishListTab, string> = {
  queue: "Queue",
  drafts: "Drafts",
  approvals: "Approvals",
  history: "History",
};

/**
 * Toolbar row of the Publish page (T-286, `ScreenPublishRedesain`). List:
 * the tabs Queue · Drafts · Approvals · History (line tabs that navigate; a
 * dropdown with the same tabs and counts below `sm`, T-292), then on the
 * right the Filter popover (S-008 design gap 4) and the display time zone
 * picker. Board: the time zone picker on the right. Calendar: nothing here,
 * the Calendar toolbar is the row and ends with the time zone picker
 * (design gap 5), so the Calendar controls stay on one row at desktop.
 */
export function PublishToolbar({
  view,
  tab,
  timeZone,
  profileTimeZone,
  counts,
  filterAccounts = [],
}: {
  view: PublishView;
  tab: PublishListTab;
  timeZone: string;
  profileTimeZone: string;
  /** Count per List tab (T-289); tabs show no number until it is given. */
  counts?: PublishListTabCounts;
  /** Channels of the List Filter popover (connected accounts). */
  filterAccounts?: ListFilterAccount[];
}) {
  const router = useRouter();

  if (view === "calendar") return null;

  // A tab change drops the open History post and keeps the display zone.
  const tabHref = (next: PublishListTab) =>
    `/publish${buildPublishSearch({
      view,
      tab: next,
      postId: null,
      timeZone,
      profileTimeZone,
    })}`;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-286: Tailwind layout composition (ADR-097), not an Astryx stack.
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2",
        view === "list" && "border-b border-border pb-1.5",
        // Board has only the time zone picker here, which is hidden below
        // `sm`; the empty row is hidden with it (T-292 re-check).
        view === "board" && "max-sm:hidden",
      )}
    >
      {/* eslint-disable-next-line no-restricted-syntax -- T-286, same as above */}
      <div className="min-w-0 overflow-x-auto overflow-y-hidden">
        {view === "list" ? (
          <Select
            value={tab}
            onValueChange={(next) => {
              if (next !== tab) router.push(tabHref(next as PublishListTab));
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
                  <Link href={tabHref(value)}>
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
      {/* eslint-disable-next-line no-restricted-syntax -- S-008: layout-only */}
      <div className="flex items-center gap-2">
        {view === "list" ? (
          <>
            <ListFilterPopover tab={tab} accounts={filterAccounts} />
            <Separator
              orientation="vertical"
              className="my-1.5 max-sm:hidden"
            />
          </>
        ) : null}
        <DisplayTimeZoneSelect />
      </div>
    </div>
  );
}
