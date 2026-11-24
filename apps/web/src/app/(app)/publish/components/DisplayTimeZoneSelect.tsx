"use client";

import { createContext, useContext, type ReactNode } from "react";
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
import {
  buildPublishSearch,
  type CalendarSearch,
  type PublishListTab,
  type PublishView,
} from "@/domains/publishing";

export interface DisplayTimeZoneGroup {
  region: string;
  options: { value: string; label: string }[];
}

export interface DisplayTimeZoneSettings {
  view: PublishView;
  tab: PublishListTab;
  /** Post open in List · History; kept when only the zone changes. */
  postId: string | null;
  /** Calendar keys of the current URL, kept when only the zone changes. */
  calendarParams: CalendarSearch;
  timeZone: string;
  profileTimeZone: string;
  timeZoneGroups: DisplayTimeZoneGroup[];
}

const DisplayTimeZoneContext = createContext<DisplayTimeZoneSettings | null>(
  null,
);

/**
 * Hands the display time zone of the Publish page to the picker, wherever
 * the toolbar row of the open view renders it (S-008 design gap 5: the
 * picker sits at the end of that row, not on a row of its own). The values
 * come from the server render of the current URL.
 */
export function DisplayTimeZoneProvider({
  value,
  children,
}: {
  value: DisplayTimeZoneSettings;
  children: ReactNode;
}) {
  return (
    <DisplayTimeZoneContext.Provider value={value}>
      {children}
    </DisplayTimeZoneContext.Provider>
  );
}

/**
 * Display time zone picker of the Publish page (T-286); hidden below `sm` (design). It only changes the
 * `tz` of the URL: times on Publish are shown in that zone, the Profile zone
 * (T-147) is never written. Renders nothing outside a provider.
 */
export function DisplayTimeZoneSelect() {
  const settings = useContext(DisplayTimeZoneContext);
  const router = useRouter();
  if (!settings) return null;
  const { view, tab, postId, calendarParams, timeZone, profileTimeZone } =
    settings;

  return (
    <Select
      value={timeZone}
      onValueChange={(next) =>
        router.replace(
          `/publish${buildPublishSearch({
            view,
            tab,
            postId,
            timeZone: next,
            profileTimeZone,
            calendar: calendarParams,
          })}`,
        )
      }
    >
      <SelectTrigger
        size="sm"
        aria-label="Zona waktu tampilan"
        className="max-sm:hidden"
      >
        <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {settings.timeZoneGroups.map((group) => (
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
  );
}
