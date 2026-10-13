/** Canonical enums shared across bounded contexts. */

export enum ContentStatus {
  Draft = "draft",
  InReview = "in_review",
  ReadyToSchedule = "ready_to_schedule",
  Scheduled = "scheduled",
  Published = "published",
  Failed = "failed",
  /**
   * Import Posts dari Social Account (T-090, ADR-093) — post yang dibuat
   * LANGSUNG di platform sosial (bukan lewat tool kita), ditarik via
   * endpoint berbayar Outstand `POST /v1/social-accounts/{id}/imports`.
   * Status ini TERMINAL dan IMMUTABLE — tidak ada transisi dari/ke status
   * lain, dan tidak ada RBAC action (`updateDraft`/`deletePost`/
   * `cancelSchedule`/`scheduleUpdate`, dst.) yang diizinkan untuk post
   * berstatus ini. `PublishingPost.authorId` adalah `null` HANYA untuk
   * status ini (post tidak punya "penulis" internal).
   */
  Imported = "imported",
}

/** 3 role (ADR-074) — "Owner" tampil sebagai "Account Owner" di UI/dokumen, value/enum key tidak berubah. */
export enum MemberRole {
  Owner = "owner",
  Admin = "admin",
  Creator = "creator",
}

/**
 * Role set "Owner atau Admin aktif" (ADR-074) — satu sumber kebenaran untuk
 * gate role yang butuh nilai identik di lebih dari satu bounded context yang
 * tidak boleh saling import (AGENTS.md #7): `WorkspaceService`
 * (`isOwnerOrAdminActive`, dipakai manage members/connected accounts/
 * settings) dan `domains/publishing/rbac.ts`
 * (`assertActorCanTriggerManualImportSync`). Code review PR #148 — kedua
 * sisi sebelumnya mendeklarasikan `Set` literal terpisah dengan komentar
 * "harus tetap identik" tanpa mekanisme yang benar-benar menegakkannya. Pure
 * value object (membership enum) — assertion/pesan error tetap
 * didefinisikan per-domain.
 */
export const OWNER_OR_ADMIN_ROLES: ReadonlySet<MemberRole> = new Set([
  MemberRole.Owner,
  MemberRole.Admin,
]);

export enum MemberStatus {
  Pending = "pending",
  Active = "active",
  Removed = "removed",
}

export enum InvitationStatus {
  Pending = "pending",
  Accepted = "accepted",
  Revoked = "revoked",
  Expired = "expired",
}

export enum SocialPlatform {
  Instagram = "instagram",
  Facebook = "facebook",
  Twitter = "twitter",
  LinkedIn = "linkedin",
  TikTok = "tiktok",
  YouTube = "youtube",
  Threads = "threads",
  Pinterest = "pinterest",
}

export enum WorkspacePlan {
  Free = "free",
  Pro = "pro",
}

/**
 * Format publikasi per target akun (PostTarget).
 * Selector UI menampilkan opsi yang diizinkan per SocialPlatform (lihat domain-model / ADR-039).
 */
export enum ContentFormat {
  Post = "post",
  Reel = "reel",
  Story = "story",
  Pin = "pin",
}

/**
 * Jenis item Engagement yang dapat di-ingest pada MVP (ADR-040).
 * Direct Message dan mention berada di luar scope MVP.
 */
export enum EngagementType {
  Comment = "comment",
}

/**
 * Subset dari daftar `NotificationType` di `domain-model.md` (BC-09) yang
 * sudah punya pengirim nyata di kode — ditambah incremental, bukan
 * enum tertutup. `ownership_transfer_requested`/`ownership_transfer_resolved`
 * dipakai `WorkspaceService.transferOwnership`/`acceptOwnershipTransfer`
 * (ADR-050, T-008.3).
 */
export enum NotificationType {
  OwnershipTransferRequested = "ownership_transfer_requested",
  OwnershipTransferResolved = "ownership_transfer_resolved",
  /** Webhook Outstand `post.error` (T-026.4/T-036.5) — semua target post gagal publish. */
  PostPublishFailed = "post_publish_failed",
  /** Webhook Outstand `account.token_expired` (T-026.5) — akun butuh reconnect. */
  AccountReconnectRequired = "account_reconnect_required",
  /**
   * JOB-03 Engagement Sync (`background-jobs.md` § JOB-03, T-051) — satu
   * notifikasi aggregate per sync run kalau ada komentar baru ditemukan
   * (bukan per-komentar). Nilai string persis sama dengan narasi resmi
   * `background-jobs.md` (`type: 'engagement_new'`).
   */
  EngagementNewComments = "engagement_new",
}

/**
 * Jenis `MediaItem` (BC-08, `domain-model.md` § BC-08 — Media). Disimpan
 * mentah sebagai `String` di kolom `media_items.type` (bukan Postgres enum
 * — konsisten pola `PublishingPost.status`/`ContentStatus`), dipetakan ke
 * union ini di boundary repository (`toRecord`).
 */
export enum MediaType {
  Image = "image",
  Video = "video",
  Gif = "gif",
}
