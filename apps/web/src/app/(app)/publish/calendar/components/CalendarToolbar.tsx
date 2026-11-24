"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CalendarRemove01Icon,
  FilterHorizontalIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";

import { ContentStatus } from "@postific/shared";
import type { ConnectedAccountId } from "@postific/shared";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import {
  getDateParts,
  getWeekRange,
  type CalendarViewMode,
} from "@/domains/publishing";

import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CONTENT_STATUS_LABEL } from "../../../components/draft-editor/status-badge";
import { useCalendarPeriodState } from "../hooks/useCalendarPeriodState";
import { addDays, addMonths } from "./calendar-grid-shared";

const VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
  { value: "month", label: "Bulan" },
  { value: "week", label: "Minggu" },
];

/** Statuses that have a date, so they can sit on the Calendar (KSP-02-F02). */
export const CALENDAR_FILTER_STATUSES = [
  ContentStatus.Scheduled,
  ContentStatus.Published,
  ContentStatus.Failed,
] as const;

const dayOnlyFormatter = (timeZone: string) =>
  getZonedFormatter("id-ID", { day: "numeric" }, timeZone);
const dayMonthFormatter = (timeZone: string) =>
  getZonedFormatter("id-ID", { day: "numeric", month: "short" }, timeZone);
const monthYearFormatter = (timeZone: string) =>
  getZonedFormatter("id-ID", { month: "long", year: "numeric" }, timeZone);

/** "14–20 Jul" inside one month, "28 Jul – 3 Ags" across two. */
export function formatWeekPeriodLabel(date: Date, timeZone: string): string {
  const { from, to } = getWeekRange(date, timeZone);
  const fromParts = getDateParts(from, timeZone);
  const toParts = getDateParts(to, timeZone);
  const sameMonth =
    fromParts.month === toParts.month && fromParts.year === toParts.year;
  if (sameMonth) {
    return `${dayOnlyFormatter(timeZone).format(from)}–${dayMonthFormatter(timeZone).format(to)}`;
  }
  return `${dayMonthFormatter(timeZone).format(from)} – ${dayMonthFormatter(timeZone).format(to)}`;
}

export interface CalendarToolbarProps {
  /** Range the server resolved (URL or last used), see `useCalendarPeriodState`. */
  range: CalendarViewMode;
  /** Connected accounts of the workspace: options of the Channels filter. */
  accounts: ConnectedAccountRecord[];
  /** Posts without a date, shown on the "No date" button. */
  undatedCount: number;
  onOpenNoDate: () => void;
  showImported: boolean;
  onShowImportedChange: (show: boolean) => void;
}

function toggled<T>(list: readonly T[], value: T, on: boolean): T[] {
  const without = list.filter((item) => item !== value);
  return on ? [...without, value] : without;
}

/**
 * Calendar toolbar (T-287, S-008, KSP-02-F05/F09): previous and next, range
 * label, Today, Month or Week; on the right Filter (channels and status),
 * "No date", and an options menu. The time zone picker is part of the
 * Publish toolbar above. The state lives in the URL
 * (`useCalendarPeriodState`); the last used range is remembered in a cookie
 * so the Calendar reopens on it.
 */
export function CalendarToolbar({
  range,
  accounts,
  undatedCount,
  onOpenNoDate,
  showImported,
  onShowImportedChange,
}: CalendarToolbarProps) {
  const { view, date, statuses, connectedAccountIds, setPeriod } =
    useCalendarPeriodState(range);
  const timeZone = useUserTimeZone();

  const periodLabel =
    view === "month"
      ? monthYearFormatter(timeZone).format(date)
      : formatWeekPeriodLabel(date, timeZone);
  const step = (direction: 1 | -1) =>
    setPeriod({
      date:
        view === "month"
          ? addMonths(date, direction, timeZone)
          : addDays(date, 7 * direction, timeZone),
    });
  const prevLabel = view === "month" ? "Bulan sebelumnya" : "Minggu sebelumnya";
  const nextLabel = view === "month" ? "Bulan berikutnya" : "Minggu berikutnya";
  const activeFilters = statuses.length + connectedAccountIds.length;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-287: Tailwind layout (ADR-097)
    <div className="flex flex-wrap items-center justify-between gap-2">
      {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPeriod({ date: new Date() })}
        >
          Today
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={prevLabel}
              onClick={() => step(-1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{prevLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={nextLabel}
              onClick={() => step(1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{nextLabel}</TooltipContent>
        </Tooltip>
        <span className="text-sm font-semibold" aria-live="polite">
          {periodLabel}
        </span>
        <Select
          value={view}
          onValueChange={(value) =>
            setPeriod({ view: value as CalendarViewMode })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Tampilan Calendar"
            className="w-28"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <HugeiconsIcon icon={FilterHorizontalIcon} strokeWidth={2} />
              Filter
              {activeFilters > 0 ? (
                <Badge variant="secondary">{activeFilters}</Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            {/* eslint-disable-next-line no-restricted-syntax -- T-287 */}
            <div className="flex flex-col gap-3">
              {}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                  Channels
                </legend>
                {accounts.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Belum ada akun terhubung.
                  </span>
                ) : (
                  accounts.map((account) => {
                    const id = account.id as ConnectedAccountId;
                    return (
                      // eslint-disable-next-line no-restricted-syntax -- T-287
                      <div key={id} className="flex items-center gap-2">
                        <Checkbox
                          id={`cal-acc-${id}`}
                          checked={connectedAccountIds.includes(id)}
                          onCheckedChange={(checked) =>
                            setPeriod({
                              connectedAccountIds: toggled(
                                connectedAccountIds,
                                id,
                                checked === true,
                              ),
                            })
                          }
                        />
                        <Label htmlFor={`cal-acc-${id}`} className="truncate">
                          {account.handle}
                        </Label>
                      </div>
                    );
                  })
                )}
              </fieldset>
              {}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                  Status
                </legend>
                {CALENDAR_FILTER_STATUSES.map((status) => (
                  // eslint-disable-next-line no-restricted-syntax -- T-287
                  <div key={status} className="flex items-center gap-2">
                    <Checkbox
                      id={`cal-status-${status}`}
                      checked={statuses.includes(status)}
                      onCheckedChange={(checked) =>
                        setPeriod({
                          statuses: toggled(statuses, status, checked === true),
                        })
                      }
                    />
                    <Label htmlFor={`cal-status-${status}`}>
                      {CONTENT_STATUS_LABEL[status]}
                    </Label>
                  </div>
                ))}
              </fieldset>
              {activeFilters > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPeriod({ statuses: [], connectedAccountIds: [] })
                  }
                >
                  Reset filter
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" onClick={onOpenNoDate}>
          <HugeiconsIcon icon={CalendarRemove01Icon} strokeWidth={2} />
          No date
          {undatedCount > 0 ? (
            <Badge variant="secondary">{undatedCount}</Badge>
          ) : null}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Opsi Calendar">
              <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              checked={showImported}
              onCheckedChange={(checked) =>
                onShowImportedChange(checked === true)
              }
            >
              Tampilkan posting impor
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
