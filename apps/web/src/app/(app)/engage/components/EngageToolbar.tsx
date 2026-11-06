/* eslint-disable no-restricted-syntax -- T-220: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import { useId } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";

import { SocialPlatform } from "@postific/shared";
import type {
  InboxDateRange,
  InboxItemStatus,
  InboxPostSort,
} from "@/domains/engagement";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { PLATFORM_ICON } from "../../components/platform-icons";
import {
  ALL_FILTER_VALUE,
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
  STATUS_LABEL,
  countPanelFilters,
} from "./engage-model";
import { PlatformGlyph } from "./PlatformGlyph";

const STATUS_VALUES = Object.keys(STATUS_LABEL) as InboxItemStatus[];

export interface EngageToolbarProps {
  accounts: ConnectedAccountRecord[];
  accountFilter: string;
  onAccountChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  platformFilter: string;
  onPlatformChange: (value: string) => void;
  sort: InboxPostSort;
  onSortChange: (value: InboxPostSort) => void;
  dateRange: InboxDateRange;
  onDateRangeChange: (value: InboxDateRange) => void;
  hasActiveFilter: boolean;
  onReset: () => void;
  /** Titik pasang toggle By post / List (T-224): diisi `EngageViewToggle`. */
  viewToggleSlot?: React.ReactNode;
  className?: string;
}

function RadioOption({ value, label }: { value: string; label: string }) {
  const id = useId();
  return (
    <Field
      orientation="horizontal"
      className="items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-muted"
    >
      <RadioGroupItem value={value} id={id} />
      <FieldLabel htmlFor={id} className="flex-1 cursor-pointer font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}

/**
 * Filter utama di header (T-220.1: Akun dan Status, `Select` bercentang) dan
 * satu panel Filter & Sort (T-220.2, `Popover` termasuk di 375px: Sort By,
 * Date Range, Platform, Reset filters) sesuai kartu Postific
 * `ScreenEngagePerPosting` dan keputusan King Rezi T-216 #1 sampai #3, #6.
 * Komponen terkontrol: state dan query ada di `useEngageInbox`.
 */
export function EngageToolbar({
  accounts,
  accountFilter,
  onAccountChange,
  statusFilter,
  onStatusChange,
  platformFilter,
  onPlatformChange,
  sort,
  onSortChange,
  dateRange,
  onDateRangeChange,
  hasActiveFilter,
  onReset,
  viewToggleSlot,
  className,
}: EngageToolbarProps) {
  const platformId = useId();
  const activeAccount = accounts.find((a) => a.id === accountFilter);
  const panelCount = countPanelFilters({
    sort,
    dateRange,
    platform: platformFilter,
  });

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 max-md:flex-col max-md:items-stretch",
        className,
      )}
    >
      {viewToggleSlot ?? <span />}
      <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-nowrap">
        <Select value={accountFilter} onValueChange={onAccountChange}>
          <SelectTrigger
            size="sm"
            aria-label="Filter akun atau channel"
            className="max-md:min-w-0 max-md:flex-1"
          >
            <SelectValue>
              {activeAccount ? activeAccount.handle : "Semua akun"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>Semua akun</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <span className="inline-flex items-center gap-2">
                  <PlatformGlyph platform={account.platform} size={13} />
                  {account.handle}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger
            size="sm"
            aria-label="Filter status komentar"
            className="max-md:min-w-0 max-md:flex-1"
          >
            <SelectValue>
              Status:{" "}
              {statusFilter === ALL_FILTER_VALUE
                ? "Semua"
                : STATUS_LABEL[statusFilter as InboxItemStatus]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
            {STATUS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative shrink-0"
              aria-label={`Filter dan urutan${panelCount ? ` (${panelCount} aktif)` : ""}`}
            >
              <HugeiconsIcon icon={FilterHorizontalIcon} strokeWidth={2} />
              {panelCount > 0 ? (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
                >
                  {panelCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="flex flex-col gap-2.5">
              <FieldSet className="gap-1">
                <FieldLegend
                  variant="label"
                  className="mb-1 text-xs text-muted-foreground"
                >
                  Sort By
                </FieldLegend>
                <RadioGroup
                  value={sort}
                  onValueChange={(v) => onSortChange(v as InboxPostSort)}
                  className="gap-0"
                >
                  {SORT_OPTIONS.map((option) => (
                    <RadioOption
                      key={option.value}
                      value={option.value}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
              </FieldSet>
              <Separator />
              <FieldSet className="gap-1">
                <FieldLegend
                  variant="label"
                  className="mb-1 text-xs text-muted-foreground"
                >
                  Date Range
                </FieldLegend>
                <RadioGroup
                  value={dateRange}
                  onValueChange={(v) => onDateRangeChange(v as InboxDateRange)}
                  className="gap-0"
                >
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <RadioOption
                      key={option.value}
                      value={option.value}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
              </FieldSet>
              <Separator />
              <Field className="gap-1">
                <FieldLabel
                  htmlFor={platformId}
                  className="text-xs text-muted-foreground"
                >
                  Platform
                </FieldLabel>
                <Select value={platformFilter} onValueChange={onPlatformChange}>
                  <SelectTrigger id={platformId} size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>
                      Semua platform
                    </SelectItem>
                    {Object.values(SocialPlatform).map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {PLATFORM_ICON[platform].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={!hasActiveFilter}
                onClick={onReset}
              >
                Reset filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
