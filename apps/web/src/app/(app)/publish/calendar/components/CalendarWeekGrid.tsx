"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ConnectedAccountId, PostId } from "@postific/shared";
import type { MediaThumbnailDto } from "@/domains/media";
import type { CalendarPostItem } from "@/domains/publishing";
import { getDateParts, getHour, getWeekRange } from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

import { cn } from "@/lib/utils";

import { CalendarChip } from "./CalendarChip";
import {
  addDays,
  type CalendarCardEntry,
  DAY_LABELS,
  flattenCalendarItemsToEntries,
  toDateKey,
  WEEK_HOUR_LABELS,
} from "./calendar-grid-shared";

// eslint-disable-next-line local/no-arbitrary-value-in-variable -- T-287: fixed time column plus 7 equal day columns, no Tailwind utility for it
const TIME_COLUMN = "grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

const minuteFormatter = (timeZone: string) =>
  getZonedFormatter("en-GB", { minute: "2-digit" }, timeZone);

/** Current time, refreshed every minute; `null` until mounted (no server/client mismatch). */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export interface CalendarWeekGridProps {
  date: Date;
  items: CalendarPostItem[];
  connectedAccountIds?: ConnectedAccountId[];
  thumbnails?: Record<string, MediaThumbnailDto>;
  onCancelSchedule?: (postId: PostId) => void;
}

/**
 * Week grid (T-287, S-008): hourly rows (24), the week starts on Monday,
 * a line marks the current time in today's column. One chip per post
 * target, placed in the row of its hour in the display time zone.
 */
export function CalendarWeekGrid({
  date,
  items,
  connectedAccountIds = [],
  thumbnails = {},
  onCancelSchedule,
}: CalendarWeekGridProps) {
  const timeZone = useUserTimeZone();
  const now = useNow();

  const days = useMemo(() => {
    const { from: weekStart } = getWeekRange(date, timeZone);
    return Array.from({ length: 7 }, (_, index) =>
      addDays(weekStart, index, timeZone),
    );
  }, [date, timeZone]);
  const dayKeys = useMemo(
    () => days.map((day) => toDateKey(day, timeZone)),
    [days, timeZone],
  );
  const todayKey = toDateKey(now ?? new Date(), timeZone);
  const nowHour = now ? getHour(now, timeZone) : null;
  const nowMinute = now ? Number(minuteFormatter(timeZone).format(now)) : 0;

  const accountsKey = connectedAccountIds.join(",");
  const cellEntries = useMemo(() => {
    const map = new Map<string, CalendarCardEntry[]>();
    for (const entry of flattenCalendarItemsToEntries(
      items,
      timeZone,
      connectedAccountIds,
    )) {
      const dayIndex = dayKeys.indexOf(entry.dateKey);
      if (dayIndex === -1) continue;
      const cellKey = `${dayIndex}-${entry.hour}`;
      const entries = map.get(cellKey) ?? [];
      entries.push(entry);
      map.set(cellKey, entries);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accountsKey stands for connectedAccountIds
  }, [items, accountsKey, dayKeys, timeZone]);

  // Scroll the grid body so the working day starts in view on mount.
  const scrollRef = useCallback((element: HTMLDivElement | null) => {
    if (element) element.scrollTop = 7 * 64;
  }, []);

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-287: Tailwind layout (ADR-097)
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
      <div
        className={cn("grid border-b border-border", TIME_COLUMN)}
        role="row"
      >
        {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
        <div />
        {days.map((day, index) => {
          const isToday = dayKeys[index] === todayKey;
          return (
            // eslint-disable-next-line no-restricted-syntax -- T-287
            <div
              key={dayKeys[index]}
              role="columnheader"
              className="flex flex-col items-center gap-0.5 py-2"
            >
              <span
                className={cn(
                  "text-xs",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {DAY_LABELS[index]}
              </span>
              <span
                className={cn(
                  "inline-flex min-w-6 items-center justify-center rounded-full px-1 text-sm",
                  isToday && "bg-primary font-bold text-primary-foreground",
                )}
              >
                {getDateParts(day, timeZone).day}
              </span>
            </div>
          );
        })}
      </div>
      {/* eslint-disable-next-line no-restricted-syntax, tailwindcss/no-arbitrary-value -- T-287: no Tailwind utility for a viewport-height share */}
      <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
        {WEEK_HOUR_LABELS.map((_, hour) => (
          // eslint-disable-next-line no-restricted-syntax -- T-287
          <div
            key={hour}
            className={cn(
              "grid border-b border-border last:border-b-0",
              TIME_COLUMN,
            )}
            role="row"
          >
            {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
            <div className="px-2 pt-1 text-right text-xs text-muted-foreground tabular-nums">
              {String(hour).padStart(2, "0")}:00
            </div>
            {dayKeys.map((dayKey, dayIndex) => {
              const entries = cellEntries.get(`${dayIndex}-${hour}`) ?? [];
              const showNowLine =
                dayKey === todayKey && nowHour === hour && now !== null;
              return (
                // eslint-disable-next-line no-restricted-syntax -- T-287
                <div
                  key={dayKey}
                  role="gridcell"
                  className="relative flex min-h-16 min-w-0 flex-col gap-1 border-l border-border p-1"
                >
                  {entries.map((entry) => (
                    <CalendarChip
                      key={entry.key}
                      entry={entry}
                      thumbnail={thumbnails[entry.postId]}
                      onCancelSchedule={onCancelSchedule}
                    />
                  ))}
                  {showNowLine ? (
                    // eslint-disable-next-line no-restricted-syntax -- T-287: current-time line, position from the minute
                    <div
                      aria-label="Sekarang"
                      className="pointer-events-none absolute inset-x-0 z-10 h-px bg-destructive"
                      style={{ top: `${(nowMinute / 60) * 100}%` }}
                    >
                      <span className="absolute -top-1 -left-1 size-2 rounded-full bg-destructive" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
