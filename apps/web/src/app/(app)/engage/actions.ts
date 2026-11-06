"use server";

import {
  SocialPlatform,
  asConnectedAccountId,
  asInboxItemId,
  asUserId,
} from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EngagementService,
  RefreshInboxUseCase,
  SyncCommentsUseCase,
  type EngagementInboxItemRecord,
  type EngagementReplyRecord,
  type InboxItemDetail,
  type InboxItemFilter,
  type InboxItemStatus,
  type InboxPostGroup,
  type ListInboxByPostInput,
} from "@/domains/engagement";
import { MediaService, type MediaThumbnailDto } from "@/domains/media";
import { NotificationService } from "@/domains/notification";
import { WorkspaceService } from "@/domains/workspace";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { getCachedSession } from "@/lib/better-auth/session";
import { engagementRepository } from "@/lib/repositories/engagement";
import { mediaRepository } from "@/lib/repositories/media";
import { notificationRepository } from "@/lib/repositories/notification";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { toActionError } from "@/lib/utils/errors";
import { createActiveWorkspaceMembersPort } from "@/lib/workspace/active-members-port";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

/**
 * Manual refresh Comments Inbox (T-052, `background-jobs.md` § JOB-03).
 * Reuse `SyncCommentsUseCase.sync` — logic sync (fetch+upsert+notify) yang
 * SAMA dipakai `EngagementSyncJobHandler` (job periodik 30 menit) — tapi
 * DIPANGGIL LANGSUNG dari sini, tanpa lewat handler, karena refresh manual
 * bukan job periodik: sync sekali untuk seluruh `ConnectedAccount` aktif
 * workspace ini, lalu selesai — TIDAK enqueue job baru/self-reschedule.
 *
 * Data engagement TIDAK memakai Supabase Realtime (ADR-023 membatasinya
 * hanya untuk tabel `notifications`) — ini satu-satunya cara halaman
 * `/engage` bisa dapat data terbaru tanpa menunggu siklus cron.
 *
 * **Refactor (Temuan #2 review Ridwan Architecture Reviewer):** orkestrasi
 * "ambil daftar akun aktif, loop sync tiap akun, akumulasi
 * `newCommentsCount`" sebelumnya ada LANGSUNG di Server Action ini
 * (melanggar AGENTS.md #5 — entry point tanpa business logic). Sekarang
 * dipindahkan ke `RefreshInboxUseCase.refreshAll`
 * (`domains/engagement/services/refresh-inbox.use-case.ts`), pola sama
 * `SyncCommentsUseCase`. Entry point ini murni wiring: resolve
 * workspace/session, rakit dependency konkret (composition root, pola sama
 * `/api/jobs/run/route.ts`) — `WorkspaceService` instance dipassing
 * LANGSUNG sebagai `ConnectedAccountsPort` use-case (structural typing,
 * `listConnectedAccounts` sudah punya shape yang dibutuhkan) — lalu
 * delegasi SATU panggilan ke `refreshAll`. Signature return
 * (`{ error?, newCommentsCount? }`) dan behavior (toast jumlah komentar
 * baru, `revalidatePath("/engage")`) TIDAK berubah dari sebelumnya.
 */
export async function refreshInboxAction(): Promise<{
  error?: string;
  newCommentsCount?: number;
}> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const workspaceService = new WorkspaceService(workspaceRepository);
  const syncCommentsUseCase = new SyncCommentsUseCase(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    new NotificationService(notificationRepository),
    createActiveWorkspaceMembersPort(),
  );
  const refreshInboxUseCase = new RefreshInboxUseCase(
    syncCommentsUseCase,
    workspaceService,
  );

  try {
    const { newCommentsCount } = await refreshInboxUseCase.refreshAll(
      workspaceId,
      userId,
    );
    revalidatePath("/engage");
    return { newCommentsCount };
  } catch (error) {
    return toActionError(error);
  }
}

/** Filter opsional untuk `listInboxAction` — bentuk primitif (input dari client), dipetakan ke `InboxItemFilter` (branded types) sebelum diteruskan ke service. */
export interface ListInboxActionFilter {
  connectedAccountId?: string;
  platform?: string;
  status?: InboxItemStatus;
}

