import type { InboxDateRange, InboxPostSort } from "./types";

/**
 * Aturan murni inbox per posting (T-218, ADR-157, S-006): urutan dan rentang
 * tanggal. Pengelompokan dan paging dilakukan repository di database (T-303).
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
