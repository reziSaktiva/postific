import type {
  EngagementInboxItemRecord,
  InboxItemStatus,
  InboxPostSort,
} from "@/domains/engagement";

import type { InboxPostGroupDto } from "../actions";

/**
 * Model murni tampilan Engage per posting (T-219, ADR-157): label, ringkasan,
 * urutan, dan pembaruan optimistis. Tanpa React dan tanpa IO supaya mudah
 * diuji lewat batas publiknya.
 */

/** Kunci kelompok "Tanpa posting" (`postId` kosong) pada pilihan dan `key` React. */
export const NO_POST_KEY = "none";

export const STATUS_LABEL: Record<InboxItemStatus, string> = {
  unread: "Belum dibalas",
  replied: "Dibalas",
  resolved: "Selesai",
  dismissed: "Diabaikan",
};

export const STATUS_BADGE_VARIANT = {
  unread: "warning",
  replied: "success",
  resolved: "secondary",
  dismissed: "outline",
} as const satisfies Record<InboxItemStatus, string>;

/** Pesan komposer nonaktif untuk kelompok "Tanpa posting" (ADR-113, keputusan King Rezi 2026-11-06). */
export const NO_POST_REPLY_MESSAGE =
  "Komentar ini tidak terkait posting, jadi tidak dapat dibalas dari Postific.";

export function groupKey(group: Pick<InboxPostGroupDto, "postId">): string {
  return group.postId ?? NO_POST_KEY;
}

export interface CommentSummary {
  total: number;
  replied: number;
  unread: number;
  /** `replied` + `resolved` + `dismissed`. */
  handled: number;
}

export function summarizeComments(
  items: readonly Pick<EngagementInboxItemRecord, "status">[],
): CommentSummary {
  const unread = items.filter((item) => item.status === "unread").length;
  const replied = items.filter((item) => item.status === "replied").length;
  return {
    total: items.length,
    replied,
    unread,
    handled: items.length - unread,
  };
}

/** Persentase komentar yang sudah ditangani (progress bar kartu), 0 bila belum ada komentar. */
export function handledPercent(
  group: Pick<InboxPostGroupDto, "totalCount" | "handledCount">,
): number {
  return group.totalCount > 0
    ? Math.round((group.handledCount / group.totalCount) * 100)
    : 0;
}

export function filterByStatus<
  T extends Pick<EngagementInboxItemRecord, "status">,
>(items: readonly T[], status: InboxItemStatus | "all"): T[] {
  return status === "all"
    ? [...items]
    : items.filter((item) => item.status === status);
}

/** Urutan komentar di panel kanan; "belum dibalas dulu" adalah bawaan (S-006). */
export function sortComments<
  T extends Pick<EngagementInboxItemRecord, "status" | "receivedAt">,
>(items: readonly T[], sort: InboxPostSort = "unreplied_first"): T[] {
  const time = (item: T) => item.receivedAt.getTime();
  return [...items].sort((a, b) => {
    if (sort === "oldest") return time(a) - time(b);
    if (sort === "unreplied_first") {
      const unreadA = a.status === "unread" ? 0 : 1;
      const unreadB = b.status === "unread" ? 0 : 1;
      if (unreadA !== unreadB) return unreadA - unreadB;
    }
    return time(b) - time(a);
  });
}

/** Hitungan kartu setelah satu komentar berpindah status (pembaruan optimistis). */
export function applyStatusToGroup(
  group: InboxPostGroupDto,
  from: InboxItemStatus,
  to: InboxItemStatus,
): InboxPostGroupDto {
  if (from === to || (from === "unread") === (to === "unread")) return group;
  const delta = to === "unread" ? 1 : -1;
  return {
    ...group,
    unrepliedCount: group.unrepliedCount + delta,
    handledCount: group.handledCount - delta,
  };
}

/** Aksi hover yang berlaku untuk satu status (KSP-06-F06). */
export function availableStatusActions(status: InboxItemStatus): {
  resolve: boolean;
  dismiss: boolean;
  reopen: boolean;
} {
  const open = status === "unread" || status === "replied";
  return { resolve: open, dismiss: open, reopen: !open };
}

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Ada komentar lebih dari sebulan (memicu banner "fokuskan pada percakapan terbaru"). */
export function hasStaleComments(
  items: readonly Pick<EngagementInboxItemRecord, "receivedAt">[],
  now: Date = new Date(),
): boolean {
  return items.some(
    (item) => now.getTime() - item.receivedAt.getTime() > ONE_MONTH_MS,
  );
}
