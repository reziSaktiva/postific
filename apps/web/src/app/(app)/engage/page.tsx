import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { listInboxByPostAction } from "./actions";
import { EngageInboxView } from "./components/EngageInboxView";
import { DEFAULT_DATE_RANGE } from "./components/engage-model";

/**
 * `/engage` (KSP-06 Engage, T-219 per posting). Entry point tipis (AGENTS.md
 * #5): resolve workspace/session, ambil daftar posting awal lewat
 * `listInboxByPostAction` (filter bawaan, rentang 12 bulan) dan daftar akun
 * terkoneksi lewat `WorkspaceService.listConnectedAccounts` (opsi filter
 * Akun dan nama akun kartu; daftar LENGKAP, bukan turunan hasil terfilter),
 * lalu delegasikan render + state ke `EngageInboxView` (client).
 *
 * Tanpa Supabase Realtime (ADR-023): `EngageInboxView` mengambil data lewat
 * Server Action saat filter berubah, posting dipilih, atau Refresh diklik.
 */
export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const workspaceService = new WorkspaceService(workspaceRepository);

  // Daftar posting lewat Server Action yang sama dengan re-fetch di client:
  // satu jalur untuk ringkasan kelompok dan thumbnail ber-signed URL baru.
  const [groupsResult, accounts] = await Promise.all([
    listInboxByPostAction({ dateRange: DEFAULT_DATE_RANGE }),
    workspaceService.listConnectedAccounts(workspaceId, userId),
  ]);

  return (
    <EngageInboxView
      initialGroups={groupsResult.data ?? []}
      initialTruncated={groupsResult.truncated ?? false}
      initialLoadFailed={Boolean(groupsResult.error)}
      accounts={accounts}
    />
  );
}
