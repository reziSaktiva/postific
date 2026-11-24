"use client";

import { useMemo } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import type { ConnectedAccountId, PostId } from "@postific/shared";
import type { MediaThumbnailDto } from "@/domains/media";
import type { CalendarPostItem } from "@/domains/publishing";
import { getDateParts, getMonthRange } from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import { CalendarChip } from "./CalendarChip";
import {
  addDays,
  type CalendarCardEntry,
  DAY_LABELS,
  flattenCalendarItemsToEntries,
  MAX_VISIBLE_PER_CELL,
  toDateKey,
} from "./calendar-grid-shared";

interface MonthGridDay {
  date: Date;
  dateKey: string;
  /** `false` = padding day of the previous or next month (muted, no posts). */
  isCurrentMonth: boolean;
}

/** Cells of the Month grid: whole weeks covering the month, week starts on Monday. */
export function buildMonthGridDays(
  anchor: Date,
  timeZone: string,
): MonthGridDay[] {
  const { from: monthStart, to: monthEnd } = getMonthRange(anchor, timeZone);
  const leadingPadding = (getDateParts(monthStart, timeZone).weekday + 6) % 7;
  const gridStart = addDays(monthStart, -leadingPadding, timeZone);
  const daysInMonth = getDateParts(monthEnd, timeZone).day;
  const totalCells = Math.ceil((leadingPadding + daysInMonth) / 7) * 7;

  const anchorParts = getDateParts(anchor, timeZone);
  return Array.from({ length: totalCells }, (_, index) => {
    const cellDate = addDays(gridStart, index, timeZone);
    const cellParts = getDateParts(cellDate, timeZone);
    return {
      date: cellDate,
      dateKey: toDateKey(cellDate, timeZone),
      isCurrentMonth:
        cellParts.year === anchorParts.year &&
        cellParts.month === anchorParts.month,
    };
  });
}

export interface CalendarMonthGridProps {
  date: Date;
  items: CalendarPostItem[];
  connectedAccountIds?: ConnectedAccountId[];
  thumbnails?: Record<string, MediaThumbnailDto>;
  onCancelSchedule?: (postId: PostId) => void;
}

/**
 * Month grid (T-287, S-008): 7 columns, weeks from Monday. Up to 3 chips
 * per day, then "+N lainnya" opening a popover with that day's posts.
 * Below `lg` (tablet, T-292) the chips are platform icons in a row and
 * "+N lainnya" is a "+N" chip; the popover keeps full chips. A day
 * that is not in the past shows a schedule button on hover (always visible
 * on touch) that opens the Draft Editor with that date set; the date is
 * read in the display time zone of the page.
 */
export function CalendarMonthGrid({
  date,
  items,
  connectedAccountIds = [],
  thumbnails = {},
  onCancelSchedule,
}: CalendarMonthGridProps) {
  const timeZone = useUserTimeZone();
  const { openNewPost } = useDraftEditor();

  const weeks = useMemo(() => {
    const days = buildMonthGridDays(date, timeZone);
    const chunks: MonthGridDay[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [date, timeZone]);
  const todayKey = toDateKey(new Date(), timeZone);

  const accountsKey = connectedAccountIds.join(",");
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarCardEntry[]>();
    for (const entry of flattenCalendarItemsToEntries(
      items,
      timeZone,
      connectedAccountIds,
    )) {
      const entries = map.get(entry.dateKey) ?? [];
      entries.push(entry);
      map.set(entry.dateKey, entries);
    }
    for (const entries of map.values()) {
      entries.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accountsKey stands for connectedAccountIds
  }, [items, accountsKey, timeZone]);

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-287: Tailwind layout (ADR-097)
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
      <div className="grid grid-cols-7 border-b border-border" role="row">
        {DAY_LABELS.map((label) => (
          // eslint-disable-next-line no-restricted-syntax -- T-287
          <div
            key={label}
            role="columnheader"
            className="py-2 text-center text-xs text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        // eslint-disable-next-line no-restricted-syntax -- T-287
        <div
          key={week[0]?.dateKey}
          className="grid grid-cols-7 border-b border-border last:border-b-0"
          role="row"
        >
          {week.map((day, columnIndex) => {
            const entries = day.isCurrentMonth
              ? (entriesByDate.get(day.dateKey) ?? [])
              : [];
            const shown = entries.slice(0, MAX_VISIBLE_PER_CELL);
            const rest = entries.length - shown.length;
            const isToday = day.dateKey === todayKey;
            const isPast = day.dateKey < todayKey;

            return (
              // eslint-disable-next-line no-restricted-syntax -- T-287
              <div
                key={day.dateKey}
                role="gridcell"
                className={cn(
                  "group/day flex min-h-36 min-w-0 flex-col gap-1 p-1.5",
                  columnIndex < 6 && "border-r border-border",
                  !day.isCurrentMonth && "bg-muted/30",
                )}
              >
                {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
                <div className="flex h-6 items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex min-w-6 items-center justify-center rounded-full px-1 text-xs",
                      !day.isCurrentMonth && "text-muted-foreground/50",
                      day.isCurrentMonth && !isToday && "text-muted-foreground",
                      isToday && "bg-primary font-bold text-primary-foreground",
                    )}
                  >
                    {getDateParts(day.date, timeZone).day}
                  </span>
                  {day.isCurrentMonth && !isPast ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 transition-opacity group-focus-within/day:opacity-100 group-hover/day:opacity-100 pointer-coarse:opacity-100"
                      aria-label={`Jadwalkan posting untuk ${day.dateKey}`}
                      onClick={() =>
                        openNewPost({ date: day.dateKey, timeZone })
                      }
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                    </Button>
                  ) : null}
                </div>
                {/* eslint-disable-next-line no-restricted-syntax -- T-292: chips stack from lg, wrap as a row of icons below it */}
                <div className="flex flex-col gap-1 max-lg:flex-row max-lg:flex-wrap">
                  {shown.map((entry) => (
                    <CalendarChip
                      key={entry.key}
                      entry={entry}
                      thumbnail={thumbnails[entry.postId]}
                      iconOnlyBelowLg
                      onCancelSchedule={onCancelSchedule}
                    />
                  ))}
                  {rest > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="justify-start text-muted-foreground max-lg:size-8 max-lg:justify-center max-lg:rounded-lg max-lg:border max-lg:border-border max-lg:bg-card max-lg:p-0"
                          aria-label={`Lihat semua ${entries.length} posting ${day.dateKey}`}
                        >
                          +{rest}
                          <span className="max-lg:hidden">lainnya</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72">
                        {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-semibold">
                            {day.dateKey}{" "}
                            <span className="font-normal text-muted-foreground">
                              · {entries.length} posting
                            </span>
                          </p>
                          {entries.map((entry) => (
                            <CalendarChip
                              key={entry.key}
                              entry={entry}
                              thumbnail={thumbnails[entry.postId]}
                              showCaption
                              onCancelSchedule={onCancelSchedule}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
