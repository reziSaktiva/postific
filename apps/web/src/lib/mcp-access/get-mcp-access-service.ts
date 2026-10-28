import { McpAccessService } from "@/domains/mcp-access";
import { WorkspaceService } from "@/domains/workspace";
import {
  mcpAuditRepository,
  mcpGrantRepository,
  mcpGrantRevocationAdapter,
} from "@/lib/repositories/mcp-access";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * Composition root `McpAccessService` (BC-04, T-149.6) — satu-satunya tempat
 * service dirakit dari repository Prisma, adapter pencabutan atomik, dan port
 * keanggotaan. Port keanggotaan diisi `WorkspaceService.getMembership`
 * (API publik domain `workspace`, AGENTS.md #7), bukan repository workspace
 * langsung: `McpAccessService` tidak mengimpor domain `workspace`.
 *
 * `WorkspaceService` di sini hanya dipakai untuk `getMembership`, jadi cukup
 * disuplai `workspaceRepository` (dependency lain opsional dan tidak
 * disentuh method itu). Dipanggil per request oleh endpoint MCP (T-150),
 * hook consent, Server Action Settings (T-156), dan JOB-08; service ini
 * stateless dan murah dirakit, jadi tidak di-cache.
 */
export function getMcpAccessService(): McpAccessService {
  return new McpAccessService(
    mcpGrantRepository,
    mcpAuditRepository,
    mcpGrantRevocationAdapter,
    new WorkspaceService(workspaceRepository),
  );
}
