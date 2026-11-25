import {
  asNotificationId,
  asPageCursor,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import type { NotificationType, PageCursor } from "@postific/shared";
import {
  InvalidNotificationCursorError,
  type INotificationRepository,
  type NotificationRecord,
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

const CURSOR_VERSION = 1;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(id: string): PageCursor {
  return asPageCursor(
    Buffer.from(JSON.stringify({ v: CURSOR_VERSION, id })).toString(
      "base64url",
    ),
  );
}

/** The cursor comes from the browser: anything but our own shape is rejected. */
function decodeCursor(cursor: PageCursor): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new InvalidNotificationCursorError();
  }
  const { v, id } = (parsed ?? {}) as { v?: unknown; id?: unknown };
  if (
    v !== CURSOR_VERSION ||
    typeof id !== "string" ||
    !UUID_PATTERN.test(id)
  ) {
    throw new InvalidNotificationCursorError();
  }
  return id;
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
   * Cursor query (T-304): order `createdAt DESC, id DESC`, one extra row
   * tells whether another page exists. The cursor holds only the last row's
   * id and Prisma's native `cursor` compares `(created_at, id)` inside the
   * database, so Postgres' microsecond timestamps are never rounded to
   * milliseconds through a JS `Date` (that would skip or repeat rows that
   * share a time). Backed by index `(user_id, created_at DESC, id DESC)`.
   * `withCurrentUser` uses the recipient's `userId` like `create`; not
   * filtered by `workspaceId` (see the domain interface).
   */
  async listPage(userId, { cursor, limit }) {
    const cursorId = cursor ? decodeCursor(cursor) : null;
    const rows = await withCurrentUser(userId, async (tx) => {
      if (cursorId) {
        // A cursor row that no longer exists (deleted, or another user's)
        // would make Prisma return an empty page, which the panel reads as
        // "reached the oldest notification". Reject it so the panel shows
        // Retry instead (S-009 review 2026-11-25).
        const anchor = await tx.notification.findFirst({
          where: { id: cursorId, userId },
          select: { id: true },
        });
        if (!anchor) throw new InvalidNotificationCursorError();
      }
      return tx.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toRecord);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.id) : null,
    };
  },

  /** Separate `count` (no `take`) so the unread badge covers every notification, not the loaded pages. */
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
