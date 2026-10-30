import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpAccessService } from "@/lib/mcp-access/get-mcp-access-service";
import { mcpBaseUrl, mcpResourceUrl } from "@/lib/mcp/config";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { AiClientsView, type AiClientItem } from "./components/AiClientsView";

// Settings → Account → Klien AI (T-156, ADR-139). Entry point tipis (RSC):
// hanya grant aktif MILIK pengguna sendiri (`listGrants`), nama workspace
// dari `WorkspaceService` (API publik domain workspace).
export default async function Page() {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const [grants, memberships] = await Promise.all([
    getMcpAccessService().listGrants(userId),
    new WorkspaceService(workspaceRepository).listWorkspacesForUser(userId),
  ]);
  const workspaceNames = new Map(
    memberships.map((m) => [m.workspaceId as string, m.name]),
  );

  const clients: AiClientItem[] = grants
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((grant) => ({
      id: grant.id,
      clientName: grant.clientName,
      workspaceName: workspaceNames.get(grant.workspaceId) ?? null,
      scopes: grant.scopes,
      connectedAt: grant.createdAt.toISOString(),
      lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
    }));

  return (
    <AiClientsView
      clients={clients}
      mcpUrl={mcpBaseUrl() ? mcpResourceUrl() : null}
    />
  );
}
