import type { ConnectedAccountId, SocialPlatform } from "@postific/shared";
import type {
  InboxAggregateRow,
  InboxDateRange,
  InboxItemStatus,
  InboxPostGroupSummary,
  InboxPostSort,
  InboxPublishedPostRef,
} from "./types";

/**
 * Pengelompokan inbox per posting (T-218.1, ADR-157, S-006). Murni: tanpa
 * Prisma, tanpa IO — repository hanya menyuplai baris agregat.
 */

export const INBOX_POST_SORTS: readonly InboxPostSort[] = [
  "unreplied_first",
  "newest",
  "oldest",
];

export const INBOX_DATE_RANGES: readonly InboxDateRange[] = [
  "7d",
  "30d",
  "6m",
  "12m",
];

/** Batas bawah `receivedAt` (UTC) untuk satu rentang tanggal terhadap `now`. */
export function inboxDateRangeStart(range: InboxDateRange, now: Date): Date {
  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  const months = range === "6m" ? 6 : 12;
  // `setUTCMonth` meluap (31 Agu - 6 bulan -> 3 Mar); jepit ke akhir bulan target.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(now.getUTCDate(), lastDay),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}

export interface BuildInboxPostGroupsOptions {
  sort: InboxPostSort;
  /** Hanya kelompok yang punya minimal satu komentar berstatus ini. */
  status?: InboxItemStatus;
  /** Posting terbit tanpa komentar yang ikut ditampilkan (`includeEmpty`). */
  emptyPosts?: InboxPublishedPostRef[];
}

const UNREPLIED_STATUS: InboxItemStatus = "unread";

export function buildInboxPostGroups(
  rows: InboxAggregateRow[],
  { sort, status, emptyPosts = [] }: BuildInboxPostGroupsOptions,
): InboxPostGroupSummary[] {
  interface Acc {
    postId: InboxAggregateRow["postId"];
    totalCount: number;
    unrepliedCount: number;
    handledCount: number;
    latestReceivedAt: Date;
    primary: {
      connectedAccountId: ConnectedAccountId;
      platform: SocialPlatform;
    };
    accountIds: Set<ConnectedAccountId>;
    statuses: Set<InboxItemStatus>;
  }
  const byPost = new Map<string, Acc>();

  for (const row of rows) {
    const key = row.postId ?? "__none__";
    let acc = byPost.get(key);
    if (!acc) {
      acc = {
        postId: row.postId,
        totalCount: 0,
        unrepliedCount: 0,
        handledCount: 0,
        latestReceivedAt: row.latestReceivedAt,
        primary: {
          connectedAccountId: row.connectedAccountId,
          platform: row.platform,
        },
        accountIds: new Set(),
        statuses: new Set(),
      };
      byPost.set(key, acc);
    }
    acc.totalCount += row.count;
    if (row.status === UNREPLIED_STATUS) acc.unrepliedCount += row.count;
    else acc.handledCount += row.count;
    acc.accountIds.add(row.connectedAccountId);
    acc.statuses.add(row.status);
    if (row.latestReceivedAt > acc.latestReceivedAt) {
      acc.latestReceivedAt = row.latestReceivedAt;
      acc.primary = {
        connectedAccountId: row.connectedAccountId,
        platform: row.platform,
      };
    }
  }

  const withComments: InboxPostGroupSummary[] = [...byPost.values()]
    .filter((acc) => !status || acc.statuses.has(status))
    .map((acc) => ({
      postId: acc.postId,
      connectedAccountId: acc.primary.connectedAccountId,
      platform: acc.primary.platform,
      connectedAccountIds: [...acc.accountIds],
      totalCount: acc.totalCount,
      unrepliedCount: acc.unrepliedCount,
      handledCount: acc.handledCount,
      latestReceivedAt: acc.latestReceivedAt,
      statuses: [...acc.statuses],
    }));

  withComments.sort((a, b) => {
    const aTime = a.latestReceivedAt?.getTime() ?? 0;
    const bTime = b.latestReceivedAt?.getTime() ?? 0;
    if (sort === "oldest") return aTime - bTime;
    if (sort === "newest") return bTime - aTime;
    return b.unrepliedCount - a.unrepliedCount || bTime - aTime;
  });

  // Posting tanpa komentar tidak punya status, jadi tidak ikut saat filter
  // status aktif; ditaruh di akhir dengan urutan masukan (terbaru dulu dari
  // sumbernya).
  const commented = new Set(withComments.map((g) => g.postId));
  const empties: InboxPostGroupSummary[] = status
    ? []
    : emptyPosts
        .filter((ref) => !commented.has(ref.postId))
        .map((ref) => ({
          postId: ref.postId,
          connectedAccountId: ref.connectedAccountId,
          platform: ref.platform,
          connectedAccountIds: [ref.connectedAccountId],
          totalCount: 0,
          unrepliedCount: 0,
          handledCount: 0,
          latestReceivedAt: null,
          statuses: [],
        }));

  return [...withComments, ...empties];
}
