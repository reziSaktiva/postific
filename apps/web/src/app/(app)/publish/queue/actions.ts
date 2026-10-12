"use server";

import { asPostId, asUserId } from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import {
  CancelScheduleUseCase,
  PublishingService,
  type CalendarPostItem,
} from "@/domains/publishing";
import { toActionError } from "@/lib/utils/errors";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";

/**
 * Cancel Schedule (T-030, T-032.4) — dipanggil dari dialog konfirmasi Tier 2
 * (AlertDialog, pola `MembersTable.tsx`) di halaman Queue. Business logic
 * (RBAC, guard status Scheduled, panggilan
 * `OutstandAdapter.cancelScheduledPost` per target) hidup di
 * `CancelScheduleUseCase.execute` — action ini hanya wiring: resolve
 * workspace context/session (termasuk `role` yang sudah tervalidasi oleh
 * `proxy.ts` per request), delegasikan ke use-case, lalu revalidate halaman
 * Queue supaya card yang dibatalkan langsung hilang dari daftar tanpa perlu
 * refresh manual.
 */
export async function cancelScheduleAction(
  postId: string,
): Promise<{ error?: string }> {
  const { workspaceId, role } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  try {
    await new CancelScheduleUseCase(
      publishingRepository,
      getOutstandAdapter(),
    ).execute({
      workspaceId,
      postId: asPostId(postId),
      actorRole: role,
      actingUserId: asUserId(session.user.id),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/publish/queue");
  return {};
}

/**
 * Granular patch Realtime Queue (T-092.4, ADR-094 poin 5) — dipanggil
 * `QueueScreen` (client) saat event `usePublishingPostsRealtime`
 * (`INSERT`/`UPDATE`) masuk, untuk fetch SATU record termapping. Reuse
 * `PublishingService.getCalendarPostById` (bukan method baru) — shape
 * datanya (`CalendarPostItem`) adalah superset dari kebutuhan Queue
 * (`QueueItemRecord` + `status`/`publishedAt`/`metrics`), dan kriteria
 * tampilan Queue (hanya `Scheduled`) murni soal filtering, bukan soal
 * proyeksi data berbeda — jadi tidak perlu duplikasi method
 * `IPublishingRepository` baru khusus Queue (pola sama T-092.3, tapi
 * screen ini yang menilai kecocokan kriteria, bukan action). Entry point
 * ini murni wiring: resolve workspace/session, delegasikan ke Application
 * Service — tidak ada business logic (AGENTS.md #5).
 *
 * `null` berarti post sudah tidak ada/di-soft-delete/keluar dari workspace
 * ini — `QueueScreen` menafsirkannya sebagai sinyal remove dari local
 * state, sama seperti kalau record ditemukan tapi statusnya sudah bukan
 * `Scheduled` lagi (mis. sudah Published/Failed, atau kembali ke Draft
 * lewat Cancel Schedule).
 *
 * Sesi expired dipetakan ke `null` (BUKAN `redirect("/login")`) — action ini
 * dipanggil dari handler event Realtime di background, bukan dari klik user,
 * jadi tab yang idle tidak boleh tiba-tiba di-navigate ke halaman lain.
 */
export async function getQueuePostAction(
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
