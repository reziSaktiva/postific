/** Domain-specific types for engagement. */
import type {
  ConnectedAccountId,
  InboxItemId,
  PostId,
  ReplyId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";

/**
 * Status `EngagementInboxItem` (schema.prisma § BC-05 — Engagement, kolom
 * `status` TEXT, default `"unread"`). T-217 (ADR-157): `done` lama menjadi
 * `resolved`; transisi diatur di `inbox-status.ts`.
 */
export type InboxItemStatus = "unread" | "replied" | "resolved" | "dismissed";

/**
 * Satu `EngagementInboxItem` — field mengikuti model Prisma persis
 * (`schema.prisma:347-372`). `postId` opsional (kolom nullable — komentar
 * bisa belum terhubung ke `PublishingPost` internal manapun).
 */
export interface EngagementInboxItemRecord {
  id: InboxItemId;
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  type: string;
  externalId: string;
  authorHandle: string;
  content: string;
  status: InboxItemStatus;
  postId: PostId | null;
  receivedAt: Date;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Satu `EngagementReply` — field mengikuti model Prisma persis
 * (`schema.prisma:374-388`). Method yang menghasilkan/mengonsumsi ini
 * (`createReply`/`listRepliesByInboxItemId`) disiapkan di T-050 tapi baru
 * dipakai use-case reply (T-054) — lihat catatan di
 * `IEngagementRepository`.
 */
export interface EngagementReplyRecord {
  id: ReplyId;
  inboxItemId: InboxItemId;
  userId: UserId;
  content: string;
  outstandReplyId: string | null;
  status: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Filter untuk `listInboxItems` — semua field opsional kecuali `workspaceId`. */
export interface InboxItemFilter {
  workspaceId: WorkspaceId;
  connectedAccountId?: ConnectedAccountId;
  platform?: SocialPlatform;
  status?: InboxItemStatus;
}
