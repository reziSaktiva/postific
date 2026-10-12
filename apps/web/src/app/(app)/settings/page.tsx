import { asUserId, MemberRole, MemberStatus } from "@postific/shared";
import { redirect } from "next/navigation";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { WorkspaceGeneralSettings } from "./components/WorkspaceGeneralSettings";

// Settings → Organization → General (T-008.4). ADR-076: workspaceId dari
// getWorkspaceContext() (header proxy.ts), bukan resolve ulang dari slug —
// pola sama seperti (app)/settings/members/page.tsx.
//
// RBAC (roles-permissions.md, KI-045): Creator "Tidak ada akses" ke
// Organization Settings sama sekali — bukan cuma section/tombol
// disembunyikan. Gate dicek di sini, SEBELUM data workspace/members
// dimuat, sama seperti pola members/page.tsx. Redirect ke "/settings/account"
// (profile pribadi user, bukan "/settings" — halaman ini sendiri yang
// sedang di-guard) karena halaman itu bisa diakses semua role tanpa
// bergantung pada role workspace.
export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const actorUserId = asUserId(session.user.id);

  const canAccessSettings = await workspaceService.canManageWorkspaceSettings(
    workspaceId,
    actorUserId,
  );
  if (!canAccessSettings) {
    redirect("/settings/account");
  }

  const [workspace, membership, members] = await Promise.all([
    workspaceService.getWorkspaceById(workspaceId),
    workspaceService.getMembership(workspaceId, actorUserId),
    workspaceService.listMembersWithUser(workspaceId, actorUserId),
  ]);

  if (!workspace) {
    redirect("/onboarding");
  }

  const isOwner =
    membership?.status === MemberStatus.Active &&
    membership.role === MemberRole.Owner;

  // Danger Zone (Transfer Ownership) hanya boleh menargetkan Admin aktif —
  // dipakai Selector target di WorkspaceGeneralSettings. Eligibility ini
  // dihitung lewat `listTransferEligibleMembers` (single source of truth,
  // sama persis dengan validasi di `WorkspaceService.transferOwnership` —
  // sebelumnya kriteria ini sempat terduplikasi inline di sini, code review
  // Ridwan). Hanya perlu dihitung untuk Owner; non-Owner tidak melihat
  // Danger Zone sama sekali (RBAC hidden, bukan read-only, sesuai desain).
  const activeAdmins = isOwner
    ? await workspaceService.listTransferEligibleMembers(
        workspaceId,
        actorUserId,
      )
    : [];

  const pendingTargetName = workspace.pendingOwnerTransferTo
    ? (members.find(
        (member) => member.userId === workspace.pendingOwnerTransferTo,
      )?.name ?? "Admin")
    : null;

  return (
    <WorkspaceGeneralSettings
      workspaceName={workspace.name}
      isOwner={isOwner}
      pendingTargetName={pendingTargetName}
      admins={activeAdmins.map((admin) => ({
        id: admin.id,
        name: admin.name,
      }))}
    />
  );
}
