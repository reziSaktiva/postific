import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { asConnectResult, WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { ConnectedAccountsList } from "./components/ConnectedAccountsList";

// ADR-076 (T-039.1-3): workspace context sekarang datang dari
// getWorkspaceContext() (header yang di-inject proxy.ts) — session gate
// sudah dilakukan sekali di (app)/layout.tsx, jadi tidak perlu redirect
// ulang di sini secara defensif, tapi `getCachedSession()` (React.cache,
// tidak ada round-trip tambahan) tetap dipanggil untuk resolve `userId`
// yang dibutuhkan `withCurrentUser` (RLS, KI-026 follow-up).
//
// `searchParams.connect` (T-013.1/T-013.2, T-015.3, ADR-105) — diset
// Route Handler `/api/integrations/outstand/callback` sebelum redirect
// balik ke halaman ini (`?connect=success|error`), dibaca di sini murni
// untuk diteruskan ke `ConnectedAccountsList` (Client Component) yang
// menampilkannya sebagai toast sekali saat mount — Server Component ini
// sendiri tidak punya business logic apa pun untuk query param ini.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    connect?: string;
    // Facebook Pages flow (T-025.4, KI-070, ADR-115 §7/§10; review fix) —
    // Route Handler menyimpan session token di cookie httpOnly; query
    // hanya membawa flag buka-dialog + `state` CSRF (bukan bearer).
    connectFacebook?: string;
    connectFacebookState?: string;
  }>;
}) {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const { connect, connectFacebook, connectFacebookState } = await searchParams;

  const workspaceService = new WorkspaceService(workspaceRepository);
  const actorUserId = asUserId(session.user.id);
  const [accounts, canManage] = await Promise.all([
    workspaceService.listConnectedAccounts(workspaceId, actorUserId),
    // T-109 (KI-058): halaman ini TETAP diakses Creator (read-only, beda
    // dari Members/Organization Settings yang redirect seluruh halaman) —
    // boolean ini cuma dipakai `ConnectedAccountsList` untuk
    // menyembunyikan tombol Connect/Disconnect/Reconnect, bukan gate akses
    // halaman.
    workspaceService.canManageConnectedAccounts(workspaceId, actorUserId),
  ]);

  return (
    <ConnectedAccountsList
      accounts={accounts}
      canManageConnections={canManage}
      connectResult={asConnectResult(connect)}
      facebookPagesPicker={
        connectFacebook === "1" && connectFacebookState
          ? { state: connectFacebookState }
          : null
      }
    />
  );
}
