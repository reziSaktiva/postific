import type {
  CursorPage,
  CursorPageRequest,
  NotificationId,
  NotificationType,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type { NotificationRecord } from "../types";

/** Repository interface — implementation (Prisma) lives in src/lib/repositories/notification. */
export interface INotificationRepository {
  /**
   * Buat satu notifikasi baru (BC-09, `NotificationService.notify` di
   * `application-layer.md`). `relatedEntityType`/`relatedEntityId` opsional
   * — dipakai untuk deep-link ke entitas terkait (mis. member, post).
   */
  create(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    type: NotificationType;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<NotificationRecord>;

  /**
   * Satu halaman notifikasi milik `userId` (S-009, ADR-166, T-304), urut
   * `createdAt` descending lalu `id` descending sebagai pemecah seri (dua
   * notifikasi dengan waktu sama tidak hilang/dobel di batas halaman).
   * Menggantikan batas 50 baris lama. `request.cursor` kosong berarti
   * halaman pertama; cursor yang rusak melempar
   * `InvalidNotificationCursorError`. TIDAK difilter per `workspaceId` —
   * Realtime subscription (T-036.2) juga hanya filter per `user_id`
   * (RT-D03), jadi bell menampilkan notifikasi user lintas workspace.
   */
  listPage(
    userId: UserId,
    request: CursorPageRequest,
  ): Promise<CursorPage<NotificationRecord>>;

  /**
   * Hitung TOTAL notifikasi belum dibaca milik `userId` (query `count`
   * terpisah dari halaman yang dimuat) — dipakai untuk badge unread
   * di bell supaya tidak under-count begitu user punya >50 notifikasi.
   */
  countUnread(userId: UserId): Promise<number>;

  /**
   * Tandai satu notifikasi sudah dibaca. Scoped ke `id` DAN `userId`
   * sekaligus (defense-in-depth, bukan cuma andalkan RLS) — idempoten kalau
   * dipanggil dua kali pada notifikasi yang sudah `isRead`.
   */
  markAsRead(id: NotificationId, userId: UserId): Promise<void>;

  /** Tandai seluruh notifikasi milik `userId` yang belum dibaca sebagai sudah dibaca. */
  markAllAsRead(userId: UserId): Promise<void>;
}
