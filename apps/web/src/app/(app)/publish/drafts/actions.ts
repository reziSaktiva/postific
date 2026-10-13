"use server";

import { asPostId, asUserId } from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import { PublishingService, type CalendarPostItem } from "@/domains/publishing";
import { toActionError } from "@/lib/utils/errors";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";

/**
 * Delete Post (T-035.2/.3, ADR-049 Tier 2) — dipanggil dari dialog
 * konfirmasi Tier 2 (`ConfirmActionDialog`, pola `disconnectAccountAction`/
 * `cancelScheduleAction`) di halaman Drafts. Business logic (RBAC, guard
 * status — HANYA post Draft yang boleh dihapus, lihat
 * `PublishingService.deletePost`) hidup sepenuhnya di Application Service —
 * action ini hanya wiring: resolve workspace context (termasuk `role` yang
 * sudah tervalidasi `proxy.ts` per request)/session, delegasikan, lalu
 * revalidate halaman Drafts supaya baris yang dihapus langsung hilang dari
 * daftar tanpa perlu refresh manual.
 */
export async function deletePostAction(
  postId: string,
): Promise<{ error?: string }> {
  const { workspaceId, role } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(publishingRepository);

  try {
    await publishingService.deletePost(
      {
        workspaceId,
        postId: asPostId(postId),
        actorRole: role,
      },
      asUserId(session.user.id),
    );
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/publish/drafts");
  return {};
}

/**
 * Granular patch Realtime Drafts (T-092.5, ADR-094 poin 5) — dipanggil
 * `DraftsList` (client) saat event `usePublishingPostsRealtime`
 * (`INSERT`/`UPDATE`) masuk, untuk fetch SATU record termapping. Reuse
 * `PublishingService.getCalendarPostById` (bukan method baru) — sama pola
 * `getQueuePostAction` (T-092.4): shape data `CalendarPostItem` sudah
 * membawa `caption`/`status`/`updatedAt` yang dibutuhkan tampilan Drafts,
 * kriteria tampilan (`Draft`/`InReview`/`ReadyToSchedule`) murni soal
 * filtering di client, bukan proyeksi data berbeda — jadi tidak perlu
 * method `IPublishingRepository` baru khusus Drafts. Entry point ini murni
 * wiring: resolve workspace/session, delegasikan ke Application Service —
 * tidak ada business logic (AGENTS.md #5).
 *
 * `null` berarti post sudah tidak ada/di-soft-delete/keluar dari workspace
 * ini — `DraftsList` menafsirkannya sebagai sinyal remove dari local state,
 * sama seperti kalau record ditemukan tapi statusnya sudah bukan salah satu
 * dari 3 status kriteria Drafts lagi (mis. sudah Scheduled/Published/Failed).
 *
 * Sesi expired dipetakan ke `null` (BUKAN `redirect("/login")`) — action ini
 * dipanggil dari handler event Realtime di background, bukan dari klik user,
 * jadi tab yang idle tidak boleh tiba-tiba di-navigate ke halaman lain.
 */
export async function getDraftPostAction(
  postId: string,
): Promise<CalendarPostItem | null> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    return null;
  }

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );

  return publishingService.getCalendarPostById(
    workspaceId,
    asPostId(postId),
    asUserId(session.user.id),
  );
}
