"use client";

import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { ContentStatus } from "@postific/shared";
import type { ConnectedAccountId } from "@postific/shared";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { getWeekRange, getDateParts } from "@/domains/publishing";
import type { CalendarViewMode } from "@/domains/publishing";

import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CONTENT_STATUS_LABEL } from "../../../components/draft-editor/status-badge";
import { useCalendarPeriodState } from "../hooks/useCalendarPeriodState";
import { addDays, addMonths } from "./calendar-grid-shared";

const ALL_STATUSES_VALUE = "all";
const ALL_ACCOUNTS_VALUE = "all";

const VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
];

const STATUS_OPTIONS = [
  { value: ALL_STATUSES_VALUE, label: "All Posts" },
  ...Object.values(ContentStatus).map((status) => ({
    value: status,
    label: CONTENT_STATUS_LABEL[status],
  })),
];

// Formatter berzona pengguna (T-147), ter-cache per zona.
/** Format tanggal-saja ("14") — dipakai sisi awal label Week saat masih dalam bulan yang sama. */
const dayOnlyFormatter = (timeZone: string) =>
  getZonedFormatter("id-ID", { day: "numeric" }, timeZone);
/** Format tanggal + bulan singkat ("20 Jul") — sisi akhir label Week, dan kedua sisi saat lintas bulan. */
const dayMonthFormatter = (timeZone: string) =>
  getZonedFormatter("id-ID", { day: "numeric", month: "short" }, timeZone);
const monthYearFormatter = (timeZone: string) =>
  getZonedFormatter("id-ID", { month: "long", year: "numeric" }, timeZone);

/**
 * Label periode Week (T-033.5) — "14–20 Jul" kalau 7 hari jatuh di bulan
 * kalender yang sama, "28 Jul – 3 Ags" kalau lintas bulan (mockup
 * `templates/publish-calendar.html` hanya mencontohkan kasus non-lintas-
 * bulan, format lintas-bulan mengikuti konvensi umum kalender: kedua sisi
 * tampilkan nama bulan supaya tidak ambigu).
 */
function formatWeekPeriodLabel(date: Date, timeZone: string): string {
  const { from, to } = getWeekRange(date, timeZone);
  const fromParts = getDateParts(from, timeZone);
  const toParts = getDateParts(to, timeZone);
  const dayOnly = dayOnlyFormatter(timeZone);
  const dayMonth = dayMonthFormatter(timeZone);
  const sameMonth =
    fromParts.month === toParts.month && fromParts.year === toParts.year;

  if (sameMonth) {
    return `${dayOnly.format(from)}–${dayMonth.format(to)}`;
  }
  return `${dayMonth.format(from)} – ${dayMonth.format(to)}`;
}

function formatMonthPeriodLabel(date: Date, timeZone: string): string {
  return monthYearFormatter(timeZone).format(date);
}

export interface CalendarToolbarProps {
  /** Daftar akun terkoneksi workspace (T-033.6) — sumber opsi filter Channels, dari `WorkspaceService.listConnectedAccounts` (bukan derive dari `items` supaya opsi tidak hilang saat filter lain aktif). */
  accounts: ConnectedAccountRecord[];
}

/**
 * Toolbar Calendar (T-033.5 navigasi + T-033.6 filter) — acuan visual
 * `templates/publish-calendar.html` (Claude Design, `.cal-period-controls`
 * + `.cal-view-select` + `.cal-filter-row`). Client component murni state
 * URL lewat `useCalendarPeriodState` (T-033.2) — tidak menerima `view`/
 * `date` sebagai props supaya satu-satunya sumber kebenaran tetap URL.
 *
 * T-101.1: migrasi ke shadcn (`Button`, `Select`, `Text`, `Tooltip`) —
 * `IconButton` Astryx (icon + tooltip built-in) diganti `Button
 * variant="ghost" size="icon"` dibungkus `Tooltip`, pola persis
 * `WorkspaceSideNav.tsx` (T-098.1). Ikon chevron pindah dari `react-icons`
 * (`FaChevronLeft/Right`) ke `hugeicons` (`ArrowLeft01Icon`/
 * `ArrowRight01Icon`) — ikon generik non-brand wajib hugeicons di file yang
 * baru ditulis ulang (`apps/web/.claude/CLAUDE.md`), beda dari
 * `PLATFORM_ICON` (ikon brand, dikecualikan ADR-058).
 */
export function CalendarToolbar({ accounts }: CalendarToolbarProps) {
  const { view, date, statuses, connectedAccountIds, setPeriod } =
    useCalendarPeriodState();
  const timeZone = useUserTimeZone();

  const periodLabel =
    view === "month"
      ? formatMonthPeriodLabel(date, timeZone)
      : formatWeekPeriodLabel(date, timeZone);

  const accountOptions = useMemo(
    () => [
      { value: ALL_ACCOUNTS_VALUE, label: "Semua Akun" },
      ...accounts.map((account) => ({
        value: account.id as string,
        label: account.handle,
      })),
    ],
    [accounts],
  );

  function goToday() {
    setPeriod({ date: new Date() });
  }

  function goPrev() {
    setPeriod({
      date:
        view === "month"
          ? addMonths(date, -1, timeZone)
          : addDays(date, -7, timeZone),
    });
  }

  function goNext() {
    setPeriod({
      date:
        view === "month"
          ? addMonths(date, 1, timeZone)
          : addDays(date, 7, timeZone),
    });
  }

  const prevLabel = view === "month" ? "Bulan sebelumnya" : "Minggu sebelumnya";
  const nextLabel = view === "month" ? "Bulan berikutnya" : "Minggu berikutnya";

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only, file sudah dimigrasi shadcn
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goToday}>
            Today
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={prevLabel}
                onClick={goPrev}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{prevLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={nextLabel}
                onClick={goNext}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{nextLabel}</TooltipContent>
          </Tooltip>
          <Text variant="small" as="span" className="font-bold">
            {periodLabel}
          </Text>
        </div>

        <Select
          value={view}
          onValueChange={(value) =>
            setPeriod({ view: value as CalendarViewMode })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Tampilan Calendar"
            className="w-32"
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

      {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={statuses[0] ?? ALL_STATUSES_VALUE}
          onValueChange={(value) =>
            setPeriod({
              statuses:
                value === ALL_STATUSES_VALUE ? [] : [value as ContentStatus],
            })
          }
        >
          <SelectTrigger size="sm" aria-label="Filter status" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={connectedAccountIds[0] ?? ALL_ACCOUNTS_VALUE}
          onValueChange={(value) =>
            setPeriod({
              connectedAccountIds:
                value === ALL_ACCOUNTS_VALUE
                  ? []
                  : [value as ConnectedAccountId],
            })
          }
        >
          <SelectTrigger size="sm" aria-label="Filter akun" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accountOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
