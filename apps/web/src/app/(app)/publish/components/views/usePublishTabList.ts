"use client";

import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ContentStatus,
  CursorPage,
  PageCursor,
  PostCreatedVia,
} from "@postific/shared";
import type { MediaThumbnailDto } from "@/domains/media";
import {
  buildPublishListPageSearch,
  isEmptyPublishListFilter,
  type PublishListFilter,
  type PublishListTab,
} from "@/domains/publishing";
import { usePublishingPostsRealtime } from "@/lib/hooks/use-publishing-posts-realtime";

import {
  useInfiniteList,
  type InfiniteList,
} from "../../../components/infinite-list/useInfiniteList";
import {
  matchesListFilter,
  useListFilter,
  type ListFilterState,
} from "./ListFilter";
import { fetchPublishJson } from "./publish-page-fetch";

/** Fields the List Filter reads from an item (`matchesListFilter`). */
export interface PublishTabItem {
  id: string;
  createdVia?: PostCreatedVia;
  status?: ContentStatus;
  targets?: readonly { connectedAccountId: string }[];
}

/** A List tab page as the server sends it (`PublishListPage`). */
export interface PublishTabPage<T> extends CursorPage<T> {
  thumbnails?: Record<string, MediaThumbnailDto>;
  /** True total of the tab under the filter; on a first page only. */
  total?: number;
}

const ENDPOINT = "/api/publish/list";

function filterKey(filter: PublishListFilter): string {
  return buildPublishListPageSearch({ tab: "queue", filter });
}

/**
 * One Publish List tab as an infinite-scroll list (S-009, ADR-166), shared
 * by Queue, Drafts, Approvals and History:
 *
 * - the first page comes from the server (`initialPage`), every next page
 *   from `GET /api/publish/list` with the tab's filter;
 * - a filter change clears the list and loads the first page and the
 *   total for the new filter (`refresh`); a late answer for an older filter
 *   is dropped;
 * - Realtime: each post change fetches that one post (`fetchLiveItem`) and
 *   upserts it when it belongs to this tab and filter, else removes it;
 *   then the tab total is counted again;
 * - when the server renders the page again (a mutation revalidated it),
 *   the new first page is merged in without dropping loaded pages;
 * - the tab total goes to the toolbar through the List Filter context.
 *
 * Counts never come from the page length.
 */
