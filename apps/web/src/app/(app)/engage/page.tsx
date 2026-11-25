import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { EngageInboxView } from "./components/EngageInboxView";
import { DEFAULT_DATE_RANGE } from "./components/engage-model";
import { loadPostGroupsPage } from "./engage-queries";

/**
 * `/engage` (KSP-06 Engage, T-219 per posting). Entry point tipis (AGENTS.md
 * #5): resolve workspace/session, ambil halaman pertama daftar posting
 * (filter bawaan, rentang 12 bulan, dengan hitungan sebenarnya) lewat
 * `loadPostGroupsPage` dan daftar akun terkoneksi lewat
 * `WorkspaceService.listConnectedAccounts` (opsi filter Akun dan nama akun
 * kartu; daftar LENGKAP, bukan turunan hasil terfilter), lalu delegasikan
 * render + state ke `EngageInboxView` (client).
 *
 * Halaman berikutnya (infinite scroll, T-303, ADR-166) dan perubahan filter
 * diambil `EngageInboxView` lewat Route Handler GET `/api/engage/*`.
 * Tanpa Supabase Realtime (ADR-023).
 */
export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const workspaceService = new WorkspaceService(workspaceRepository);

  // Satu kegagalan memuat daftar posting tidak boleh membuat halaman gagal:
  // tampil sebagai Alert gagal, bukan state "kosong".
  const [groupsResult, accounts] = await Promise.all([
    loadPostGroupsPage(
      { dateRange: DEFAULT_DATE_RANGE, withCounts: true },
      workspaceId,
      userId,
    ).then(
      (page) => ({ page }),
      (error: unknown) => {
        console.error("/engage: gagal memuat daftar posting", error);
        return { page: null };
      },
    ),
    workspaceService.listConnectedAccounts(workspaceId, userId),
  ]);

  return (
    <EngageInboxView
      initialGroups={groupsResult.page?.groups ?? []}
      initialNextCursor={groupsResult.page?.nextCursor ?? null}
      initialCounts={groupsResult.page?.counts ?? null}
      initialLoadFailed={groupsResult.page === null}
      accounts={accounts}
    />
  );
}
