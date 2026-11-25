import { ContentStatus } from "@postific/shared";

import { toDateKey } from "../wib-time";

/**
 * Grouping for the List · Approvals and List · Drafts tabs (T-289, S-008).
 * Content without a schedule has no business date, so the day of its last
 * edit (`updatedAt`, newest first) is the group key and the time on the left
 * of the card, as the design shows the day and the time of the last change.
 * Pure functions, no I/O: used by the server tab and by the client lists
 * after a Realtime patch, so both order and group the same way.
 */

/** Minimal shape the Drafts and Approvals lists need to be grouped. */
export interface ApprovalListItem {
  id: string;
  status: ContentStatus;
  updatedAt: Date;
}

/** One day of the Approvals or Drafts list. */
export interface ApprovalGroup<T extends ApprovalListItem = ApprovalListItem> {
  /** "YYYY-MM-DD" calendar day in the display time zone; heading is UI. */
  date: string;
  items: T[];
}

/** Statuses of the Approvals tab: `In Review` only (ADR-165). */
export const APPROVAL_LIST_STATUSES: ReadonlySet<ContentStatus> = new Set([
  ContentStatus.InReview,
]);

/** Statuses of the Drafts tab: `Draft` and `Ready to Schedule` (ADR-165). */
export const DRAFT_LIST_STATUSES: ReadonlySet<ContentStatus> = new Set([
  ContentStatus.Draft,
  ContentStatus.ReadyToSchedule,
]);

/** `updatedAt` descending, `id` descending as a stable tie-breaker. */
export function compareApprovalItemsDesc(
  a: ApprovalListItem,
  b: ApprovalListItem,
): number {
  const byUpdated = b.updatedAt.getTime() - a.updatedAt.getTime();
  if (byUpdated !== 0) return byUpdated;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

function groupByUpdatedDay<T extends ApprovalListItem>(
  items: T[],
  timeZone: string,
  statuses: ReadonlySet<ContentStatus>,
): ApprovalGroup<T>[] {
  const groups: ApprovalGroup<T>[] = [];
  const groupByDate = new Map<string, ApprovalGroup<T>>();

  for (const item of items
    .filter((candidate) => statuses.has(candidate.status))
    .sort(compareApprovalItemsDesc)) {
    const date = toDateKey(item.updatedAt, timeZone);
    let group = groupByDate.get(date);
    if (!group) {
      group = { date, items: [] };
      groupByDate.set(date, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

/** Group `In Review` items by the day of their last change; other statuses are left out. */
export function groupApprovalItemsByDate<T extends ApprovalListItem>(
  items: T[],
  timeZone: string,
): ApprovalGroup<T>[] {
  return groupByUpdatedDay(items, timeZone, APPROVAL_LIST_STATUSES);
}

/** Group `Draft` and `Ready to Schedule` items by the day of their last change. */
export function groupDraftItemsByDate<T extends ApprovalListItem>(
  items: T[],
  timeZone: string,
): ApprovalGroup<T>[] {
  return groupByUpdatedDay(items, timeZone, DRAFT_LIST_STATUSES);
}
