/**
 * Pure state for an infinite-scroll list (ADR-166, spec S-009, T-301).
 *
 * No React here, so every rule can be tested without rendering:
 * - a response is applied only when it answers the request the list is
 *   waiting for (same generation, same kind of request, same cursor), so a
 *   response that arrives after a reset or a newer refresh is dropped;
 * - items never repeat: a page item whose key is already loaded is skipped;
 * - a realtime item is placed by the caller's sort order, and one that sorts
 *   after the last loaded item waits until the user scrolls to it;
 * - a realtime remove or upsert made while a page is on its way wins over
 *   that page's older copy of the item.
 */

import type { CursorPage, PageCursor } from "@postific/shared";

/**
 * - `idle`: more pages exist and none is loading (the sentinel is armed).
 * - `loading`: a page is on its way (see `request` for which one).
 * - `error`: that page failed; retry asks for the same page again.
 * - `end`: every page is loaded.
 */
export type InfiniteListStatus = "idle" | "loading" | "error" | "end";

/** What `loading` or `error` is about: a refresh (first page) or the next page. */
export type InfiniteListRequest = "first" | "next";

export interface InfiniteListState<T> {
  items: T[];
  nextCursor: PageCursor | null;
  status: InfiniteListStatus;
  request: InfiniteListRequest;
  /** Goes up on every reset and refresh; older responses are stale. */
  generation: number;
  /** Keys removed by realtime while a page is on its way. */
  removedWhileLoading: ReadonlySet<string>;
  /** Latest realtime version of items upserted while a page is on its way. */
  upsertedWhileLoading: ReadonlyMap<string, T>;
}

/** Sort order of the list: negative when `a` comes before `b`. */
export type InfiniteListCompare<T> = (a: T, b: T) => number;
export type InfiniteListGetKey<T> = (item: T) => string;

interface ItemOrder<T> {
  getKey: InfiniteListGetKey<T>;
  compare: InfiniteListCompare<T>;
}

export type InfiniteListAction<T> =
  | { type: "load-start" }
  | ({
      type: "load-success";
      generation: number;
      cursor: PageCursor;
      page: CursorPage<T>;
    } & ItemOrder<T>)
  | { type: "load-failure"; generation: number; cursor: PageCursor }
  | { type: "refresh-start" }
  | ({
      type: "refresh-success";
      generation: number;
      page: CursorPage<T>;
    } & ItemOrder<T>)
  | { type: "refresh-failure"; generation: number }
  | { type: "reset"; page: CursorPage<T> }
  | ({ type: "upsert"; item: T } & ItemOrder<T>)
  | { type: "remove"; key: string; getKey: InfiniteListGetKey<T> };

const NO_KEYS: ReadonlySet<string> = new Set<string>();
const NO_ITEMS: ReadonlyMap<string, never> = new Map<string, never>();

function statusFor(nextCursor: PageCursor | null): InfiniteListStatus {
  return nextCursor === null ? "end" : "idle";
}

export function createInfiniteListState<T>(
  page: CursorPage<T>,
  generation = 0,
): InfiniteListState<T> {
  return {
    items: page.items,
    nextCursor: page.nextCursor,
    status: statusFor(page.nextCursor),
    request: "next",
    generation,
    removedWhileLoading: NO_KEYS,
    upsertedWhileLoading: NO_ITEMS,
  };
}

/** Adds `incoming` after `items`, skipping keys that are already loaded. */
export function appendUnique<T>(
  items: T[],
  incoming: T[],
  getKey: InfiniteListGetKey<T>,
): T[] {
  const seen = new Set(items.map(getKey));
  const added: T[] = [];
  for (const item of incoming) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(item);
  }
  return added.length === 0 ? items : [...items, ...added];
}

/**
 * Puts a new or changed item where it belongs in the loaded items. An item
 * already loaded is taken out first, so a change that moves it (a new sort
 * time) does not leave a copy behind. When it sorts after the last loaded
 * item and more pages exist, it is left out: the page that holds it will
 * bring it when the user scrolls there.
 */
export function upsertItem<T>(
  items: T[],
  item: T,
  hasMore: boolean,
  getKey: InfiniteListGetKey<T>,
  compare: InfiniteListCompare<T>,
): T[] {
  const key = getKey(item);
  const rest = items.filter((existing) => getKey(existing) !== key);
  const index = rest.findIndex((existing) => compare(item, existing) < 0);
  if (index === -1) {
    // The last loaded item stays the last one when it changes: where the
    // next page starts is unknown here, and a repeat from that page is
    // skipped by `appendUnique`.
    const wasLast = items.length > 0 && getKey(items[items.length - 1]) === key;
    if (hasMore && rest.length > 0 && !wasLast) return rest;
    return [...rest, item];
  }
  return [...rest.slice(0, index), item, ...rest.slice(index)];
}

