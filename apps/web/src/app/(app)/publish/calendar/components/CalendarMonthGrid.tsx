"use client";

import { useMemo } from "react";

import type { ConnectedAccountId } from "@postific/shared";
import type { CalendarPostItem } from "@/domains/publishing";
import { getMonthRange } from "@/domains/publishing";

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
  formatCalendarHour,
  MAX_VISIBLE_PER_CELL,
  MS_PER_DAY,
  toUtcDateKey,
  useExpandableKeys,
} from "./calendar-grid-shared";

/** Tinggi minimum sel Month, termasuk padding — lebar kolom sekarang responsive (Tailwind `grid-cols-7`), tinggi tetap fixed. */
const MONTH_CELL_MIN_HEIGHT = 200;

/** Sisi kotak avatar platform (bulatan berisi `PlatformGlyph` di tengah, poin 5 — bukan lagi box kosong terpisah dari icon). Dinaikkan di revisi kelima T-033 (poin 1) — ukuran sebelumnya (14) hasil pengecilan agresif revisi ketiga jadi terlalu kecil untuk dibaca. */
const MONTH_THUMBNAIL_SIZE = 20;

/** Sisi ikon platform di dalam `MONTH_THUMBNAIL_SIZE` — dinaikkan bersamaan (revisi kelima T-033, poin 1). */
const MONTH_PLATFORM_ICON_SIZE = 13;

interface MonthGridDay {
  date: Date;
  dateKey: string;
  /** `false` = padding hari dari bulan sebelum/sesudah (`is-muted` mockup) — tanpa post (Prabowo hanya fetch bulan aktif). */
  isCurrentMonth: boolean;
}

/** Susun sel grid Month: cukup minggu (kelipatan 7) untuk menutupi 1 bulan penuh, termasuk padding awal/akhir. Minggu mulai Senin. */
function buildMonthGridDays(anchor: Date): MonthGridDay[] {
  const { from: monthStart, to: monthEnd } = getMonthRange(anchor);
  const leadingPadding = (monthStart.getUTCDay() + 6) % 7; // Senin=0 ... Minggu=6
  const gridStart = addDays(monthStart, -leadingPadding);

  const daysInMonth =
    Math.round((monthEnd.getTime() - monthStart.getTime()) / MS_PER_DAY) + 1;
  const totalCells = Math.ceil((leadingPadding + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const cellDate = addDays(gridStart, index);
    return {
      date: cellDate,
      dateKey: toUtcDateKey(cellDate),
      isCurrentMonth:
        cellDate.getUTCFullYear() === anchor.getUTCFullYear() &&
        cellDate.getUTCMonth() === anchor.getUTCMonth(),
    };
  });
}

