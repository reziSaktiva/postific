import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { EngagementService } from "@/domains/engagement";
import { WorkspaceService } from "@/domains/workspace";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { getCachedSession } from "@/lib/better-auth/session";
import { engagementRepository } from "@/lib/repositories/engagement";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { EngageInboxView } from "./components/EngageInboxView";

/**
 * `/engage` (T-053, KSP-06 Engage → Inbox) — Comments Inbox. Entry point
 * tipis (AGENTS.md #5): resolve workspace/session, ambil data awal lewat
 * `EngagementService.listInbox` (tanpa filter — state default "Semua
 * Akun"/"Semua Platform"/"Semua Status") dan
 * `WorkspaceService.listConnectedAccounts` (opsi dropdown filter Akun,
 * pola sama `CalendarPage`/`CalendarToolbar` — daftar akun LENGKAP, bukan
 * derive dari `items` yang sudah terfilter, supaya opsi filter tidak
 * hilang saat filter lain aktif), lalu delegasikan render + state
 * filter/detail ke `EngageInboxView` (client).
 *
 * Data engagement TIDAK memakai Supabase Realtime (ADR-023 membatasinya
 * hanya untuk tabel `notifications`) — `EngageInboxView` re-fetch lewat
 * Server Action (`listInboxAction`/`refreshInboxAction`, T-052) saat
 * filter berubah atau tombol Refresh diklik, bukan subscribe channel
 * apa pun.
 */
export default async function Page() {
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
  const workspaceService = new WorkspaceService(workspaceRepository);

  const [items, accounts] = await Promise.all([
    engagementService.listInbox({ workspaceId }, userId),
    workspaceService.listConnectedAccounts(workspaceId, userId),
  ]);

  return <EngageInboxView initialItems={items} accounts={accounts} />;
}
