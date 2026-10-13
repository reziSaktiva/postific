"use client";

import { useMemo } from "react";

import type { ConnectedAccountId } from "@postific/shared";
import type { CalendarPostItem } from "@/domains/publishing";
import { getWeekRange } from "@/domains/publishing";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { PLATFORM_ICON } from "../../../components/platform-icons";
import { CONTENT_STATUS_LABEL } from "../../../components/draft-editor/status-badge";
import { CalendarEntryFooter } from "./CalendarEntryFooter";
import { CalendarPostPopover } from "./CalendarPostPopover";
import {
  addDays,
  CALENDAR_ENTRY_BUTTON_CLASSNAME,
  type CalendarCardEntry,
  columnDividerClassName,
  CONTENT_FORMAT_LABEL,
  DAY_LABELS,
  flattenCalendarItemsToEntries,
  MAX_VISIBLE_PER_CELL,
  toUtcDateKey,
  useExpandableKeys,
  WEEK_HOUR_LABELS,
} from "./calendar-grid-shared";

/** Lebar kolom label waktu/corner — sama untuk header & tiap baris jam. */
const TIME_COLUMN_WIDTH = 56;

/** Tinggi minimum sel Week, termasuk padding. */
const WEEK_CELL_MIN_HEIGHT = 100;

/** Sisi ikon platform — render langsung tanpa bulatan muted di sekelilingnya (revisi ketiga T-033, Week poin 2; beda dari Month yang tetap pakai container). */
const WEEK_PLATFORM_ICON_SIZE = 16;

export interface CalendarWeekGridProps {
  /** Anchor periode (`?date=`, T-033.2) — dipakai `getWeekRange` untuk 7 hari Sen-Ming. */
  date: Date;
  /** Hasil `PublishingService.listCalendarPosts` untuk rentang minggu yang sama. */
  items: CalendarPostItem[];
  /** Filter Channels aktif (T-033.6) — array kosong = tanpa filter. */
  connectedAccountIds?: ConnectedAccountId[];
}

/**
 * Grid Week (T-033.3, KSP-02) — 7 kolom hari × 24 baris jam (satu baris per
 * jam, revisi kedua T-033 — label teks cuma di baris jam genap, lihat
 * `WEEK_HOUR_LABELS`), acuan visual `templates/publish-calendar.html`
 * (Claude Design). Klik kartu post membuka Popover ringkasan (T-033.8,
 * ADR-090/ADR-091, `CalendarPostPopover`).
 *
 * T-101.1: migrasi ke shadcn — pola sama persis `CalendarMonthGrid.tsx`
 * (`Grid` -> `grid-cols-7`, `Divider` -> `Separator`, `ClickableCard` ->
 * `<button>` bergaya Card sebagai `PopoverTrigger asChild`).
 */
