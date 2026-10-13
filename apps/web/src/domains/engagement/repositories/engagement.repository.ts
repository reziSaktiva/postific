import type {
  ConnectedAccountId,
  InboxItemId,
  PostId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type {
  EngagementInboxItemRecord,
  EngagementReplyRecord,
  InboxItemFilter,
  InboxItemStatus,
} from "../types";

/** Repository interface — implementation (Prisma) lives in src/lib/repositories/engagement. */
export interface IEngagementRepository {
  /**
   * Inbox (T-053 nanti mengonsumsi lewat `EngagementService.listInbox`) —
   * seluruh `EngagementInboxItem` milik workspace, difilter opsional per
   * akun/platform/status, diurutkan `receivedAt` descending (komentar
   * terbaru duluan). `userId` (RLS, pola sama `publishing`/`workspace`) —
   * acting user untuk `withCurrentUser`.
   */
  listInboxItems(
    filter: InboxItemFilter,
    userId: UserId,
  ): Promise<EngagementInboxItemRecord[]>;

  /**
   * Detail satu inbox item — dipakai `EngagementService.getInboxItemDetail`
   * (T-050) dan nanti route detail (T-053). Returns `null` kalau tidak
   * ditemukan atau bukan milik `workspaceId` ini. `userId` (RLS) — acting
   * user untuk `withCurrentUser`.
   */
  findInboxItemById(
    input: { workspaceId: WorkspaceId; inboxItemId: InboxItemId },
    userId: UserId,
  ): Promise<EngagementInboxItemRecord | null>;

  /**
   * Upsert by unique `[workspaceId, connectedAccountId, externalId]`
   * (`schema.prisma` unique constraint `EngagementInboxItem`) — KUNCI
   * idempotency untuk sync job periodik (T-051, ADR-022/ADR-040: pull
   * ulang komentar dari Outstand tidak boleh menggandakan baris).
   *
   * **T-051** — sekarang dipanggil `SyncCommentsUseCase.sync` per komentar
   * hasil `IOutstandAdapter.fetchComments`. `isNew` dibutuhkan caller untuk
   * menghitung `newCommentsCount` (dipakai memutuskan apakah notifikasi
   * aggregate JOB-03 langkah 4 perlu dikirim) — dibedakan di implementasi
   * Prisma lewat `findUnique` SEBELUM `upsert`, dalam transaksi yang sama,
   * supaya atomik (bukan diasumsikan dari `createdAt === updatedAt`, yang
   * rapuh terhadap clock skew/rounding).
   *
   * `userId` (RLS) — acting user untuk `withCurrentUser`. Untuk job
   * background (T-051), `userId` yang dipakai adalah keputusan implementasi
   * composition root job route (`/api/jobs/run/route.ts`) — lihat catatan
   * `EngagementSyncJobHandler` untuk `userId` mana yang disuplai.
   *
   * **`postId` (redesain KI-068/ADR-113)** — uuid internal `PublishingPost`
   * yang cocok dengan `outstandPostId` komentar ini (di-resolve `caller`,
   * `SyncCommentsUseCase`, lewat join balik ke domain `publishing` — lihat
   * catatan di use-case itu). Opsional supaya caller lain (mis. test lama)
   * tidak wajib ikut mengisinya, TAPI `SyncCommentsUseCase` SELALU
   * mengisinya sekarang (kolom `EngagementInboxItem.postId` yang sebelumnya
   * ada di schema tapi tidak pernah ditulis — root cause KI-068 poin ini).
   * `create`-only (sama seperti `authorHandle`/`content` di `update`) — post
   * yang sudah terhubung tidak akan berubah lagi.
   */
  upsertInboxItem(
    input: {
      workspaceId: WorkspaceId;
      connectedAccountId: ConnectedAccountId;
      platform: SocialPlatform;
      type: string;
      externalId: string;
      authorHandle: string;
      content: string;
      receivedAt: Date;
      postId?: PostId;
    },
    userId: UserId,
  ): Promise<{ item: EngagementInboxItemRecord; isNew: boolean }>;

  /**
   * Ubah status satu inbox item (mis. "unread" -> "done", dipakai
   * `EngagementService.markAsDone`). `readAt` di-set otomatis oleh
   * implementasi Prisma saat status berubah jadi `"done"` (pola sama
   * `readAt` kolom — belum pernah dibaca sebelumnya). Returns `null` kalau
   * tidak ditemukan/bukan milik `workspaceId` ini. `userId` (RLS) — acting
   * user untuk `withCurrentUser`.
   */
  markInboxItemStatus(
    input: {
      workspaceId: WorkspaceId;
      inboxItemId: InboxItemId;
      status: InboxItemStatus;
    },
    userId: UserId,
  ): Promise<EngagementInboxItemRecord | null>;

  /**
   * Persist balasan ke `EngagementReply` — disiapkan di T-050, dipakai
   * use-case reply (T-054: `EngagementService.reply` memanggil
   * `IOutstandAdapter.replyToComment` LEBIH DULU, baru memanggil method ini
   * dengan `outstandReplyId` hasilnya). `userId` (RLS) — acting user untuk
   * `withCurrentUser`; juga dipersist sebagai `EngagementReply.userId`
   * (siapa yang membalas).
   *
   * **`outstandReplyId` (T-054)** — wajib diisi dari
   * `ReplyToCommentResult.outstandReplyId`, dipersist ke kolom
   * `EngagementReply.outstandReplyId` yang sudah ada sejak schema T-050.
   * Implementasi Prisma (`apps/web/src/lib/repositories/engagement`) juga
   * men-set `status: "sent"` saat membuat baris ini — method ini HANYA
   * dipanggil setelah `replyToComment` sukses (lihat `EngagementService.reply`),
   * jadi tidak ada jalur di mana baris `EngagementReply` dibuat tanpa balasan
   * benar-benar terkirim; nilai default schema `"pending"` tidak pernah
   * relevan untuk method ini.
   */
  createReply(
    input: {
      inboxItemId: InboxItemId;
      userId: UserId;
      content: string;
      outstandReplyId: string;
    },
    userId: UserId,
  ): Promise<EngagementReplyRecord>;

  /**
   * Seluruh balasan untuk satu inbox item — dipakai
   * `EngagementService.getInboxItemDetail` (T-050) untuk menyertakan
   * `replies` di detail. `userId` (RLS) — acting user untuk
   * `withCurrentUser`.
   */
  listRepliesByInboxItemId(
    inboxItemId: InboxItemId,
    userId: UserId,
  ): Promise<EngagementReplyRecord[]>;
}
