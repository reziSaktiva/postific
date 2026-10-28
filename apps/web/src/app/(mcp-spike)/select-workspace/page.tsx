import { notFound, redirect } from "next/navigation";
import { asUserId } from "@postific/shared";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { mcpSpikeEnabled } from "@/lib/better-auth/mcp-spike";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { SelectWorkspaceForm } from "./SelectWorkspaceForm";

// T-148 (spike MCP) — langkah 1 dari 2. SEMENTARA; T-151 membangun layar final
// sesuai kartu ScreenOauthConsent.
export default async function SelectWorkspacePage() {
  if (!mcpSpikeEnabled()) {
    notFound();
  }
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaces = await new WorkspaceService(
    workspaceRepository,
  ).listWorkspacesForUser(asUserId(session.user.id));

  return (
    <SelectWorkspaceForm
      email={session.user.email}
      workspaces={workspaces.map((workspace) => ({
        id: workspace.workspaceId,
        name: workspace.name,
        role: workspace.role,
      }))}
    />
  );
}
