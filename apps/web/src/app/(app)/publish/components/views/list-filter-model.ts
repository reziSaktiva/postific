import type { ContentStatus, PostCreatedVia } from "@postific/shared";

import {
  matchesSourceFilter,
  type SourceFilterValue,
} from "@/components/shared/source-filter";

/** Filter of a List tab (S-008 design gap 4), set in the toolbar Filter popover. */
export interface ListFilterState {
  /** Selected channels (connected account ids); empty = every channel. */
  channelIds: string[];
  source: SourceFilterValue;
  /** History only; empty = every status. */
  statuses: ContentStatus[];
}

function matchesChannelFilter(
  targets: readonly { connectedAccountId: string }[] | undefined,
  channelIds: readonly string[],
): boolean {
  if (channelIds.length === 0) return true;
  return (targets ?? []).some((target) =>
    channelIds.includes(target.connectedAccountId),
  );
}

/** Channel, status and source filter of one list item. */
export function matchesListFilter(
  item: {
    createdVia?: PostCreatedVia;
    status?: ContentStatus;
    targets?: readonly { connectedAccountId: string }[];
  },
  filter: ListFilterState,
): boolean {
  return (
    matchesChannelFilter(item.targets, filter.channelIds) &&
    (filter.statuses.length === 0 ||
      (item.status !== undefined && filter.statuses.includes(item.status))) &&
    matchesSourceFilter(item, filter.source)
  );
}

/** Account of a card's preview: the first target in the selected channels. */
export function focusAccountId(
  targets: readonly { connectedAccountId: string }[],
  channelIds: readonly string[],
): string | undefined {
  return (
    targets.find(
      (target) =>
        channelIds.length === 0 ||
        channelIds.includes(target.connectedAccountId),
    ) ?? targets[0]
  )?.connectedAccountId;
}