/**
 * Comments Inbox — daftar inbox item milik workspace aktif (T-053).
 * Murni wiring (AGENTS.md #5): resolve workspace/session, petakan filter
 * primitif dari client ke `InboxItemFilter` (branded types), lalu delegasi
 * ke `EngagementService.listInbox` — filtering/sorting sudah jadi tanggung
 * jawab repository (T-050), tidak ditambahkan lagi di sini.
 */
export async function listInboxAction(
  filter?: ListInboxActionFilter,
): Promise<{ data?: EngagementInboxItemRecord[]; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const engagementService = new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );

  try {
    const inboxFilter: InboxItemFilter = {
      workspaceId,
      ...(filter?.connectedAccountId && {
        connectedAccountId: asConnectedAccountId(filter.connectedAccountId),
      }),
      ...(filter?.platform && {
        platform: filter.platform as SocialPlatform,
      }),
      ...(filter?.status && { status: filter.status }),
    };
    const data = await engagementService.listInbox(inboxFilter, userId);
    return { data };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Snapshot post asli (T-056, KI-065) siap-render — `mediaIds` domain diganti
 * `thumbnail` tunggal yang sudah di-resolve URL-nya.
 *
 * `thumbnails` (T-111.4, array SELURUH media) ditambahkan DI SAMPING
 * `thumbnail` (dipertahankan, masih dipakai `EngageInboxView.tsx`) untuk
 * kartu "Post asal" bergaya Instagram dengan carousel (T-111.3, LOCKED
 * PATTERN Claude Design `templates/engage-inbox.html` § `.post-context`).
 */
export interface InboxDetailPostSnapshotDto {
  caption: string;
  platformPostUrl: string | null;
  thumbnail: MediaThumbnailDto | null;
  thumbnails: MediaThumbnailDto[];
}

/** `InboxItemDetail` domain + `postSnapshot` yang sudah dipetakan ke bentuk siap-render (T-056). */
export type InboxItemDetailDto = Omit<InboxItemDetail, "postSnapshot"> & {
  postSnapshot: InboxDetailPostSnapshotDto | null;
};

/**
 * Detail satu inbox item + seluruh balasannya (T-053; T-056/KI-065 menambah
 * `postSnapshot` siap-render untuk kotak "Post asal"). Murni wiring —
 * resolve workspace/session, delegasi ke
 * `EngagementService.getInboxItemDetail` untuk data domain, lalu (kalau
 * `postSnapshot.mediaIds` tidak kosong) resolve media PERTAMA (`thumbnail`,
 * `MediaService.resolveFirstThumbnail`) MAUPUN seluruh media (`thumbnails`,
 * `MediaService.resolveThumbnails`, T-111.4 — kartu "Post asal" carousel
 * T-111.3) ke URL tampil — pola sama `getDraftAction`
 * (`draft-editor/actions.ts`): kombinasi dua Application Service lalu
 * dipetakan jadi DTO siap-konsumsi client, BUKAN keputusan bisnis baru
 * (AGENTS.md #5).
 */
export async function getInboxItemDetailAction(
  inboxItemId: string,
): Promise<{ data?: InboxItemDetailDto; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const engagementService = new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );

  try {
    const detail = await engagementService.getInboxItemDetail(
      { workspaceId, inboxItemId: asInboxItemId(inboxItemId) },
      userId,
    );

    // `supabaseMediaStorageAdapter` disuplai (bug fix QA T-056, 2026-10-06)
    // — komentar inbox bisa dilihat lama setelah post dipublish, jadi `url`
    // yang di-cache dari waktu upload media hampir pasti sudah expired;
    // `MediaService.resolveFirstThumbnail` meregenerate signed URL baru
    // dari `storagePath` setiap panggilan supaya thumbnail "Post asal"
    // selalu valid (shared dengan History Detail, KI-082/KI-083).
    const mediaService = new MediaService(
      mediaRepository,
      supabaseMediaStorageAdapter,
    );
    const mediaIds = detail.postSnapshot?.mediaIds ?? [];
    const thumbnails = await mediaService.resolveThumbnails(
      { workspaceId, mediaIds },
      userId,
    );
    const thumbnail = thumbnails[0] ?? null;

    const data: InboxItemDetailDto = {
      ...detail,
      postSnapshot: detail.postSnapshot
        ? {
            caption: detail.postSnapshot.caption,
            platformPostUrl: detail.postSnapshot.platformPostUrl,
            thumbnail,
            thumbnails,
          }
        : null,
    };
    return { data };
  } catch (error) {
    return toActionError(error);
  }
}

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
 * Daftar posting beserta ringkasan komentarnya (T-218) untuk tampilan "By
 * post". Murni wiring — delegasi ke `EngagementService.listInboxByPost`,
 * lalu meregenerasi signed URL thumbnail (media pertama tiap posting) lewat
 * `MediaService.resolveThumbnails`, pola sama `getInboxItemDetailAction`
 * (URL yang tersimpan sudah kedaluwarsa saat komentar dibuka lama setelah
 * tayang). Satu panggilan media untuk seluruh kelompok, bukan satu per
 * kelompok.
 */
