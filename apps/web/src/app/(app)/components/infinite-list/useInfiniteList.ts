"use client";

import { useCallback, useInsertionEffect, useRef, useState } from "react";

import type { CursorPage, PageCursor } from "@postific/shared";

import {
  createInfiniteListState,
  infiniteListReducer,
  type InfiniteListAction,
  type InfiniteListCompare,
  type InfiniteListGetKey,
  type InfiniteListState,
  type InfiniteListStatus,
} from "./infinite-list-state";

/** Loads one page. Contract: see `UseInfiniteListOptions.loadPage`. */
export type InfiniteListLoader<T> = () => Promise<CursorPage<T>>;

export interface UseInfiniteListOptions<T> {
  /** First page, rendered by the server. Read once, on mount. */
  initialPage: CursorPage<T>;
  /**
   * Loads the page after `cursor`, with the section's filters already bound.
   * Its latest value is always used. Contract (ADR-166; RS-D01, Server
   * Actions are only for mutations):
   * - it fetches a GET Route Handler of the section;
   * - it throws on a non-OK response or an `{ error }` body, so the Retry
   *   Alert shows; a resolved value is always treated as a good page;
   * - it never redirects mid-scroll: an expired session comes back as an
   *   error (the Retry Alert), not as a navigation;
   * - the cursor comes from the browser, so the Route Handler validates it
   *   and answers an invalid or expired one with an error, as
   *   `McpInvalidCursorError` does in `lib/mcp/cursor.ts`.
   * The `loadFirstPage` passed to `refresh` follows the same contract.
   */
  loadPage: (cursor: PageCursor) => Promise<CursorPage<T>>;
  /** Stable identity of an item, used to keep items from repeating. */
  getKey: InfiniteListGetKey<T>;
  /** The list's sort order: negative when `a` comes before `b`. */
  compare: InfiniteListCompare<T>;
}

export interface InfiniteList<T> {
  items: T[];
  nextCursor: PageCursor | null;
  status: InfiniteListStatus;
  /**
   * True while a refresh is loading or has failed. `items` is empty then, so
   * the section shows the footer's loading rows or error, not its empty state.
   */
  isRefreshing: boolean;
  /** Loads the next page. Does nothing while loading, after an error, or at the end. */
  loadMore: () => void;
  /** After an error, asks again for the page that failed (next page or refresh). */
  retry: () => void;
  /**
   * Starts again from the first page fetched by `loadFirstPage` (a filter
   * change). Only the latest refresh is applied: a page from before it, or
   * from an older refresh, is dropped when it arrives.
   */
  refresh: (loadFirstPage: InfiniteListLoader<T>) => void;
  /**
   * Starts again from a first page the caller already has. Drops any page
   * still on its way.
   */
  reset: (page: CursorPage<T>) => void;
  /** Adds or updates one item from a realtime event, in sort order. */
  upsert: (item: T) => void;
  /** Removes one item by key (realtime delete, or it left this list). */
  remove: (key: string) => void;
}

function settle<T>(load: InfiniteListLoader<T>): Promise<CursorPage<T>> {
  try {
    return load();
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Client state for one infinite-scroll list (ADR-166, spec S-009).
 *
 * `initialPage` is read once. When the section's filter changes, it either
 * renders the list under a React `key` made from the filter (a new list
 * from a new server page), or calls `refresh` with a loader for the new
 * filter's first page. Calling `reset` with a page fetched by hand is only
 * safe when no other first page can still arrive.
 *
 * Counts (tab totals, column totals, unread badge) are not kept here: they
 * come from the section's own count query and realtime handler.
 */
export function useInfiniteList<T>({
  initialPage,
  loadPage,
  getKey,
  compare,
}: UseInfiniteListOptions<T>): InfiniteList<T> {
  const [state, setState] = useState(() =>
    createInfiniteListState(initialPage),
  );
  // Mirrors `state` but is written at once by `dispatch`, so two calls in the
  // same tick (two sentinel hits, a refresh then a loadMore) see each other's
  // effect before React re-renders.
  const stateRef = useRef<InfiniteListState<T>>(state);
  const lastRefreshRef = useRef<InfiniteListLoader<T> | null>(null);

  // Latest callbacks for the async handlers; written before any effect runs.
  const optionsRef = useRef({ loadPage, getKey, compare });
  useInsertionEffect(() => {
    optionsRef.current = { loadPage, getKey, compare };
  }, [loadPage, getKey, compare]);

  const dispatch = useCallback(
    (action: InfiniteListAction<T>): InfiniteListState<T> => {
      const current = stateRef.current;
      const next = infiniteListReducer(current, action);
      if (next !== current) {
        stateRef.current = next;
        setState(next);
      }
      return next;
    },
    [],
  );

  const loadNext = useCallback(() => {
    const before = stateRef.current;
    const after = dispatch({ type: "load-start" });
    if (after === before) return;
    const { generation } = after;
    const cursor = after.nextCursor as PageCursor;
    settle(() => optionsRef.current.loadPage(cursor)).then(
      (page) =>
        dispatch({
          type: "load-success",
          generation,
          cursor,
          page,
          getKey: optionsRef.current.getKey,
          compare: optionsRef.current.compare,
        }),
      () => dispatch({ type: "load-failure", generation, cursor }),
    );
  }, [dispatch]);

  const refresh = useCallback(
    (loadFirstPage: InfiniteListLoader<T>) => {
      lastRefreshRef.current = loadFirstPage;
      const { generation } = dispatch({ type: "refresh-start" });
      settle(loadFirstPage).then(
        (page) =>
          dispatch({
            type: "refresh-success",
            generation,
            page,
            getKey: optionsRef.current.getKey,
            compare: optionsRef.current.compare,
          }),
        () => dispatch({ type: "refresh-failure", generation }),
      );
    },
    [dispatch],
  );

  const loadMore = useCallback(() => {
    if (stateRef.current.status === "idle") loadNext();
  }, [loadNext]);

  const retry = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== "error") return;
    if (current.request === "first" && lastRefreshRef.current) {
      refresh(lastRefreshRef.current);
    } else {
      loadNext();
    }
  }, [loadNext, refresh]);

  const reset = useCallback(
    (page: CursorPage<T>) => {
      lastRefreshRef.current = null;
      dispatch({ type: "reset", page });
    },
    [dispatch],
  );

  const upsert = useCallback(
    (item: T) => {
      dispatch({
        type: "upsert",
        item,
        getKey: optionsRef.current.getKey,
        compare: optionsRef.current.compare,
      });
    },
    [dispatch],
  );

  const remove = useCallback(
    (key: string) => {
      dispatch({ type: "remove", key, getKey: optionsRef.current.getKey });
    },
    [dispatch],
  );

  return {
    items: state.items,
    nextCursor: state.nextCursor,
    status: state.status,
    isRefreshing: state.request === "first",
    loadMore,
    retry,
    refresh,
    reset,
    upsert,
    remove,
  };
}