function chunkIntoWeeks(days: MonthGridDay[]): MonthGridDay[][] {
  const weeks: MonthGridDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export interface CalendarMonthGridProps {
  /** Anchor periode (`?date=`, T-033.2) — dipakai `getMonthRange` untuk hari-hari 1 bulan. */
  date: Date;
  /** Hasil `PublishingService.listCalendarPosts` untuk rentang bulan yang sama. */
  items: CalendarPostItem[];
  /** Filter Channels aktif (T-033.6) — array kosong = tanpa filter. */
  connectedAccountIds?: ConnectedAccountId[];
}

/**
 * Grid Month (T-033.4, KSP-02) — 7 kolom hari × beberapa baris minggu,
 * acuan visual `templates/publish-calendar.html` (Claude Design). Sel
 * padding bulan sebelum/sesudah ditandai muted, tanpa post (Prabowo hanya
 * fetch bulan aktif). Maks 3 kartu tampil per sel, sisanya di balik
 * "+N More" yang expand/collapse di tempat (state lokal) — bukan modal
 * (di luar scope T-033.4). Klik kartu post membuka Popover ringkasan
 * (T-033.8, ADR-090/ADR-091, `CalendarPostPopover`).
 *
 * T-101.1: migrasi ke shadcn — `Grid columns={7}` -> Tailwind `grid-cols-7`,
 * `Divider variant="strong"` -> `Separator`, `ClickableCard` (tanpa padanan
 * shadcn siap-pakai) -> `<button>` polos diberi kelas visual Card (ring +
 * rounded + bg-card, `text-left` supaya konten tetap rata kiri) sebagai
 * trigger tunggal `PopoverTrigger asChild` (`CalendarPostPopover`). Sel
 * masih `overflow-y-auto` (padanan `isScrollable` Astryx) dengan alasan
 * sama seperti sebelumnya — lihat komentar di JSX di bawah.
 */
export function CalendarMonthGrid({
  date,
  items,
  connectedAccountIds = [],
}: CalendarMonthGridProps) {
  const { expandedKeys: expandedDateKeys, toggle: toggleExpanded } =
    useExpandableKeys();

  const gridDays = useMemo(() => buildMonthGridDays(date), [date]);
  const weeks = useMemo(() => chunkIntoWeeks(gridDays), [gridDays]);
  const todayKey = toUtcDateKey(new Date());

  const connectedAccountIdsKey = connectedAccountIds.join(",");
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarCardEntry[]>();
    for (const entry of flattenCalendarItemsToEntries(
      items,
      connectedAccountIds,
    )) {
      const entries = map.get(entry.dateKey) ?? [];
      entries.push(entry);
      map.set(entry.dateKey, entries);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, connectedAccountIdsKey]);

  return (
    <Card className="gap-2 p-3">
      {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only, file sudah dimigrasi shadcn */}
      <div className="grid grid-cols-7 gap-0">
        {DAY_LABELS.map((label, index) => (
          // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only
          <div
            key={label}
            className={cn(
              "flex flex-col items-center",
              columnDividerClassName(index),
            )}
          >
            <Text variant="muted" as="span" className="text-xs">
              {label}
            </Text>
          </div>
        ))}
      </div>

      <Separator />

      {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
      <div className="flex flex-col gap-0">
        {weeks.map((week, weekIndex) => (
          // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only
          <div
            className="flex flex-col gap-0"
            key={week[0]?.dateKey ?? weekIndex}
          >
            {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
            <div className="grid grid-cols-7 gap-0">
              {week.map((day, columnIndex) => {
                const entries = entriesByDate.get(day.dateKey) ?? [];
                const isExpanded = expandedDateKeys.has(day.dateKey);
                const visibleEntries = isExpanded
                  ? entries
                  : entries.slice(0, MAX_VISIBLE_PER_CELL);
                const hiddenCount = entries.length - visibleEntries.length;
                const isToday = day.dateKey === todayKey;

                return (
                  // `overflow-y-auto` (bukan untuk scroll sungguhan — sel selalu
                  // tumbuh vertikal via `min-height`) dipakai supaya sel ini jadi
                  // scroll container, yang per spec CSS Grid membuat "automatic
                  // minimum size"-nya sendiri jadi 0 — mencegah 1 kartu dengan
                  // konten lebar "mencuri" lebar kolom dari kartu lain di baris
                  // yang sama (root cause "grid tidak sejajar", revisi ketiga
                  // T-033 Bagian A). Tanpa ini, `grid-cols-7` (`repeat(7,
                  // minmax(auto, 1fr))`) membiarkan 1 sel padat menentukan lebar
                  // kolomnya sendiri, bukan 1/7 rata seperti header.
                  // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only
                  <div
                    key={day.dateKey}
                    className={cn(
                      "flex flex-col gap-1.5 overflow-y-auto px-2 py-1",
                      columnDividerClassName(columnIndex),
                    )}
                    style={{ minHeight: MONTH_CELL_MIN_HEIGHT }}
                  >
                    <Text
                      variant="muted"
                      as="span"
                      className={cn(
                        "text-xs",
                        !day.isCurrentMonth
                          ? "text-muted-foreground/50"
                          : isToday
                            ? "font-bold text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {day.date.getUTCDate()}
                    </Text>

                    {day.isCurrentMonth &&
                      visibleEntries.map((entry) => {
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
                                {/* Header: avatar+nama (kiri, menyusut/truncate lewat
                                    `min-w-0 flex-1`) sejajar dengan jam (kanan) — satu
                                    baris, bukan avatar disandingkan seluruh blok teks
                                    seperti sebelum revisi ketiga. */}
                                {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
                                <div className="flex items-center gap-1">
                                  {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
                                  <div
                                    className="flex shrink-0 items-center justify-center rounded-2xl bg-muted"
                                    style={{
                                      width: MONTH_THUMBNAIL_SIZE,
                                      height: MONTH_THUMBNAIL_SIZE,
                                    }}
                                  >
                                    <PlatformGlyph
                                      size={MONTH_PLATFORM_ICON_SIZE}
                                      color={
                                        PLATFORM_ICON[entry.platform].color
                                      }
                                    />
                                  </div>
                                  <Text
                                    variant="small"
                                    as="span"
                                    className="min-w-0 flex-1 truncate font-normal"
                                  >
                                    {entry.accountHandle}
                                  </Text>
                                  <Text
                                    variant="muted"
                                    as="span"
                                    className="text-xs"
                                  >
                                    {formatCalendarHour(entry.hour)}
                                  </Text>
                                </div>

                                <CalendarEntryFooter entry={entry} />
                              </div>
                            </button>
                          </CalendarPostPopover>
                        );
                      })}

                    {day.isCurrentMonth &&
                      entries.length > MAX_VISIBLE_PER_CELL && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(day.dateKey)}
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
            <Separator />
          </div>
        ))}
      </div>
    </Card>
  );
}
