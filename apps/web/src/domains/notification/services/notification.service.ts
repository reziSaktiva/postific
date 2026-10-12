import type {
  NotificationId,
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

  /** Daftar notifikasi milik `userId` untuk bell (T-036.4) — delegasi tipis ke repository. */
  async list(userId: UserId): Promise<NotificationRecord[]> {
    return this.repository.list(userId);
  }

  /** Total notifikasi belum dibaca milik `userId` (tidak dibatasi 50 seperti `list`) — delegasi tipis ke repository. */
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