export function removeItem<T>(
  items: T[],
  key: string,
  getKey: InfiniteListGetKey<T>,
): T[] {
  const next = items.filter((item) => getKey(item) !== key);
  return next.length === items.length ? items : next;
}

/**
 * Adds an arriving page to `base` while honoring realtime changes made
 * while it was on its way: removed keys stay removed, and an upserted item
 * keeps its newer version instead of the page's copy.
 */
export function mergeArrivingPage<T>(
  base: T[],
  page: CursorPage<T>,
  removed: ReadonlySet<string>,
  upserted: ReadonlyMap<string, T>,
  { getKey, compare }: ItemOrder<T>,
): T[] {
  const fresh = page.items.filter((item) => {
    const key = getKey(item);
    return !removed.has(key) && !upserted.has(key);
  });
  let items = appendUnique(base, fresh, getKey);
  if (upserted.size === 0) return items;
  const loaded = new Set(items.map(getKey));
  const hasMore = page.nextCursor !== null;
  for (const [key, item] of upserted) {
    if (loaded.has(key)) continue;
    items = upsertItem(items, item, hasMore, getKey, compare);
  }
  return items;
}

function waitingFor<T>(
  state: InfiniteListState<T>,
  request: InfiniteListRequest,
  generation: number,
): boolean {
  return (
    state.generation === generation &&
    state.status === "loading" &&
    state.request === request
  );
}

function loaded<T>(
  state: InfiniteListState<T>,
  items: T[],
  nextCursor: PageCursor | null,
): InfiniteListState<T> {
  return {
    ...state,
    items,
    nextCursor,
    status: statusFor(nextCursor),
    request: "next",
    removedWhileLoading: NO_KEYS,
    upsertedWhileLoading: NO_ITEMS,
  };
}

function failed<T>(state: InfiniteListState<T>): InfiniteListState<T> {
  return {
    ...state,
    status: "error",
    removedWhileLoading: NO_KEYS,
    upsertedWhileLoading: NO_ITEMS,
  };
}

export function infiniteListReducer<T>(
  state: InfiniteListState<T>,
  action: InfiniteListAction<T>,
): InfiniteListState<T> {
  switch (action.type) {
    case "load-start": {
      const canLoad =
        state.status === "idle" ||
        (state.status === "error" && state.request === "next");
      if (!canLoad || state.nextCursor === null) return state;
      return { ...state, status: "loading", request: "next" };
    }
    case "load-success": {
      if (!waitingFor(state, "next", action.generation)) return state;
      if (action.cursor !== state.nextCursor) return state;
      const items = mergeArrivingPage(
        state.items,
        action.page,
        state.removedWhileLoading,
        state.upsertedWhileLoading,
        action,
      );
      return loaded(state, items, action.page.nextCursor);
    }
    case "load-failure": {
      if (!waitingFor(state, "next", action.generation)) return state;
      if (action.cursor !== state.nextCursor) return state;
      return failed(state);
    }
    case "refresh-start":
      return {
        items: [],
        nextCursor: null,
        status: "loading",
        request: "first",
        generation: state.generation + 1,
        removedWhileLoading: NO_KEYS,
        upsertedWhileLoading: NO_ITEMS,
      };
    case "refresh-success": {
      if (!waitingFor(state, "first", action.generation)) return state;
      const items = mergeArrivingPage(
        [],
        action.page,
        state.removedWhileLoading,
        state.upsertedWhileLoading,
        action,
      );
      return loaded(state, items, action.page.nextCursor);
    }
    case "refresh-failure": {
      if (!waitingFor(state, "first", action.generation)) return state;
      return failed(state);
    }
    case "reset":
      return createInfiniteListState(action.page, state.generation + 1);
    case "upsert": {
      const key = action.getKey(action.item);
      const items = upsertItem(
        state.items,
        action.item,
        state.nextCursor !== null || state.request === "first",
        action.getKey,
        action.compare,
      );
      if (state.status !== "loading") {
        return items === state.items ? state : { ...state, items };
      }
      const removed = new Set(state.removedWhileLoading);
      removed.delete(key);
      const upserted = new Map(state.upsertedWhileLoading);
      upserted.set(key, action.item);
      return {
        ...state,
        items,
        removedWhileLoading: removed,
        upsertedWhileLoading: upserted,
      };
    }
    case "remove": {
      const items = removeItem(state.items, action.key, action.getKey);
      if (state.status !== "loading") {
        return items === state.items ? state : { ...state, items };
      }
      const removed = new Set(state.removedWhileLoading);
      removed.add(action.key);
      const upserted = new Map(state.upsertedWhileLoading);
      upserted.delete(action.key);
      return {
        ...state,
        items,
        removedWhileLoading: removed,
        upsertedWhileLoading: upserted,
      };
    }
  }
}
