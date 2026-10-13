import { asNotificationId, asUserId, asWorkspaceId } from "@postific/shared";
import type { NotificationType } from "@postific/shared";
import type {
  INotificationRepository,
  NotificationRecord,
} from "@/domains/notification";
import type { Notification } from "@/generated/prisma/client";
import { withCurrentUser } from "@/lib/prisma/with-current-user";

function toRecord(notification: Notification): NotificationRecord {
  return {
    id: asNotificationId(notification.id),
    workspaceId: asWorkspaceId(notification.workspaceId),
    userId: asUserId(notification.userId),
    type: notification.type as NotificationType,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    createdAt: notification.createdAt,
  };
}

export const notificationRepository: INotificationRepository = {
  /**
   * `withCurrentUser(userId, ...)` di sini pakai `userId` **penerima**
   * notifikasi (bukan actor yang memicu aksi) — RLS policy
   * `notifications_workspace_isolation` (migration
   * `20260813045625_t017_add_rls_policies`) mengharuskan
   * `app.current_user_id` cocok dengan member aktif `workspaceId` target,
   * dan penerima notifikasi selalu member aktif workspace itu (caller,
   * mis. `WorkspaceService.transferOwnership`, sudah memvalidasi ini
   * sebelum memanggil `notify`).
   */
  async create({
    workspaceId,
    userId,
    type,
    title,
    body,
    relatedEntityType,
    relatedEntityId,
  }) {
    const notification = await withCurrentUser(userId, (tx) =>
      tx.notification.create({
        data: {
          workspaceId,
          userId,
          type,
          title,
          body,
          relatedEntityType,
          relatedEntityId,
        },
      }),
    );

    return toRecord(notification);
  },

  /**
   * Sama seperti `create` — `withCurrentUser(userId, ...)` memakai `userId`
   * si penerima notifikasi (subjek yang meminta daftarnya sendiri), yang
   * RLS `notifications_workspace_isolation` cocokkan lewat keanggotaan
   * workspace aktifnya. Tidak difilter `workspaceId` (lihat komentar
   * `list` di domain repository interface).
   */
  async list(userId) {
    const notifications = await withCurrentUser(userId, (tx) =>
      tx.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );

    return notifications.map(toRecord);
  },

  /** `count` terpisah dari `list` (tanpa `take`) supaya badge unread akurat di atas 50 baris. */
  async countUnread(userId) {
    return withCurrentUser(userId, (tx) =>
      tx.notification.count({
        where: { userId, isRead: false },
      }),
    );
  },

  /**
   * `updateMany` (bukan `update`) supaya WHERE mencakup `id` DAN `userId`
   * sekaligus (defense-in-depth) tanpa melempar error kalau baris tidak
   * cocok (mis. `id` milik user lain, atau sudah tidak ada) — idempoten
   * per kontrak interface.
   */
  async markAsRead(id, userId) {
    await withCurrentUser(userId, (tx) =>
      tx.notification.updateMany({
        where: { id, userId },
        data: { isRead: true, readAt: new Date() },
      }),
    );
  },

  async markAllAsRead(userId) {
    await withCurrentUser(userId, (tx) =>
      tx.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      }),
    );
  },
};
