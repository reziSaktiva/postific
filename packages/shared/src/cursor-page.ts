/**
 * Cursor paging shape for long lists (ADR-166, spec S-009): types, one
 * constant and the `asPageCursor` brand helper (like `asEmail`/`asUrl`). No
 * business logic (AGENTS.md rule 5).
 *
 * The cursor is opaque to every caller: only the repository that made it
 * knows what is inside (for example a sort time plus an id). Callers pass it
 * back unchanged to get the next page.
 */

/** Opaque position in a list; built and read only by the repository. */
export type PageCursor = string & { readonly _brand: "PageCursor" };

/** One page of a list. `nextCursor` is `null` when there is nothing more. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: PageCursor | null;
}

/** Request for one page. No cursor (or `null`) means the first page. */
export interface CursorPageRequest {
  cursor?: PageCursor | null;
  limit: number;
}

/** Items per page for every infinite-scroll list (ADR-166). */
export const LIST_PAGE_SIZE = 20;

export function asPageCursor(value: string): PageCursor {
  return value as PageCursor;
}
