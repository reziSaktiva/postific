import {
  asConnectedAccountId,
  asPageCursor,
  ContentStatus,
  type PageCursor,
} from "@postific/shared";

import type {
  PublishPostOrder,
  PublishPostSource,
} from "../repositories/publishing.repository";
import {
  APPROVAL_LIST_STATUSES,
  DRAFT_LIST_STATUSES,
} from "./group-approval-items";
import { isBoardColumnKey, type BoardColumnKey } from "./group-board-columns";
import {
  PUBLISH_LIST_TABS,
  type PublishListTab,
} from "./parse-publish-view-state";

/**
 * Paging of the Publish List tabs and Board columns (S-009, ADR-166). Pure
 * functions, no I/O: the List Filter of a tab mapped to the rows its query
 * reads, and the query string of the GET Route Handlers that load the next
 * pages (built by the browser, parsed by the server with the same rules).
 */

/** Filter of a List tab (List Filter popover, S-008 design gap 4). */
export interface PublishListFilter {
  /** Connected account ids; empty = every channel. */
  channelIds: readonly string[];
  source: PublishPostSource;
  /** History only; empty = every History status. */
  statuses: readonly ContentStatus[];
}

export const EMPTY_PUBLISH_LIST_FILTER: PublishListFilter = {
  channelIds: [],
  source: "all",
  statuses: [],
};

/**
 * Statuses of the History tab: published, failed and imported posts. The
 * same list as `HISTORY_TERMINAL_STATUSES` (publishing service); kept here
 * as well so this module has no import of the service.
 */
const HISTORY_TAB_STATUSES: readonly ContentStatus[] = [
  ContentStatus.Published,
  ContentStatus.Failed,
  ContentStatus.Imported,
];

const TAB_ORDER: Record<PublishListTab, PublishPostOrder> = {
  queue: "scheduled-asc",
  drafts: "updated-desc",
  approvals: "updated-desc",
  history: "occurred-desc",
};

/** Drafts carry no accounts in the list, so they filter by source only. */
const TABS_WITH_CHANNELS: ReadonlySet<PublishListTab> = new Set([
  "queue",
  "approvals",
  "history",
]);

export interface PublishTabSelection {
  statuses: ContentStatus[];
  order: PublishPostOrder;
  connectedAccountIds: ReturnType<typeof asConnectedAccountId>[];
  source: PublishPostSource;
}

/**
 * Rows a tab lists under `filter`. `null` when the filter keeps nothing
 * (History with only non-History statuses picked): the tab is empty and no
 * query is needed.
 */
export function publishTabSelection(
  tab: PublishListTab,
  filter: PublishListFilter,
): PublishTabSelection | null {
  let statuses: ContentStatus[];
  switch (tab) {
    case "queue":
      statuses = [ContentStatus.Scheduled];
      break;
    case "drafts":
      statuses = [...DRAFT_LIST_STATUSES];
      break;
    case "approvals":
      statuses = [...APPROVAL_LIST_STATUSES];
      break;
    case "history":
      statuses =
        filter.statuses.length === 0
          ? [...HISTORY_TAB_STATUSES]
          : HISTORY_TAB_STATUSES.filter((status) =>
              filter.statuses.includes(status),
            );
      break;
  }
  if (statuses.length === 0) return null;
  return {
    statuses,
    order: TAB_ORDER[tab],
    connectedAccountIds: TABS_WITH_CHANNELS.has(tab)
      ? filter.channelIds.map((id) => asConnectedAccountId(id))
      : [],
    source: filter.source,
  };
}

/** True when `filter` is the default (every channel, source and status). */
export function isEmptyPublishListFilter(filter: PublishListFilter): boolean {
  return (
    filter.channelIds.length === 0 &&
    filter.source === "all" &&
    filter.statuses.length === 0
  );
}

// ---------------------------------------------------------------- query string

const SOURCES: readonly PublishPostSource[] = ["all", "manual", "mcp"];
const ALL_STATUSES = new Set<string>(Object.values(ContentStatus));
const MAX_CURSOR_LENGTH = 1024;
const MAX_CHANNELS = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InvalidPublishPageQueryError extends Error {
  constructor(reason: string) {
    super(`Invalid page request: ${reason}`);
    this.name = "InvalidPublishPageQueryError";
  }
}

/** Query string of one List tab page; no `cursor` = first page. */
export function buildPublishListPageSearch(input: {
  tab: PublishListTab;
  filter: PublishListFilter;
  cursor?: PageCursor | null;
  /** Ask only for the total of the tab under the filter. */
  countOnly?: boolean;
}): string {
  const params = new URLSearchParams({ tab: input.tab });
  if (input.filter.channelIds.length > 0) {
    params.set("channels", [...input.filter.channelIds].sort().join(","));
  }
  if (input.filter.source !== "all") params.set("source", input.filter.source);
  if (input.filter.statuses.length > 0) {
    params.set("statuses", [...input.filter.statuses].sort().join(","));
  }
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.countOnly) params.set("count", "1");
  return `?${params.toString()}`;
}

function readCursor(params: URLSearchParams): PageCursor | null {
  const raw = params.get("cursor");
  if (raw === null || raw === "") return null;
  if (raw.length > MAX_CURSOR_LENGTH) {
    throw new InvalidPublishPageQueryError("cursor");
  }
  return asPageCursor(raw);
}

function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return [...new Set(raw.split(",").filter(Boolean))];
}

export interface PublishListPageQuery {
  tab: PublishListTab;
  filter: PublishListFilter;
  cursor: PageCursor | null;
  countOnly: boolean;
}

/** Reads `buildPublishListPageSearch`; anything else throws `InvalidPublishPageQueryError`. */
export function parsePublishListPageQuery(
  params: URLSearchParams,
): PublishListPageQuery {
  const tab = params.get("tab");
  if (!tab || !(PUBLISH_LIST_TABS as readonly string[]).includes(tab)) {
    throw new InvalidPublishPageQueryError("tab");
  }
  const channelIds = readList(params, "channels");
  if (
    channelIds.length > MAX_CHANNELS ||
    channelIds.some((id) => !UUID_PATTERN.test(id))
  ) {
    throw new InvalidPublishPageQueryError("channels");
  }
  const source = params.get("source") ?? "all";
  if (!(SOURCES as readonly string[]).includes(source)) {
    throw new InvalidPublishPageQueryError("source");
  }
  const statuses = readList(params, "statuses");
  if (statuses.some((status) => !ALL_STATUSES.has(status))) {
    throw new InvalidPublishPageQueryError("statuses");
  }
  return {
    tab: tab as PublishListTab,
    filter: {
      channelIds,
      source: source as PublishPostSource,
      statuses: statuses as ContentStatus[],
    },
    cursor: readCursor(params),
    countOnly: params.get("count") === "1",
  };
}

/** Query string of the next page of one Board column. */
export function buildBoardColumnPageSearch(input: {
  column: BoardColumnKey;
  cursor: PageCursor;
}): string {
  return `?${new URLSearchParams({ column: input.column, cursor: input.cursor }).toString()}`;
}

/** Reads `buildBoardColumnPageSearch`; the cursor is required (the first page is server-rendered). */
export function parseBoardColumnPageQuery(params: URLSearchParams): {
  column: BoardColumnKey;
  cursor: PageCursor;
} {
  const column = params.get("column");
  if (!isBoardColumnKey(column)) {
    throw new InvalidPublishPageQueryError("column");
  }
  const cursor = readCursor(params);
  if (!cursor) throw new InvalidPublishPageQueryError("cursor");
  return { column, cursor };
}
