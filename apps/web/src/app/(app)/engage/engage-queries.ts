import {
  asConnectedAccountId,
  asPageCursor,
  asPostId,
  type SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import {
  EngagementService,
  type InboxItemStatus,
  type ListInboxPageInput,
  type ListInboxPostGroupsPageInput,
} from "@/domains/engagement";
import { MediaService, type MediaThumbnailDto } from "@/domains/media";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { engagementRepository } from "@/lib/repositories/engagement";
import { mediaRepository } from "@/lib/repositories/media";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { resolveSnapshotThumbnail } from "../components/snapshot-thumbnail";
import type {
  CommentsPage,
  EngageListParams,
  InboxPostGroupDto,
  PostGroupsPage,
} from "./engage-dto";

/**
 * Pembacaan daftar Engage untuk entry point (T-303, ADR-166): halaman
 * pertama dari `page.tsx` (RSC) dan halaman berikutnya dari Route Handler
 * GET `/api/engage/*`. Murni wiring: merakit service, memetakan parameter
 * primitif ke tipe domain, dan meregenerasi signed URL thumbnail (pola
 * `MediaService` yang sama dengan sebelumnya). Validasi filter dan cursor
 * ada di `EngagementService`/repository.
 */

function buildService(): EngagementService {
  return new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );
}

function scopeOf(params: EngageListParams) {
  return {
    ...(params.connectedAccountId && {
      connectedAccountId: asConnectedAccountId(params.connectedAccountId),
    }),
    ...(params.platform && { platform: params.platform as SocialPlatform }),
    ...(params.status && { status: params.status as InboxItemStatus }),
    ...(params.sort && { sort: params.sort }),
    ...(params.dateRange && { dateRange: params.dateRange }),
  };
}

export interface PostGroupsQuery extends EngageListParams {
  cursor?: string | null;
  includeEmpty?: boolean;
  /** Hanya satu kelompok ini (membuka posting di luar halaman termuat). */
  postId?: string;
  withCounts?: boolean;
}

/** Satu halaman kelompok posting (By post), dengan thumbnail ber-signed URL baru. */
export async function loadPostGroupsPage(
  query: PostGroupsQuery,
  workspaceId: WorkspaceId,
  userId: UserId,
): Promise<PostGroupsPage> {
  const input: ListInboxPostGroupsPageInput = {
    workspaceId,
    ...scopeOf(query),
    ...(query.cursor && { cursor: asPageCursor(query.cursor) }),
    ...(query.includeEmpty && { includeEmpty: true }),
    ...(query.postId && { postId: asPostId(query.postId) }),
    ...(query.withCounts && { withCounts: true }),
  };
  const { groups, nextCursor, counts } =
    await buildService().listInboxPostGroupsPage(input, userId);

  const mediaService = new MediaService(
    mediaRepository,
    supabaseMediaStorageAdapter,
  );
  const firstMediaIds = [
    ...new Set(
      groups.flatMap((group) => {
        const first = group.postSnapshot?.mediaIds[0];
        return first ? [first] : [];
      }),
    ),
  ];
  // `listByIds` = satu query untuk seluruh media pertama dan meregenerasi
  // signed URL dari `storagePath`. Kegagalan resolve thumbnail tidak boleh
  // menggagalkan daftar posting: turun ke kartu tanpa thumbnail.
  const thumbnailByMediaId = new Map<string, MediaThumbnailDto>();
  try {
    const items = await mediaService.listByIds(
      { workspaceId, mediaIds: firstMediaIds },
      userId,
    );
    for (const item of items) {
      if (item.url) {
        thumbnailByMediaId.set(item.id, { url: item.url, type: item.type });
      }
    }
  } catch (error) {
    console.error("loadPostGroupsPage: gagal resolve thumbnail", error);
  }

  // T-230 (ADR-158): thumbnail tersimpan posting impor (path di bucket
  // `media`) ditandatangani sekali jalan; gagal berarti jatuh ke URL CDN
  // atau tanpa thumbnail, tidak pernah menggagalkan daftar.
  const storedPaths = groups.flatMap((group) => {
    const snapshot = group.postSnapshot;
    return snapshot &&
      snapshot.mediaIds.length === 0 &&
      snapshot.thumbnailStoragePath
      ? [snapshot.thumbnailStoragePath]
      : [];
  });
  const signedStoragePaths = await mediaService.signStoragePaths(
    workspaceId,
    storedPaths,
  );

  const data: InboxPostGroupDto[] = groups.map((group) => {
    const { postSnapshot, ...summary } = group;
    return {
      ...summary,
      postSnapshot: postSnapshot
        ? {
            caption: postSnapshot.caption,
            platformPostUrl: postSnapshot.platformPostUrl,
            thumbnail: resolveSnapshotThumbnail(
              postSnapshot,
              thumbnailByMediaId,
              signedStoragePaths,
            ),
          }
        : null,
    };
  });
  return { groups: data, nextCursor, counts };
}

export interface CommentsQuery extends EngageListParams {
  cursor?: string | null;
  /** Komentar satu posting; `null` = "Tanpa posting"; kosong = semua (List). */
  postId?: string | null;
  withCounts?: boolean;
  includePostCaptions?: boolean;
}

/** Satu halaman komentar (List, atau satu posting). */
export async function loadCommentsPage(
  query: CommentsQuery,
  workspaceId: WorkspaceId,
  userId: UserId,
): Promise<CommentsPage> {
  const input: ListInboxPageInput = {
    workspaceId,
    ...scopeOf(query),
    ...(query.cursor && { cursor: asPageCursor(query.cursor) }),
    ...(query.postId !== undefined && {
      postId: query.postId === null ? null : asPostId(query.postId),
    }),
    ...(query.withCounts && { withCounts: true }),
    ...(query.includePostCaptions && { includePostCaptions: true }),
  };
  const page = await buildService().listInboxPage(input, userId);
  return {
    items: page.items,
    nextCursor: page.nextCursor,
    counts: page.counts,
    postCaptions: page.postCaptions,
  };
}
