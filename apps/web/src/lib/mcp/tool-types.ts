import type { UserId, WorkspaceId } from "@postific/shared";
import type { McpScope } from "@/domains/mcp-access";
import type { AnalyticsService } from "@/domains/analytics";
import type { EngagementService } from "@/domains/engagement";
import type { MediaService } from "@/domains/media";
import type { PublishingService } from "@/domains/publishing";
import type { WorkspaceService } from "@/domains/workspace";

/**
 * API publik service BC lain yang dibungkus tool baca (pemetaan di
 * `application-layer.md` § McpAccessService). Dibatasi lewat `Pick` supaya
 * tipe tetap mengikuti signature service asli, sementara tes cukup
 * menyuplai double lokal berisi method itu saja (AGENTS.md #11).
 */
export interface McpReadServices {
  workspace: Pick<
    WorkspaceService,
    "getWorkspaceById" | "listConnectedAccounts"
  >;
  media: Pick<MediaService, "listMediaItems">;
  publishing: Pick<
    PublishingService,
    "listDrafts" | "listQueue" | "listHistory" | "getHistoryById"
  >;
  analytics: Pick<AnalyticsService, "getDashboardSummary">;
  /** Dirakit malas di composition root (butuh `OUTSTAND_API_KEY`); hanya disentuh `list_comments`. */
  engagement: Pick<EngagementService, "listInbox">;
}

/** Konteks handler; identitas selalu dari grant yang lolos `authorizeCall`, bukan dari argumen tool. */
export interface McpToolContext {
  workspaceId: WorkspaceId;
  userId: UserId;
  grantScopes: readonly McpScope[];
  services: McpReadServices;
}

export interface McpToolOutput {
  /** Dikirim ke klien sebagai JSON. */
  data: unknown;
  /** ID hasil/target untuk audit (mis. `PostId`). */
  targetId?: string;
}

export interface McpJsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  additionalProperties: false;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  /** Scope logis yang dibutuhkan; diperiksa `McpAccessService.authorizeCall` per panggilan. */
  scope: McpScope;
  inputSchema: McpJsonSchema;
  handler(
    context: McpToolContext,
    args: Record<string, unknown>,
  ): Promise<McpToolOutput>;
}
