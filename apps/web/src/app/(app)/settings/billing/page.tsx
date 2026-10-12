import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { ScaffoldPlaceholder } from "@/components/ScaffoldPlaceholder";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

// Settings → Billing (Post-MVP placeholder, belum ada field/aksi nyata).
// RBAC (roles-permissions.md, KI-045): Creator "Tidak ada akses" ke Billing
// & Subscription sama sekali — gate route tetap ditutup meski placeholder
// belum bisa dimutasi, supaya konsisten dengan General/Members dan tidak
// perlu ditambah belakangan saat Billing benar-benar diimplementasikan.
// Pola sama seperti (app)/settings/members/page.tsx dan
// (app)/settings/page.tsx — redirect ke "/settings/account" (profile
// pribadi, bisa diakses semua role).
export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const actorUserId = asUserId(session.user.id);

  const canAccessBilling = await workspaceService.canManageWorkspaceSettings(
    workspaceId,
    actorUserId,
  );
  if (!canAccessBilling) {
    redirect("/settings/account");
  }

  return (
    <ScaffoldPlaceholder
      title="Settings — Billing (Post-MVP)"
      message="Placeholder — Billing tidak termasuk roadmap rilis manapun saat ini (lihat project-manager/tasks/v10-public-launch.md)."
    />
  );
}
