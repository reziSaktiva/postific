"use server";

import { asPostId, asUserId } from "@postific/shared";

import {
  PublishingService,
  type HistoryItemRecord,
} from "@/domains/publishing";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { publishingRepository } from "@/lib/repositories/publishing";

/**
 * Granular patch Realtime History (T-092.6, ADR-094 poin 5, 7) — dipanggil
 * `HistoryList` (client) saat event `usePublishingPostsRealtime`
 * (`INSERT`/`UPDATE`) masuk, untuk fetch SATU record termapping. Reuse
 * `PublishingService.getHistoryPostById` (method baru, BUKAN
 * `getCalendarPostById` — lihat catatan lengkap di service itu soal kenapa
 * proyeksi Calendar tidak cukup untuk History) — sama pola
 * `getDraftPostAction` (T-092.5)/`getQueuePostAction` (T-092.4). Entry
 * point ini murni wiring: resolve workspace/session, delegasikan ke
 * Application Service — tidak ada business logic (AGENTS.md #5).
 *
 * `null` berarti post sudah tidak ada/di-soft-delete/keluar dari workspace
 * ini — `HistoryList` menafsirkannya sebagai sinyal remove dari local
 * state, sama seperti kalau record ditemukan tapi statusnya sudah bukan
 * `Published`/`Failed` lagi (`HISTORY_TERMINAL_STATUSES`).
 *
 * Sesi expired dipetakan ke `null` (BUKAN `redirect("/login")`) — action ini
 * dipanggil dari handler event Realtime di background, bukan dari klik user,
 * jadi tab yang idle tidak boleh tiba-tiba di-navigate ke halaman lain.
 */
export async function getHistoryPostAction(
  postId: string,
): Promise<HistoryItemRecord | null> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    return null;
  }

  const publishingService = new PublishingService(publishingRepository);

  return publishingService.getHistoryPostById(
    workspaceId,
    asPostId(postId),
    asUserId(session.user.id),
  );
}
