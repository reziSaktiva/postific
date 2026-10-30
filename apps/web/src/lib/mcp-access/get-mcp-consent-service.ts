import { McpConsentService } from "@/domains/mcp-access";
import { WorkspaceService } from "@/domains/workspace";
import {
  mcpClientIdentityRepository,
  mcpWorkspaceChoiceRepository,
} from "@/lib/repositories/mcp-access";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * Composition root `McpConsentService` (T-151) — layar persetujuan OAuth
 * (`/select-workspace`, `/consent`), plugin OAuth (`consentReferenceId`), dan
 * JOB-08. Port workspace diisi `WorkspaceService` (API publik domain
 * `workspace`, AGENTS.md #5), bukan repository workspace langsung. Stateless
 * dan murah dirakit, jadi tidak di-cache (pola `getMcpAccessService`).
 */
export function getMcpConsentService(): McpConsentService {
  return new McpConsentService(
    mcpWorkspaceChoiceRepository,
    mcpClientIdentityRepository,
    new WorkspaceService(workspaceRepository),
  );
}
