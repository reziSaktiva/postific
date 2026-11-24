import { ContentStatus } from "@postific/shared";

/**
 * Columns of the Publish Board (T-290, S-008, ADR-165): Draft · Approvals ·
 * Scheduled · Published · Failed, grouped by Status only. `Ready to Schedule`
 * cards sit in Draft (the card shows a "Ready to Schedule" badge); imported
 * posts are published posts, so they sit in Published.
 */
export const BOARD_COLUMN_KEYS = [
  "draft",
  "approvals",
  "scheduled",
  "published",
  "failed",
] as const;
export type BoardColumnKey = (typeof BOARD_COLUMN_KEYS)[number];

/** Cards a column shows; more are left out and the column says so (`hasMore`). */
export const BOARD_COLUMN_LIMIT = 100;

export function boardColumnOf(status: ContentStatus): BoardColumnKey {
  switch (status) {
    case ContentStatus.Draft:
    case ContentStatus.ReadyToSchedule:
      return "draft";
    case ContentStatus.InReview:
      return "approvals";
    case ContentStatus.Scheduled:
      return "scheduled";
    case ContentStatus.Published:
    case ContentStatus.Imported:
      return "published";
    case ContentStatus.Failed:
      return "failed";
  }
}

export interface BoardColumn<T> {
  key: BoardColumnKey;
  /** At most `limit` cards, in the order of the column. */
  items: T[];
  /** Cards that were given for this column, before the limit. */
  total: number;
  hasMore: boolean;
}

interface BoardSortable {
  status: ContentStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

/**
 * Group cards into the five Board columns, always all five and in order.
 * Order inside a column: Scheduled by publish time, soonest first (as the
 * Queue); Published most recent first; the others by last edit, newest first.
 * Pure function, no I/O, next to `groupQueueItemsByDate`.
 */
export function groupBoardColumns<T extends BoardSortable>(
  items: readonly T[],
  limit: number = BOARD_COLUMN_LIMIT,
): BoardColumn<T>[] {
  return BOARD_COLUMN_KEYS.map((key) => {
    const inColumn = items.filter((item) => boardColumnOf(item.status) === key);
    const sorted = [...inColumn].sort(compareFor(key));
    return {
      key,
      items: sorted.slice(0, limit),
      total: sorted.length,
      hasMore: sorted.length > limit,
    };
  });
}

function compareFor(key: BoardColumnKey) {
  const time = (value: Date | null, fallback: Date) =>
    (value ?? fallback).getTime();
  return (a: BoardSortable, b: BoardSortable): number => {
    if (key === "scheduled") {
      return (
        time(a.scheduledAt, a.updatedAt) - time(b.scheduledAt, b.updatedAt)
      );
    }
    if (key === "published") {
      return (
        time(b.publishedAt, b.updatedAt) - time(a.publishedAt, a.updatedAt)
      );
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  };
}
