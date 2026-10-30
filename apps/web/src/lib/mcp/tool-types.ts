import type { UserId, WorkspaceId } from "@postific/shared";
import type { McpScope } from "@/domains/mcp-access";
import type { AnalyticsService } from "@/domains/analytics";
import type { EngagementService } from "@/domains/engagement";
import type { MediaService } from "@/domains/media";
import type {
  ComposeDraftUseCase,
  PublishingService,
} from "@/domains/publishing";
import type { WorkspaceService } from "@/domains/workspace";

/**
 * API publik service BC lain yang dibungkus tool (pemetaan di
 * `application-layer.md` § McpAccessService). Dibatasi lewat `Pick` supaya
 * tipe tetap mengikuti signature service asli, sementara tes cukup
 * menyuplai double lokal berisi method itu saja (AGENTS.md #11).
 */
export interface McpToolServices {
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
  /** Tool tulis scope `draft` (T-152): validasi + simpan draft lewat use-case publishing. */
  drafts: Pick<ComposeDraftUseCase, "createDraft" | "updateDraft">;
}

/** Konteks handler; identitas selalu dari grant yang lolos `authorizeCall`, bukan dari argumen tool. */
export interface McpToolContext {
  workspaceId: WorkspaceId;
  userId: UserId;
  /** `clientId` OAuth klien AI dari grant yang lolos; dipakai penanda sumber post (`created_via_client_id`). */
  clientId: string;
  /** Nama klien dari grant (sudah dirapikan); dibekukan di post saat `create_draft`. */
  clientName: string | null;
  grantScopes: readonly McpScope[];
  services: McpToolServices;
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
  required?: readonly string[];
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
