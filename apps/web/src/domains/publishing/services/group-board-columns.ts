import { ContentStatus, type CursorPage } from "@postific/shared";

import type { PublishPostOrder } from "../repositories/publishing.repository";

/**
 * Columns of the Publish Board (T-290, S-008, ADR-165): Draft · Approvals ·
 * Scheduled · Published · Failed, grouped by Status only. `Ready to Schedule`
 * cards sit in Draft (the card shows a "Ready to Schedule" badge); imported
 * posts are published posts, so they sit in Published.
 *
 * Each column loads its cards a page at a time (S-009, ADR-166) and shows
 * the true number of its cards from a count query.
 */
export const BOARD_COLUMN_KEYS = [
  "draft",
  "approvals",
  "scheduled",
  "published",
  "failed",
] as const;
export type BoardColumnKey = (typeof BOARD_COLUMN_KEYS)[number];

export function isBoardColumnKey(value: unknown): value is BoardColumnKey {
  return (
    typeof value === "string" &&
    (BOARD_COLUMN_KEYS as readonly string[]).includes(value)
  );
}

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

/**
 * Statuses and order of each column's query. Order inside a column:
 * Scheduled by publish time, soonest first (as the Queue); Published most
 * recent first (`publishedAt ?? updatedAt`); the others by last edit,
 * newest first. The id breaks ties.
 */
export const BOARD_COLUMN_SELECTION: Record<
  BoardColumnKey,
  { statuses: readonly ContentStatus[]; order: PublishPostOrder }
> = {
  draft: {
    statuses: [ContentStatus.Draft, ContentStatus.ReadyToSchedule],
    order: "updated-desc",
  },
  approvals: { statuses: [ContentStatus.InReview], order: "updated-desc" },
  scheduled: { statuses: [ContentStatus.Scheduled], order: "scheduled-asc" },
  published: {
    statuses: [ContentStatus.Published, ContentStatus.Imported],
    order: "occurred-desc",
  },
  failed: { statuses: [ContentStatus.Failed], order: "updated-desc" },
};

/** One Board column: its first page of cards and its true total. */
export interface BoardColumn<T> {
  key: BoardColumnKey;
  page: CursorPage<T>;
  /** Every card of the column, not only the loaded ones (count query). */
  total: number;
}

interface BoardSortable {
  id: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

/**
 * Order of the cards of `key`, the same order the column's query uses
 * (`BOARD_COLUMN_SELECTION`). Used by the client list to place a card.
 */
export function compareBoardCards(key: BoardColumnKey) {
  const time = (value: Date | null, fallback: Date) =>
    (value ?? fallback).getTime();
  return (a: BoardSortable, b: BoardSortable): number => {
    let diff: number;
    if (key === "scheduled") {
      diff =
        time(a.scheduledAt, a.updatedAt) - time(b.scheduledAt, b.updatedAt);
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }
    diff =
      key === "published"
        ? time(b.publishedAt, b.updatedAt) - time(a.publishedAt, a.updatedAt)
        : b.updatedAt.getTime() - a.updatedAt.getTime();
    if (diff !== 0) return diff;
    if (key === "published") {
      diff = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (diff !== 0) return diff;
    }
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  };
}