export function usePublishTabList<T extends PublishTabItem>({
  tab,
  initialPage,
  compare,
  workspaceId,
  fetchLiveItem,
}: {
  tab: PublishListTab;
  initialPage: PublishTabPage<T>;
  compare: (a: T, b: T) => number;
  workspaceId: string;
  /** This tab's version of a post, or `null` when it is not in this tab. */
  fetchLiveItem: (postId: string) => Promise<T | null>;
}): {
  list: InfiniteList<T>;
  filter: ReturnType<typeof useListFilter>;
  thumbnails: Record<string, MediaThumbnailDto>;
  /** Total of the tab without any filter (empty states). */
  unfilteredTotal: number;
} {
  const filter = useListFilter();
  const { channelIds, source, statuses, setLiveTotal } = filter;
  const listFilter = useMemo<ListFilterState>(
    () => ({ channelIds, source, statuses }),
    [channelIds, source, statuses],
  );
  const currentKey = filterKey(listFilter);
  // Latest filter for the async handlers; written before any effect runs.
  const filterRef = useRef(listFilter);
  const filterKeyRef = useRef(currentKey);
  useInsertionEffect(() => {
    filterRef.current = listFilter;
    filterKeyRef.current = currentKey;
  }, [listFilter, currentKey]);

  // Thumbnails of the pages loaded in the browser; the server page's own
  // (freshly signed) are laid over them.
  const [loadedThumbnails, setThumbnails] = useState<
    Record<string, MediaThumbnailDto>
  >({});
  const thumbnails = useMemo(
    () => ({ ...loadedThumbnails, ...initialPage.thumbnails }),
    [loadedThumbnails, initialPage.thumbnails],
  );
  const [unfilteredTotal, setUnfilteredTotal] = useState(
    initialPage.total ?? initialPage.items.length,
  );

  const applyTotal = useCallback(
    (total: number, forKey: string, forFilter: PublishListFilter) => {
      if (filterKeyRef.current !== forKey) return;
      setLiveTotal(total);
      if (isEmptyPublishListFilter(forFilter)) setUnfilteredTotal(total);
    },
    [setLiveTotal],
  );

  const fetchPage = useCallback(
    async (cursor: PageCursor | null): Promise<CursorPage<T>> => {
      const forFilter = filterRef.current;
      const forKey = filterKeyRef.current;
      const page = await fetchPublishJson<PublishTabPage<T>>(
        `${ENDPOINT}${buildPublishListPageSearch({ tab, filter: forFilter, cursor })}`,
      );
      if (page.thumbnails && Object.keys(page.thumbnails).length > 0) {
        setThumbnails((prev) => ({ ...prev, ...page.thumbnails }));
      }
      if (page.total !== undefined) applyTotal(page.total, forKey, forFilter);
      return { items: page.items, nextCursor: page.nextCursor };
    },
    [tab, applyTotal],
  );

  const getKey = useCallback((item: T) => item.id, []);
  const list = useInfiniteList<T>({
    initialPage,
    loadPage: fetchPage,
    getKey,
    compare,
  });
  const { refresh, upsert, remove } = list;

  // Server total of the first render goes to the toolbar.
  useEffect(() => {
    if (initialPage.total !== undefined) setLiveTotal(initialPage.total);
    // Only the mount: later totals come from the count query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter change: clear the list and load the new first page and total.
  const shownKeyRef = useRef(currentKey);
  useEffect(() => {
    if (shownKeyRef.current === currentKey) return;
    shownKeyRef.current = currentKey;
    refresh(() => fetchPage(null));
  }, [currentKey, refresh, fetchPage]);

  // The server rendered the page again (revalidated after a mutation): merge
  // its first page into the loaded items when it is for the same filter.
  const seenInitialRef = useRef(initialPage);
  useEffect(() => {
    if (seenInitialRef.current === initialPage) return;
    seenInitialRef.current = initialPage;
    if (!isEmptyPublishListFilter(filterRef.current)) return;
    for (const item of initialPage.items) upsert(item);
    if (initialPage.total !== undefined) {
      applyTotal(initialPage.total, filterKeyRef.current, filterRef.current);
    }
  }, [initialPage, upsert, applyTotal]);

  // Realtime: one post at a time, newest answer per post wins.
  const requestSeqRef = useRef<Map<string, number>>(new Map());
  const countSeqRef = useRef(0);
  const recount = useCallback(async () => {
    const seq = ++countSeqRef.current;
    const forFilter = filterRef.current;
    const forKey = filterKeyRef.current;
    try {
      const { total } = await fetchPublishJson<{ total: number }>(
        `${ENDPOINT}${buildPublishListPageSearch({ tab, filter: forFilter, countOnly: true })}`,
      );
      if (seq === countSeqRef.current) applyTotal(total, forKey, forFilter);
    } catch {
      // The count stays as it was; the next change counts again.
    }
  }, [tab, applyTotal]);

  const handleChange = useCallback(
    (event: { postId: string }) => {
      const seq = (requestSeqRef.current.get(event.postId) ?? 0) + 1;
      requestSeqRef.current.set(event.postId, seq);
      void (async () => {
        const item = await fetchLiveItem(event.postId);
        if (requestSeqRef.current.get(event.postId) !== seq) return;
        if (item && matchesListFilter(item, filterRef.current)) {
          upsert(item);
        } else {
          remove(event.postId);
        }
        void recount();
      })();
    },
    [fetchLiveItem, upsert, remove, recount],
  );

  usePublishingPostsRealtime(workspaceId, {
    onInsert: handleChange,
    onUpdate: handleChange,
  });

  return { list, filter, thumbnails, unfilteredTotal };
}