export function CalendarWeekGrid({
  date,
  items,
  connectedAccountIds = [],
}: CalendarWeekGridProps) {
  const { expandedKeys: expandedCellKeys, toggle: toggleExpanded } =
    useExpandableKeys();

  const days = useMemo(() => {
    const { from: weekStart } = getWeekRange(date);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [date]);
  const dayKeys = useMemo(() => days.map(toUtcDateKey), [days]);
  const todayKey = toUtcDateKey(new Date());

  const connectedAccountIdsKey = connectedAccountIds.join(",");
  const cellEntries = useMemo(() => {
    const map = new Map<string, CalendarCardEntry[]>();
    for (const entry of flattenCalendarItemsToEntries(
      items,
      connectedAccountIds,
    )) {
      const dayIndex = dayKeys.indexOf(entry.dateKey);
      if (dayIndex === -1) continue; // di luar rentang minggu ini — tidak seharusnya terjadi (page.tsx sudah query per-minggu)

      const cellKey = `${dayIndex}-${entry.hour}`;
      const entries = map.get(cellKey) ?? [];
      entries.push(entry);
      map.set(cellKey, entries);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, connectedAccountIdsKey, dayKeys]);

  return (
    <Card className="gap-3 p-3">
      {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only, file sudah dimigrasi shadcn */}
      <div className="flex gap-2">
        {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
        <div style={{ width: TIME_COLUMN_WIDTH }} />
        {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
        <div className="min-w-0 flex-1">
          {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
          <div className="grid grid-cols-7 gap-0">
            {days.map((day, index) => {
              const isToday = dayKeys[index] === todayKey;
              return (
                // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only
                <div
                  key={dayKeys[index]}
                  className={cn(
                    "flex flex-col items-center gap-0.5",
                    columnDividerClassName(index),
                  )}
                >
                  <Text
                    variant="muted"
                    as="span"
                    className={cn(
                      "text-xs",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {DAY_LABELS[index]}
                  </Text>
                  <Text
                    variant="small"
                    as="span"
                    className={cn(
                      isToday ? "font-bold text-primary" : "font-normal",
                    )}
                  >
                    {day.getUTCDate()}
                  </Text>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Separator />

      {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
      <div className="flex flex-col gap-0">
        {WEEK_HOUR_LABELS.map((label, hour) => (
          // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only
          <div className="flex flex-col gap-0" key={hour}>
            {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
            <div className="flex items-stretch gap-2">
              {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
              <div style={{ width: TIME_COLUMN_WIDTH }}>
                <Text variant="muted" as="span" className="text-xs">
                  {label}
                </Text>
              </div>
              {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
              <div className="min-w-0 flex-1">
                {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
                <div className="grid grid-cols-7 gap-0">
                  {dayKeys.map((dayKey, dayIndex) => {
                    const cellKey = `${dayIndex}-${hour}`;
                    const entries = cellEntries.get(cellKey) ?? [];
                    const isExpanded = expandedCellKeys.has(cellKey);
                    const visibleEntries = isExpanded
                      ? entries
                      : entries.slice(0, MAX_VISIBLE_PER_CELL);
                    const hiddenCount = entries.length - visibleEntries.length;

                    return (
                      // `overflow-y-auto` (bukan untuk scroll sungguhan — sel selalu
                      // tumbuh vertikal via `min-height`) dipakai supaya sel ini jadi
                      // scroll container, yang per spec CSS Grid membuat "automatic
                      // minimum size"-nya sendiri jadi 0 — mencegah 1 kartu dengan
                      // konten lebar "mencuri" lebar kolom dari kartu lain di baris
                      // yang sama (root cause "grid tidak sejajar", revisi ketiga
                      // T-033 Bagian A). Sama seperti `CalendarMonthGrid.tsx`.
                      // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only
                      <div
                        key={dayKey}
                        className={cn(
                          "flex flex-col gap-1.5 overflow-y-auto py-1.5",
                          columnDividerClassName(dayIndex),
                        )}
                        style={{ minHeight: WEEK_CELL_MIN_HEIGHT }}
                      >
                        {visibleEntries.map((entry) => {
                          const PlatformGlyph =
                            PLATFORM_ICON[entry.platform].Icon;
                          return (
                            <CalendarPostPopover key={entry.key} entry={entry}>
                              <button
                                type="button"
                                aria-label={`${entry.accountHandle} — ${
                                  entry.caption || "(Tanpa caption)"
                                } — ${CONTENT_FORMAT_LABEL[entry.contentFormat]} — ${CONTENT_STATUS_LABEL[entry.status]}`}
                                className={CALENDAR_ENTRY_BUTTON_CLASSNAME}
                              >
                                {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
                                <div className="flex flex-col gap-1">
                                  {/* Header: ikon platform (tanpa bulatan muted, poin 2) +
                                      nama akun (menyusut/truncate lewat `min-w-0 flex-1`)
                                      — satu baris. */}
                                  {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
                                  <div className="flex items-center gap-1">
                                    <PlatformGlyph
                                      size={WEEK_PLATFORM_ICON_SIZE}
                                      color={
                                        PLATFORM_ICON[entry.platform].color
                                      }
                                    />
                                    <Text
                                      variant="small"
                                      as="span"
                                      className="min-w-0 flex-1 truncate font-normal"
                                    >
                                      {entry.accountHandle}
                                    </Text>
                                  </div>

                                  {/* Caption — baris terpisah, full width (bukan lagi di
                                      samping avatar). */}
                                  <Text
                                    variant="small"
                                    as="span"
                                    className="line-clamp-2 font-normal"
                                  >
                                    {entry.caption || "(Tanpa caption)"}
                                  </Text>

                                  <CalendarEntryFooter entry={entry} />
                                </div>
                              </button>
                            </CalendarPostPopover>
                          );
                        })}

                        {entries.length > MAX_VISIBLE_PER_CELL && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(cellKey)}
                          >
                            {isExpanded
                              ? "Tampilkan lebih sedikit"
                              : `+${hiddenCount} More`}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <Separator />
          </div>
        ))}
      </div>
    </Card>
  );
}
