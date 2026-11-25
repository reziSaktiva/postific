/** Domain-specific types for engagement. */
import type {
  ConnectedAccountId,
  PageCursor,
  InboxItemId,
  PostId,
  ReplyId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";

/**
 * Status `EngagementInboxItem` (schema.prisma § BC-05 — Engagement, kolom
 * `status` TEXT, default `"unread"`). T-217 (ADR-157): `done` lama menjadi
 * `resolved`; transisi diatur di `inbox-status.ts`.
 */
export type InboxItemStatus = "unread" | "replied" | "resolved" | "dismissed";

/**
 * Satu `EngagementInboxItem` — field mengikuti model Prisma persis
 * (`schema.prisma:347-372`). `postId` opsional (kolom nullable — komentar
 * bisa belum terhubung ke `PublishingPost` internal manapun).
 */
export interface EngagementInboxItemRecord {
  id: InboxItemId;
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  type: string;
  externalId: string;
  authorHandle: string;
  content: string;
  status: InboxItemStatus;
  postId: PostId | null;
  receivedAt: Date;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Satu `EngagementReply` — field mengikuti model Prisma persis
 * (`schema.prisma:374-388`). Method yang menghasilkan/mengonsumsi ini
 * (`createReply`/`listRepliesByInboxItemId`) disiapkan di T-050 tapi baru
 * dipakai use-case reply (T-054) — lihat catatan di
 * `IEngagementRepository`.
 */
export interface EngagementReplyRecord {
  id: ReplyId;
  inboxItemId: InboxItemId;
  userId: UserId;
  content: string;
  outstandReplyId: string | null;
  status: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Filter untuk `listInboxItems` — semua field opsional kecuali `workspaceId`. */
export interface InboxItemFilter {
  workspaceId: WorkspaceId;
  connectedAccountId?: ConnectedAccountId;
  platform?: SocialPlatform;
  status?: InboxItemStatus;
  /**
   * T-218 — komentar satu posting. `null` = kelompok "Tanpa posting" (kolom
   * `post_id` kosong); `undefined` = tidak memfilter per posting.
   */
  postId?: PostId | null;
  /** T-218 — batas bawah (inklusif) `receivedAt`; lihat `inboxDateRangeStart`. */
  receivedSince?: Date;
}

/** Urutan daftar posting Engage (T-218.2, S-006). */
export type InboxPostSort = "unreplied_first" | "newest" | "oldest";

/** Rentang tanggal atas `receivedAt` (T-218.2): 7 hari, 30 hari, 6 bulan, 12 bulan. */
export type InboxDateRange = "7d" | "30d" | "6m" | "12m";

/**
 * Referensi posting terbit untuk menampilkan posting tanpa komentar
 * (`includeEmpty`, T-218.4). Diisi `publishing` lewat port.
 */
export interface InboxPublishedPostRef {
  postId: PostId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
}

/** Satu kelompok posting di inbox Engage (T-218.1). */
export interface InboxPostGroupSummary {
  /** `null` = kelompok "Tanpa posting". */
  postId: PostId | null;
  /** Akun/platform dari komentar terbaru kelompok (posting multi-akun: akun yang paling baru aktif). */
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  /** Seluruh akun yang punya komentar di kelompok ini. */
  connectedAccountIds: ConnectedAccountId[];
  totalCount: number;
  /** Komentar berstatus `unread`. */
  unrepliedCount: number;
  /** Komentar `replied` + `resolved` + `dismissed` (untuk progress bar). */
  handledCount: number;
  /** Komentar `replied` (ringkasan "x dibalas / y total", T-303). */
  repliedCount: number;
  /** `null` hanya untuk posting tanpa komentar (`includeEmpty`). */
  latestReceivedAt: Date | null;
  /** Komentar tertua kelompok (banner "percakapan terbaru", T-303); `null` bila tanpa komentar. */
  oldestReceivedAt: Date | null;
  /** Status yang dimiliki minimal satu komentar di kelompok (untuk filter status). */
  statuses: InboxItemStatus[];
}

/**
 * Satu permintaan halaman daftar komentar (T-303, ADR-166). `sort` ikut
 * kueri karena urutan harus dibuat database: halaman tidak lagi memuat
 * seluruh komentar untuk diurut di klien.
 */
export interface InboxItemsPageRequest {
  sort: InboxPostSort;
  cursor?: PageCursor | null;
  limit: number;
}

/** Hitungan sebenarnya (count query) untuk satu filter komentar. */
export interface InboxItemCounts {
  total: number;
  /** Komentar `unread` di antara `total`. */
  unread: number;
}

/**
 * Filter daftar kelompok posting (T-303). Sama dengan filter agregasi lama,
 * ditambah `status` (kelompok yang punya minimal satu komentar berstatus ini;
 * hitungan tetap atas semua komentar) dan `postId` (satu kelompok, dipakai
 * untuk membuka posting di luar halaman yang dimuat).
 */
export interface InboxPostGroupFilter {
  workspaceId: WorkspaceId;
  connectedAccountId?: ConnectedAccountId;
  platform?: SocialPlatform;
  status?: InboxItemStatus;
  receivedSince?: Date;
  postId?: PostId;
}

/** Satu permintaan halaman kelompok posting. */
export interface InboxPostGroupsPageRequest {
  sort: InboxPostSort;
  cursor?: PageCursor | null;
  limit: number;
}

/** Hitungan sebenarnya untuk daftar kelompok posting. */
export interface InboxPostGroupCounts {
  /** Kelompok bernomor posting yang cocok filter (tanpa "Tanpa posting"). */
  postCount: number;
  /** Komentar `unread` di semua kelompok yang cocok (termasuk "Tanpa posting"). */
  unrepliedCount: number;
}