export async function listInboxByPostAction(
  input?: Omit<ListInboxByPostInput, "workspaceId">,
): Promise<{
  data?: InboxPostGroupDto[];
  truncated?: boolean;
  error?: string;
}> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const engagementService = new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );

  try {
    const { groups, truncated } = await engagementService.listInboxByPost(
      { ...input, workspaceId },
      userId,
    );

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
      console.error("listInboxByPostAction: gagal resolve thumbnail", error);
    }

    const data: InboxPostGroupDto[] = groups.map((group) => {
      const { postSnapshot, ...summary } = group;
      return {
        ...summary,
        postSnapshot: postSnapshot
          ? {
              caption: postSnapshot.caption,
              platformPostUrl: postSnapshot.platformPostUrl,
              thumbnail: postSnapshot.mediaIds[0]
                ? (thumbnailByMediaId.get(postSnapshot.mediaIds[0]) ?? null)
                : null,
            }
          : null,
      };
    });
    return { data, truncated };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Ubah status satu komentar (T-217). Murni wiring — resolve workspace/
 * session, delegasi ke `EngagementService.changeStatus`, lalu
 * `revalidatePath("/engage")` (pola sama `refreshInboxAction`).
 */
export async function changeInboxItemStatusAction(
  inboxItemId: string,
  status: InboxItemStatus,
): Promise<{ data?: EngagementInboxItemRecord; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const engagementService = new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );

  try {
    const data = await engagementService.changeStatus(
      { workspaceId, inboxItemId: asInboxItemId(inboxItemId), status },
      userId,
    );
    revalidatePath("/engage");
    return { data };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Tandai komentar selesai (T-053): sejak T-217 berarti status `resolved`.
 * Dipertahankan agar `EngageInboxView` tetap berfungsi sampai UI T-219.
 */
export async function markAsDoneAction(
  inboxItemId: string,
): Promise<{ data?: EngagementInboxItemRecord; error?: string }> {
  return changeInboxItemStatusAction(inboxItemId, "resolved");
}

/**
 * Balas komentar dari dalam aplikasi (T-054, `integration-layer.md`
 * § "Reply via Outstand API", ADR-019/ADR-040, KI-071). Murni wiring —
 * resolve workspace/session (RBAC: seluruh role member aktif workspace boleh
 * membalas, `roles-permissions.md` tidak membedakan akses Engagement per
 * role — tidak ada gating tambahan di sini selain member aktif, pola sama
 * Server Action lain), rakit `EngagementService` dengan `getOutstandAdapter()`
 * + `publishingRepository` (`PublishingPostReferencePort`) +
 * `workspaceRepository` (`ConnectedAccountHandlePort` — lookup handle per
 * id untuk `accountUsername`, KI-071), delegasi ke `EngagementService.reply`
 * (validasi `content` kosong/whitespace-only ada di service, bukan di sini —
 * konsisten dengan `IdentityService.updateProfile`), lalu
 * `revalidatePath("/engage")` (pola sama `changeInboxItemStatusAction`).
 */
export async function replyToCommentAction(
  inboxItemId: string,
  content: string,
): Promise<{ data?: EngagementReplyRecord; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const engagementService = new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );

  try {
    const data = await engagementService.reply(
      { workspaceId, inboxItemId: asInboxItemId(inboxItemId), content },
      userId,
    );
    revalidatePath("/engage");
    return { data };
  } catch (error) {
    return toActionError(error);
  }
}
