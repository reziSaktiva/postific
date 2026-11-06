"use server";

import {
  SocialPlatform,
  asConnectedAccountId,
  asInboxItemId,
  asPostId,
  asUserId,
} from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EngagementService,
  INBOX_DATE_RANGES,
  inboxDateRangeStart,
  RefreshInboxUseCase,
  SyncCommentsUseCase,
  type EngagementInboxItemRecord,
  type EngagementReplyRecord,
  type InboxItemFilter,
  type InboxDateRange,
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

import { resolveSnapshotThumbnail } from "./snapshot-thumbnail";

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
  /** T-219: komentar satu posting; `null` = kelompok "Tanpa posting". */
  postId?: string | null;
  /** T-219: batasi `receivedAt` (rentang sama dengan daftar posting). */
  dateRange?: InboxDateRange;
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

  if (filter?.dateRange && !INBOX_DATE_RANGES.includes(filter.dateRange)) {
    return { error: "Rentang tanggal tidak dikenal." };
  }

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
      ...(filter?.postId !== undefined && {
        postId: filter.postId === null ? null : asPostId(filter.postId),
      }),
      ...(filter?.dateRange && {
        receivedSince: inboxDateRangeStart(filter.dateRange, new Date()),
      }),
    };
    const data = await engagementService.listInbox(inboxFilter, userId);
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
              thumbnail: resolveSnapshotThumbnail(
                postSnapshot,
                thumbnailByMediaId,
              ),
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
