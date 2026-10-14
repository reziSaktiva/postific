"use client";

import { useMemo } from "react";

import type { ConnectedAccountId } from "@postific/shared";
import type { CalendarPostItem } from "@/domains/publishing";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn, formatUtcDateKeyHeading } from "@/lib/utils";

import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { PLATFORM_ICON } from "../../../components/platform-icons";
import { CalendarPostPopover } from "./CalendarPostPopover";
import {
  CALENDAR_ENTRY_BUTTON_CLASSNAME,
  type CalendarCardEntry,
  CONTENT_FORMAT_LABEL,
  flattenCalendarItemsToEntries,
  formatCalendarHour,
  toUtcDateKey,
} from "./calendar-grid-shared";

/** "Rabu, 16 Jul" — beda dari `formatGroupDateHeading` (`QueueList.tsx`,
 * `month: "long"`) karena rancangan Agenda (Claude Design
 * `templates/publish-calendar.html` § "State — Mobile Agenda") memakai
 * bulan singkat, konsisten dengan `DAY_MONTH_FORMATTER` (`CalendarToolbar.tsx`). */
const AGENDA_DATE_HEADING_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Parse UTC-safe dipusatkan di `formatUtcDateKeyHeading` (`@/lib/utils`,
 * code review PR #105) — sama helper dipakai `formatGroupDateHeading`
 * (`QueueList.tsx`), beda cuma opsi `AGENDA_DATE_HEADING_FORMATTER`. */
function formatAgendaDateHeading(dateKey: string): string {
  return formatUtcDateKeyHeading(dateKey, AGENDA_DATE_HEADING_FORMATTER);
}

export interface CalendarAgendaListProps {
  /** Hasil `PublishingService.listCalendarPosts` — SAMA persis dengan yang
   * diterima `CalendarWeekGrid`/`CalendarMonthGrid` dari `CalendarScreen`
   * (Week/Month cuma menentukan RANGE tanggal yang di-fetch, bukan mode
   * render — Agenda dipakai untuk kedua pilihan itu saat mobile). */
  items: CalendarPostItem[];
  /** Filter Channels aktif (T-033.6) — array kosong = tanpa filter, sama seperti grid. */
  connectedAccountIds?: ConnectedAccountId[];
}

/**
 * Varian Agenda Calendar mobile (≤768px, KI-035 poin 3) — list vertikal
 * dikelompokkan per tanggal. ADDENDUM ke grid Week/Month desktop (bukan
 * pengganti; grid ≥768px tidak berubah sama sekali, lihat `CalendarScreen.tsx`).
 * Data source SAMA dengan grid (`flattenCalendarItemsToEntries`,
 * `calendar-grid-shared.ts`) — satu kartu per TARGET (bukan per post), post
 * multi-platform tetap tampil sebagai beberapa kartu granular. Klik kartu
 * membuka `CalendarPostPopover` yang sama dipakai grid (T-033.8,
 * ADR-090/ADR-091) — bukan duplikasi logic preview.
 *
 * Rancangan: Claude Design `templates/publish-calendar.html` kolom
 * "State — Mobile Agenda (≤768px, KI-035 poin 3)", dikonfirmasi King Rezi.
 * Chip status/format reuse `Badge` + mapping yang sama dipakai
 * `CalendarEntryFooter.tsx` (`CONTENT_STATUS_BADGE_VARIANT`,
 * `CONTENT_FORMAT_LABEL`) — bukan styling chip baru.
 */
export function CalendarAgendaList({
  items,
  connectedAccountIds = [],
}: CalendarAgendaListProps) {
  const todayKey = toUtcDateKey(new Date());

  const connectedAccountIdsKey = connectedAccountIds.join(",");
  const groups = useMemo(() => {
    const map = new Map<string, CalendarCardEntry[]>();
    for (const entry of flattenCalendarItemsToEntries(
      items,
      connectedAccountIds,
    )) {
      const entries = map.get(entry.dateKey) ?? [];
      entries.push(entry);
      map.set(entry.dateKey, entries);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, entries]) => ({
        dateKey,
        entries: [...entries].sort((a, b) => a.hour - b.hour),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `connectedAccountIdsKey` representasi stabil `connectedAccountIds` (pola sama `CalendarWeekGrid`/`CalendarMonthGrid`)
  }, [items, connectedAccountIdsKey]);

  if (groups.length === 0) {
    return (
      // eslint-disable-next-line no-restricted-syntax -- layout-only, murni Tailwind flex (pola sama grid/QueueList)
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-border p-6 text-center">
        <Text variant="small" as="span" className="font-bold">
          Belum ada post
        </Text>
        <Text variant="muted" as="span" className="text-xs">
          Post yang dijadwalkan akan muncul di sini, dikelompokkan per tanggal.
        </Text>
      </div>
    );
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- layout-only, murni Tailwind flex
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        // eslint-disable-next-line no-restricted-syntax -- layout-only
        <div className="flex flex-col gap-2" key={group.dateKey}>
          {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
          <div className="flex items-center gap-2">
            <Text variant="small" as="h3" className="font-bold">
              {formatAgendaDateHeading(group.dateKey)}
            </Text>
            {group.dateKey === todayKey && (
              <Badge variant="secondary">Hari ini</Badge>
            )}
          </div>

          {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
          <div className="flex flex-col gap-2">
            {group.entries.map((entry) => {
              const PlatformGlyph = PLATFORM_ICON[entry.platform].Icon;
              return (
                <CalendarPostPopover key={entry.key} entry={entry}>
                  <button
                    type="button"
                    aria-label={`${entry.accountHandle} — ${
                      entry.caption || "(Tanpa caption)"
                    } — ${CONTENT_FORMAT_LABEL[entry.contentFormat]} — ${CONTENT_STATUS_LABEL[entry.status]}`}
                    className={cn(CALENDAR_ENTRY_BUTTON_CLASSNAME, "p-3")}
                  >
                    {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
                    <div className="flex flex-col gap-1.5">
                      {/* Identity: ikon platform + handle (menyusut/truncate) + jam,
                          status chip di ujung kanan. */}
                      {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
                      <div className="flex items-center gap-2">
                        <PlatformGlyph
                          size={16}
                          color={PLATFORM_ICON[entry.platform].color}
                        />
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
                          className="shrink-0 text-xs"
                        >
                          {formatCalendarHour(entry.hour)}
                        </Text>
                        <Badge
                          variant={CONTENT_STATUS_BADGE_VARIANT[entry.status]}
                          className="shrink-0"
                        >
                          {CONTENT_STATUS_LABEL[entry.status]}
                        </Badge>
                      </div>

                      {/* Caption — baris terpisah, boleh wrap (tidak truncate paksa). */}
                      <Text variant="small" as="span" className="font-normal">
                        {entry.caption || "(Tanpa caption)"}
                      </Text>

                      {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
                      <div>
                        <Badge variant="outline">
                          {CONTENT_FORMAT_LABEL[entry.contentFormat]}
                        </Badge>
                      </div>
                    </div>
                  </button>
                </CalendarPostPopover>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
