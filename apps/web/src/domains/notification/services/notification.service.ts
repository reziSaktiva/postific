import { LIST_PAGE_SIZE } from "@postific/shared";
import type {
  CursorPage,
  NotificationId,
  PageCursor,
  NotificationType,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type { INotificationRepository } from "../repositories/notification.repository";
import type { NotificationRecord } from "../types";

/**
 * `NotificationService` (application-layer.md) — supporting domain BC-09.
 * `notify` adalah satu-satunya method yang dipakai domain lain lewat port
 * lokal (pola sama seperti `ScheduledCountsPort` di `WorkspaceService`) —
 * domain lain TIDAK boleh import `NotificationService` konkret secara
 * langsung (AGENTS.md #7), composition root (Server Action) yang menyuplai
 * instance ini ke service pemanggil lewat constructor.
 */
export class NotificationService {
  constructor(private readonly repository: INotificationRepository) {}

  async notify(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    type: NotificationType;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<NotificationRecord> {
    return this.repository.create(input);
  }

  /**
   * One page (`LIST_PAGE_SIZE`) of `userId`'s notifications for the bell
   * (T-304); `cursor` is the `nextCursor` of the previous page, or empty for
   * the first page. Thin delegation to the repository.
   */
  async listPage(
    userId: UserId,
    cursor?: PageCursor | null,
  ): Promise<CursorPage<NotificationRecord>> {
    return this.repository.listPage(userId, {
      cursor: cursor ?? null,
      limit: LIST_PAGE_SIZE,
    });
  }

  /** Total notifikasi belum dibaca milik `userId` (not limited to the loaded pages) — delegasi tipis ke repository. */
  async countUnread(userId: UserId): Promise<number> {
    return this.repository.countUnread(userId);
  }

  /** Tandai satu notifikasi sudah dibaca — delegasi tipis ke repository. */
  async markAsRead(id: NotificationId, userId: UserId): Promise<void> {
    return this.repository.markAsRead(id, userId);
  }

  /** Tandai seluruh notifikasi milik `userId` sebagai sudah dibaca — delegasi tipis ke repository. */
  async markAllAsRead(userId: UserId): Promise<void> {
    return this.repository.markAllAsRead(userId);
  }
}
