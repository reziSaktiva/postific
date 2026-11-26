import type { CursorPage } from "@postific/shared";

/**
 * What a Board column or a List tab changes when the server renders
 * `/publish` again after a mutation (S-009 review 2026-11-25; List tabs
 * T-308): the list keeps the pages it has loaded (and its scroll position)
 * instead of starting again, upserts every item of its new first page, and
 * removes a loaded item that is no longer in this list:
 *
 * - it is on another Board column's new first page (it moved, e.g. Cancel
 *   schedule moves a card from Scheduled to Draft);
 * - or it sorts inside the range the new first page covers yet is not on
 *   it (it was deleted or left for a column where it sits past page one).
 *   The whole column is that range when the new first page is its last.
 *
 * A card past that range that left the column is not seen here; Realtime
 * or the next load of the page that holds it corrects it.
 */
export function mergeRevalidatedPage<T extends { id: string }>({
  loaded,
  page,
  movedToOtherColumn,
  compare,
}: {
  loaded: readonly T[];
  page: CursorPage<T>;
  /** Ids on the new first page of any other Board column. */
  movedToOtherColumn?: ReadonlySet<string>;
  compare: (a: T, b: T) => number;
}): { upserts: T[]; removes: string[] } {
  const onPage = new Set(page.items.map((item) => item.id));
  const last = page.items[page.items.length - 1];
  const removes = loaded
    .filter((item) => {
      if (onPage.has(item.id)) return false;
      if (movedToOtherColumn?.has(item.id)) return true;
      if (page.nextCursor === null) return true;
      return last !== undefined && compare(item, last) < 0;
    })
    .map((item) => item.id);
  return { upserts: [...page.items], removes };
}
