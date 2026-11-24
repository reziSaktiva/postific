"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";

import { ContentStatus, type SocialPlatform } from "@postific/shared";
import type { PublishListTab } from "@/domains/publishing";

import {
  SOURCE_FILTER_OPTIONS,
  SourceFilter,
  type SourceFilterValue,
} from "@/components/shared/source-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { PLATFORM_ICON } from "../../../components/platform-icons";
import { HISTORY_STATUS_LABEL } from "../../history/history-status";
import type { ListFilterState } from "./list-filter-model";

export {
  focusAccountId,
  matchesListFilter,
  type ListFilterState,
} from "./list-filter-model";

/** One option of the Channels group: a connected account of the workspace. */
export interface ListFilterAccount {
  id: string;
  handle: string;
  platform: SocialPlatform;
}

/** History statuses the Status group offers (Published, Error). */
const HISTORY_FILTER_STATUSES = [
  ContentStatus.Published,
  ContentStatus.Failed,
] as const;

const DEFAULT_STATE: ListFilterState = {
  channelIds: [],
  source: SourceFilter.All,
  statuses: [],
};

interface ListFilterValue extends ListFilterState {
  setChannelIds: (channelIds: string[]) => void;
  setSource: (source: SourceFilterValue) => void;
  setStatuses: (statuses: ContentStatus[]) => void;
  reset: () => void;
}

const ListFilterContext = createContext<ListFilterValue | null>(null);

function useListFilterState(): ListFilterValue {
  const [state, setState] = useState<ListFilterState>(DEFAULT_STATE);
  return useMemo(
    () => ({
      ...state,
      setChannelIds: (channelIds) =>
        setState((prev) => ({ ...prev, channelIds })),
      setSource: (source) => setState((prev) => ({ ...prev, source })),
      setStatuses: (statuses) => setState((prev) => ({ ...prev, statuses })),
      reset: () => setState(DEFAULT_STATE),
    }),
    [state],
  );
}

/**
 * Filter state of a List tab (S-008 design gap 4): the Filter popover sits
 * in the toolbar row, the list below reads the same state. `page.tsx` keys
 * the provider by tab, so each tab starts unfiltered as before.
 */
export function ListFilterProvider({ children }: { children: ReactNode }) {
  const value = useListFilterState();
  return (
    <ListFilterContext.Provider value={value}>
      {children}
    </ListFilterContext.Provider>
  );
}

/** Filter state of the List tab; a list mounted without the provider keeps its own. */
export function useListFilter(): ListFilterValue {
  const context = useContext(ListFilterContext);
  const local = useListFilterState();
  return context ?? local;
}

function toggled<T>(list: readonly T[], value: T, on: boolean): T[] {
  const without = list.filter((item) => item !== value);
  return on ? [...without, value] : without;
}

/** Drafts have no accounts in the list data, so they filter by source only. */
const TABS_WITH_CHANNELS: ReadonlySet<PublishListTab> = new Set([
  "queue",
  "approvals",
  "history",
]);

/**
 * Filter popover of the List toolbar (S-008 design gap 4), the pattern of
 * the Calendar toolbar: Channels (checkboxes, every channel by default),
 * Status on History (Published, Error), Source (Semua Sumber, Dibuat Manual,
 * Lewat MCP; default Semua Sumber, KSP-D20) and Reset. The label is hidden
 * below `sm`, as on the Calendar.
 */
export function ListFilterPopover({
  tab,
  accounts,
}: {
  tab: PublishListTab;
  accounts: ListFilterAccount[];
}) {
  const filter = useListFilter();
  const showChannels = TABS_WITH_CHANNELS.has(tab);
  const showStatuses = tab === "history";
  const activeFilters =
    (showChannels ? filter.channelIds.length : 0) +
    (showStatuses ? filter.statuses.length : 0) +
    (filter.source === SourceFilter.All ? 0 : 1);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Filter">
          <HugeiconsIcon icon={FilterHorizontalIcon} strokeWidth={2} />
          <span className="max-sm:sr-only">Filter</span>
          {activeFilters > 0 ? (
            <Badge variant="secondary">{activeFilters}</Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        {/* eslint-disable-next-line no-restricted-syntax -- S-008: Tailwind layout (ADR-097) */}
        <div className="flex flex-col gap-3">
          {showChannels ? (
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
                  const Glyph = PLATFORM_ICON[account.platform].Icon;
                  return (
                    // eslint-disable-next-line no-restricted-syntax -- S-008: layout-only
                    <div key={account.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`list-acc-${account.id}`}
                        checked={filter.channelIds.includes(account.id)}
                        onCheckedChange={(checked) =>
                          filter.setChannelIds(
                            toggled(
                              filter.channelIds,
                              account.id,
                              checked === true,
                            ),
                          )
                        }
                      />
                      <Glyph
                        size={14}
                        color={PLATFORM_ICON[account.platform].color}
                        aria-hidden
                      />
                      <Label
                        htmlFor={`list-acc-${account.id}`}
                        className="truncate"
                      >
                        {account.handle}
                      </Label>
                    </div>
                  );
                })
              )}
            </fieldset>
          ) : null}
          {showStatuses ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                Status
              </legend>
              {HISTORY_FILTER_STATUSES.map((status) => (
                // eslint-disable-next-line no-restricted-syntax -- S-008: layout-only
                <div key={status} className="flex items-center gap-2">
                  <Checkbox
                    id={`list-status-${status}`}
                    checked={filter.statuses.includes(status)}
                    onCheckedChange={(checked) =>
                      filter.setStatuses(
                        toggled(filter.statuses, status, checked === true),
                      )
                    }
                  />
                  <Label htmlFor={`list-status-${status}`}>
                    {HISTORY_STATUS_LABEL[status]}
                  </Label>
                </div>
              ))}
            </fieldset>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">
              Sumber
            </legend>
            <RadioGroup
              value={filter.source}
              onValueChange={(value) =>
                filter.setSource(value as SourceFilterValue)
              }
              aria-label="Filter sumber"
              className="gap-2"
            >
              {SOURCE_FILTER_OPTIONS.map((option) => (
                // eslint-disable-next-line no-restricted-syntax -- S-008: layout-only
                <div key={option.value} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={option.value}
                    id={`list-source-${option.value}`}
                  />
                  <Label htmlFor={`list-source-${option.value}`}>
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          {activeFilters > 0 ? (
            <Button variant="ghost" size="sm" onClick={filter.reset}>
              Reset filter
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
