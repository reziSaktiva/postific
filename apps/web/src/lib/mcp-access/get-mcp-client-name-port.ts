import type { WorkspaceId } from "@postific/shared";
import { getMcpAccessService } from "./get-mcp-access-service";

/**
 * Adapter tipis `McpClientNamePort` (publishing, T-157) di atas
 * `McpAccessService.getClientNames` — satu tempat supaya composition root
 * halaman/action Drafts, Queue, dan History tidak menduplikasi.
 */
export function getMcpClientNamePort(): {
  getClientNames(
    workspaceId: WorkspaceId,
    clientIds: string[],
  ): Promise<Map<string, string>>;
} {
  const service = getMcpAccessService();
  return {
    getClientNames: (workspaceId, clientIds) =>
      service.getClientNames(workspaceId, clientIds),
  };
}
