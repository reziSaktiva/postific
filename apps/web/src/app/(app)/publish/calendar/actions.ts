"use server";

import { asPostId, asUserId } from "@postific/shared";

import { AnalyticsService } from "@/domains/analytics";
import { PublishingService, type CalendarPostItem } from "@/domains/publishing";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";

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
