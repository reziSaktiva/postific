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
 * Cancel Schedule (T-030.3) — dipanggil dari footer `CalendarPostPopover`
 * di halaman Calendar. Business logic (RBAC, guard status Scheduled,
 * panggilan `OutstandAdapter.cancelScheduledPost` per target) hidup di
 * `CancelScheduleUseCase.execute` — reuse 100% dari implementasi Queue
 * (T-032.4), hanya beda `revalidatePath` tujuannya. Action ini hanya
 * wiring: resolve workspace context/session, delegasikan ke use-case, lalu
 * revalidate halaman Calendar supaya popover/kartu yang dibatalkan langsung
 * hilang dari daftar tanpa perlu refresh manual.
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

  revalidatePath("/publish/calendar");
  return {};
}

/**
 * Granular patch Realtime Calendar (T-092.3, ADR-094 poin 5) — dipanggil
 * `CalendarScreen` (client) saat event `usePublishingPostsRealtime`
 * (`INSERT`/`UPDATE`) masuk, untuk fetch SATU record termapping
 * `PublishingService.getCalendarPostById` (bukan refetch seluruh list Calendar
 * — reuse method yang sama pola dengan `getHistoryById`/`getDraftById`, tapi
 * mengembalikan `null` alih-alih throw untuk kasus post tidak lagi
 * ditemukan/valid, ADR-094 poin 5). Entry point ini murni wiring: resolve
 * workspace/session, delegasikan ke Application Service — tidak ada business
 * logic (AGENTS.md #5).
 *
 * `null` berarti post sudah tidak ada/di-soft-delete/keluar dari workspace
 * ini — `CalendarScreen` menafsirkannya sebagai sinyal remove dari local
 * state, sama seperti kalau record ditemukan tapi tidak lagi cocok kriteria
 * tampilan (rentang tanggal/filter status/akun).
 *
 * Sesi expired dipetakan ke `null` (BUKAN `redirect("/login")`) — action ini
 * dipanggil dari handler event Realtime di background, bukan dari klik user,
 * jadi tab yang idle tidak boleh tiba-tiba di-navigate ke halaman lain.
 */
export async function getCalendarPostAction(
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
