import type {
  InboxDateRange,
  InboxItemCounts,
  InboxItemStatus,
  InboxPostSort,
} from "@/domains/engagement";

import type { InboxPostGroupDto } from "../engage-dto";

/**
 * Model murni tampilan Engage per posting (T-219, ADR-157): label, ringkasan,
 * urutan, dan pembaruan optimistis. Tanpa React dan tanpa IO supaya mudah
 * diuji lewat batas publiknya.
 */

/** Nilai "semua" pada Select filter (Akun, Status, Platform). */
export const ALL_FILTER_VALUE = "all";

/** Bawaan filter sekunder (S-006, ADR-157, keputusan King Rezi T-216). */
export const DEFAULT_SORT: InboxPostSort = "unreplied_first";
export const DEFAULT_DATE_RANGE: InboxDateRange = "12m";

export const SORT_OPTIONS: { value: InboxPostSort; label: string }[] = [
  { value: "unreplied_first", label: "Belum dibalas dulu" },
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
];

export const DATE_RANGE_OPTIONS: { value: InboxDateRange; label: string }[] = [
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "6m", label: "6 bulan terakhir" },
  { value: "12m", label: "12 bulan terakhir" },
];

/** Jumlah filter di panel Filter & Sort yang menyimpang dari bawaan (titik angka pada tombol). */
export function countPanelFilters(f: {
  sort: InboxPostSort;
  dateRange: InboxDateRange;
  platform: string;
}): number {
  return (
    (f.sort !== DEFAULT_SORT ? 1 : 0) +
    (f.dateRange !== DEFAULT_DATE_RANGE ? 1 : 0) +
    (f.platform !== ALL_FILTER_VALUE ? 1 : 0)
  );
}

/** Tampilan Engage (ADR-157 Q5, KSP-06-F09): By post bawaan, List = daftar datar lintas posting. */
export type EngageView = "post" | "list";

/** Hasil balasan terakhir untuk pesan komposer: `marked` = komentar ikut ditandai Dibalas (hanya dari Belum dibalas). */
export type JustSent = "sent" | "marked" | null;

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

/**
 * Ringkasan komentar satu posting dari hitungan kelompok (count query di
 * server), bukan dari komentar yang sudah dimuat: daftar komentar berhalaman
 * (T-303), jadi panjang daftar termuat bukan total.
 */
export function summarizeGroup(
  group: Pick<
    InboxPostGroupDto,
    "totalCount" | "repliedCount" | "unrepliedCount" | "handledCount"
  >,
): CommentSummary {
  return {
    total: group.totalCount,
    replied: group.repliedCount,
    unread: group.unrepliedCount,
    handled: group.handledCount,
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

interface CommentOrderKey {
  id: string;
  status: InboxItemStatus;
  receivedAt: Date;
}

/** Urutan komentar yang sama dengan kueri repository: sort, lalu id sebagai tie-breaker. */
export function compareComments(
  sort: InboxPostSort,
): (a: CommentOrderKey, b: CommentOrderKey) => number {
  return (a, b) => {
    if (sort === "unreplied_first") {
      const rankA = a.status === "unread" ? 0 : 1;
      const rankB = b.status === "unread" ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
    }
    const byTime = a.receivedAt.getTime() - b.receivedAt.getTime();
    if (byTime !== 0) return sort === "oldest" ? byTime : -byTime;
    if (a.id === b.id) return 0;
    return (a.id < b.id ? -1 : 1) * (sort === "oldest" ? 1 : -1);
  };
}

/**
 * Urutan kelompok yang sama dengan kueri repository: posting berkomentar
 * (sort, lalu id posting naik), posting tanpa komentar (urutan sumber), lalu
 * "Tanpa posting" di dasar.
 */
export function compareGroups(
  sort: InboxPostSort,
): (a: InboxPostGroupDto, b: InboxPostGroupDto) => number {
  const rank = (group: InboxPostGroupDto) =>
    group.postId === null ? 2 : group.totalCount === 0 ? 1 : 0;
  return (a, b) => {
    const rankA = rank(a);
    const rankB = rank(b);
    if (rankA !== rankB) return rankA - rankB;
    if (rankA !== 0) return 0;
    if (sort === "unreplied_first" && a.unrepliedCount !== b.unrepliedCount) {
      return b.unrepliedCount - a.unrepliedCount;
    }
    const timeA = a.latestReceivedAt?.getTime() ?? 0;
    const timeB = b.latestReceivedAt?.getTime() ?? 0;
    if (timeA !== timeB)
      return sort === "oldest" ? timeA - timeB : timeB - timeA;
    return a.postId === b.postId
      ? 0
      : (a.postId ?? "") < (b.postId ?? "")
        ? -1
        : 1;
  };
}

/** Hitungan kartu setelah satu komentar berpindah status (pembaruan optimistis). */
export function applyStatusToGroup(
  group: InboxPostGroupDto,
  from: InboxItemStatus,
  to: InboxItemStatus,
): InboxPostGroupDto {
  if (from === to) return group;
  const wasUnread = from === "unread";
  const isUnread = to === "unread";
  const unreadDelta = wasUnread === isUnread ? 0 : isUnread ? 1 : -1;
  const repliedDelta =
    (to === "replied" ? 1 : 0) - (from === "replied" ? 1 : 0);
  return {
    ...group,
    unrepliedCount: group.unrepliedCount + unreadDelta,
    handledCount: group.handledCount - unreadDelta,
    repliedCount: group.repliedCount + repliedDelta,
  };
}

/**
 * Hitungan tampilan List (`total`, `unread`) setelah satu komentar berpindah
 * status. Komentar yang tidak lagi cocok filter Status keluar dari hitungan
 * (dan dari daftar yang ditampilkan), sama seperti saat server menghitung ulang.
 */
export function applyStatusToCounts(
  counts: InboxItemCounts,
  from: InboxItemStatus,
  to: InboxItemStatus,
  statusFilter: InboxItemStatus | "all",
): InboxItemCounts {
  const matches = (status: InboxItemStatus) =>
    statusFilter === "all" || status === statusFilter;
  const counted = (status: InboxItemStatus) => (matches(status) ? 1 : 0);
  const unread = (status: InboxItemStatus) =>
    matches(status) && status === "unread" ? 1 : 0;
  return {
    total: counts.total + counted(to) - counted(from),
    unread: counts.unread + unread(to) - unread(from),
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

/** Posting punya komentar lebih dari sebulan (memicu banner "fokuskan pada percakapan terbaru"). */
export function hasStaleComments(
  group: Pick<InboxPostGroupDto, "oldestReceivedAt">,
  now: Date = new Date(),
): boolean {
  return (
    group.oldestReceivedAt !== null &&
    now.getTime() - group.oldestReceivedAt.getTime() > ONE_MONTH_MS
  );
}
