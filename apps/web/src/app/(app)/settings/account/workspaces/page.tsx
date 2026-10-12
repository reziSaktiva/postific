import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { WorkspacesSettingsView } from "./components/WorkspacesSettingsView";

// Settings → Account → Workspaces (T-089.3, ADR-088). Entry point tipis
// (RSC, AGENTS.md #5) — HANYA resolve context + panggil Application
// Service, tanpa business logic. Pola sama seperti `(app)/settings/page.tsx`
// dan `(app)/settings/members/page.tsx` (ADR-076: workspaceId dari
// `getWorkspaceContext()`, bukan resolve ulang dari slug).
export default async function Page() {
  const { workspaceId: activeWorkspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const userId = asUserId(session.user.id);

  const memberships = await workspaceService.listWorkspacesForUser(userId);

  const workspaces = memberships.map((membership) => ({
    id: membership.workspaceId,
    name: membership.name,
    slug: membership.slug,
    role: membership.role,
    isActive: membership.workspaceId === activeWorkspaceId,
  }));

  return <WorkspacesSettingsView workspaces={workspaces} />;
}
