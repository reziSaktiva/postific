import type { MemberRole, UserId, WorkspaceId } from "@postific/shared";
import type { McpQuotaKind, McpScope } from "@/domains/mcp-access";
import type { AnalyticsService } from "@/domains/analytics";
import type { EngagementService } from "@/domains/engagement";
import type { IdentityService } from "@/domains/identity";
import type { MediaService, UploadMediaUseCase } from "@/domains/media";
import type {
  ComposeDraftUseCase,
  PublishingService,
  ScheduleContentsUseCase,
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
  /** Zona waktu pemilik koneksi (`User.timeZone`, T-168); dibaca `runMcpTool` tiap panggilan. */
  identity: Pick<IdentityService, "getProfile">;
  /** Dirakit malas di composition root (butuh `OUTSTAND_API_KEY`); hanya disentuh `list_comments`. */
  engagement: Pick<EngagementService, "listInbox">;
  /** Tool tulis scope `draft` (T-152): validasi + simpan draft lewat use-case publishing. */
  drafts: Pick<ComposeDraftUseCase, "createDraft" | "updateDraft">;
  /** `schedule_posts` (T-153): buat dan jadwalkan banyak konten, hasil per konten. Dirakit malas (butuh `OUTSTAND_API_KEY`). */
  scheduleContents: Pick<ScheduleContentsUseCase, "execute">;
  /** `upload_media` (T-155): simpan lewat alur `UploadMediaUseCase` yang sama dengan UI. */
  mediaUpload: Pick<UploadMediaUseCase, "execute">;
  /** `upload_media` (T-155): unduh URL pihak ketiga dengan proteksi SSRF (infra, `lib/net`). */
  remoteMedia: McpRemoteMediaFetcher;
}

export interface McpRemoteMediaFetcher {
  download(url: string): Promise<{ bytes: Buffer; finalUrl: URL }>;
}

/** Konteks handler; identitas selalu dari grant yang lolos `authorizeCall`, bukan dari argumen tool. */
export interface McpToolContext {
  workspaceId: WorkspaceId;
  userId: UserId;
  /**
   * Role member aktif pengguna di workspace grant, dibaca ulang tiap panggilan
   * oleh `authorizeCall` (ADR-138, T-252). Dasar RBAC use-case domain; tidak
   * pernah dari argumen tool.
   */
  actorRole: MemberRole;
  /** `clientId` OAuth klien AI dari grant yang lolos; dipakai penanda sumber post (`created_via_client_id`). */
  clientId: string;
  /** Nama klien dari grant (sudah dirapikan); dibekukan di post saat `create_draft`. */
  clientName: string | null;
  grantScopes: readonly McpScope[];
  /**
   * Zona IANA `User.timeZone` pemilik koneksi (T-168, ADR-146). Semua waktu
   * keluaran memakai zona ini dengan offset di ISO; waktu masukan tanpa
   * offset ditafsirkan di zona ini.
   */
  timeZone: string;
  /**
   * Kuota workspace dari `McpAccessService` (T-154), terikat ke workspace
   * grant oleh `runMcpTool`: handler tidak bisa menyebut workspace lain.
   * Dipakai tool yang menghitung kuota di luar `authorizeCall` (mis.
   * `scheduled_contents`, T-153). Melempar `McpRateLimitExceededError` bila
   * habis (dipetakan ke `rate_limited`).
   */
  consumeQuota: (quota: McpQuotaKind, amount?: number) => Promise<void>;
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
