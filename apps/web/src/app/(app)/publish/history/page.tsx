import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { PublishingService } from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { HistoryList } from "./components/HistoryList";

/**
 * `/publish/history` (T-034.2, KSP-D10) — entry point tipis: fetch
 * `PublishingService.listHistory` (default `HISTORY_TERMINAL_STATUSES`,
 * tanpa filter — filter Status/Akun T-034.2 dilakukan client-side di
 * `HistoryList`, sama pola dengan `QueueList` T-032.3, bukan lewat
 * `?status=`/`?accounts=` seperti Calendar T-033.6 yang butuh re-fetch
 * rentang tanggal server-side).
 *
 * **T-092.6 (ADR-094 poin 5, 7):** pengelompokan per tanggal
 * (`groupHistoryItemsByDate`) dipindah ke dalam `HistoryList` (client) —
 * bukan lagi dilakukan di sini — karena granular patch Realtime butuh
 * meng-upsert/remove 1 item ke state lokal lalu mengelompokkan ULANG hasil
 * gabungannya; kalau grouping tetap terjadi di composition root, hasil
 * patch granular tidak akan pernah tercermin ke pengelompokan tampilan.
 * `items` (flat, sudah terurut `updatedAt` descending oleh
 * `listHistory`) yang dikirim sebagai prop, sama pola dengan `DraftsList`
 * (T-092.5) yang menerima list flat, bukan yang sudah diolah lebih lanjut.
 *
 * `WorkspaceService.listConnectedAccounts` dipanggil di sini (cross-domain
 * lewat public API module lain, AGENTS.md #7) untuk opsi filter Akun —
 * daftar akun lengkap workspace, bukan derive dari `items` yang sudah
 * terfilter, sama alasan `calendar/page.tsx`.
 */
export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const publishingService = new PublishingService(publishingRepository);
  const workspaceService = new WorkspaceService(workspaceRepository);

  const [items, accounts] = await Promise.all([
    publishingService.listHistory({ workspaceId }, userId),
    workspaceService.listConnectedAccounts(workspaceId, userId),
  ]);

  // `HistoryList` (client) subscribe `usePublishingPostsRealtime` (T-092.6,
  // ADR-094 poin 5, 6, 7) — `workspaceId` dipakai untuk subscribe channel
  // `publishing_posts:{workspaceId}`, bukan untuk fetch data apa pun
  // langsung di komponen itu (AGENTS.md #5).
  return (
    <HistoryList items={items} accounts={accounts} workspaceId={workspaceId} />
  );
}
