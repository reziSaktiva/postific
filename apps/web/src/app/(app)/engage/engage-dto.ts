import type {
  EngagementInboxItemRecord,
  InboxDateRange,
  InboxItemCounts,
  InboxItemStatus,
  InboxPostGroup,
  InboxPostGroupCounts,
  InboxPostSort,
} from "@/domains/engagement";
import type { MediaThumbnailDto } from "@/domains/media";

/**
 * Bentuk data Engage yang melintasi batas server-klien (T-303, ADR-166):
 * halaman pertama dari RSC dan halaman berikutnya dari Route Handler GET.
 * Hanya tipe (tanpa logika), jadi aman diimpor klien maupun server.
 */

/** Snapshot posting siap-render untuk kartu posting (T-218): `mediaIds` diganti thumbnail ber-signed URL. */
export interface InboxPostGroupSnapshotDto {
  caption: string;
  platformPostUrl: string | null;
  thumbnail: MediaThumbnailDto | null;
}

/** Kelompok posting siap-render (T-218). */
export type InboxPostGroupDto = Omit<InboxPostGroup, "postSnapshot"> & {
  postSnapshot: InboxPostGroupSnapshotDto | null;
};

/**
 * Parameter satu daftar Engage dalam bentuk primitif (query string): dipetakan
 * dan divalidasi di service, bukan percaya pada klien.
 */
export interface EngageListParams {
  connectedAccountId?: string;
  platform?: string;
  status?: InboxItemStatus;
  sort?: InboxPostSort;
  dateRange?: InboxDateRange;
}

/** Satu halaman kelompok posting. `counts` hanya pada halaman pertama. */
export interface PostGroupsPage {
  groups: InboxPostGroupDto[];
  nextCursor: string | null;
  counts: InboxPostGroupCounts | null;
}

/** Satu halaman komentar. `counts` hanya pada halaman pertama tampilan List. */
export interface CommentsPage {
  items: EngagementInboxItemRecord[];
  nextCursor: string | null;
  counts: InboxItemCounts | null;
  /** `postId` -> caption posting asal (tampilan List). */
  postCaptions: Record<string, string>;
}
