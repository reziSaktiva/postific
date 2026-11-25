import {
  asNotificationId,
  asPageCursor,
  LIST_PAGE_SIZE,
  asUserId,
  asWorkspaceId,
  NotificationType,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { INotificationRepository } from "../repositories/notification.repository";
import type { NotificationRecord } from "../types";
import { NotificationService } from "./notification.service";

const USER_ID = asUserId("user-1");
const WORKSPACE_ID = asWorkspaceId("workspace-1");

function createFakeRepository(
  overrides: Partial<INotificationRepository> = {},
): INotificationRepository {
  return {
    create: async (input) => ({
      id: asNotificationId("notification-1"),
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      isRead: false,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      createdAt: new Date("2026-08-31T00:00:00Z"),
    }),
    listPage: async () => ({ items: [], nextCursor: null }),
    countUnread: async () => 0,
    markAsRead: async () => {},
    markAllAsRead: async () => {},
    ...overrides,
  };
}

describe("NotificationService", () => {
  it("notify() delegates to repository.create() and returns the created record", async () => {
    let captured: Parameters<INotificationRepository["create"]>[0] | null =
      null;
    const repository = createFakeRepository({
      create: async (input) => {
        captured = input;
        const record: NotificationRecord = {
          id: asNotificationId("notification-1"),
          workspaceId: input.workspaceId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          isRead: false,
          relatedEntityType: input.relatedEntityType ?? null,
          relatedEntityId: input.relatedEntityId ?? null,
          createdAt: new Date("2026-08-31T00:00:00Z"),
        };
        return record;
      },
    });
    const service = new NotificationService(repository);

    const result = await service.notify({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      type: NotificationType.OwnershipTransferRequested,
      title: "Permintaan Transfer Ownership",
      body: "Anda diminta menerima transfer kepemilikan workspace ini.",
      relatedEntityType: "member",
      relatedEntityId: "member-1",
    });

    expect(captured).toEqual({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      type: NotificationType.OwnershipTransferRequested,
      title: "Permintaan Transfer Ownership",
      body: "Anda diminta menerima transfer kepemilikan workspace ini.",
      relatedEntityType: "member",
      relatedEntityId: "member-1",
    });
    expect(result.isRead).toBe(false);
    expect(result.id).toBe(asNotificationId("notification-1"));
  });

  it("notify() works without optional relatedEntityType/relatedEntityId", async () => {
    const repository = createFakeRepository();
    const service = new NotificationService(repository);

    const result = await service.notify({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      type: NotificationType.OwnershipTransferResolved,
      title: "Transfer Ownership diterima",
      body: "Kepemilikan workspace telah berpindah.",
    });

    expect(result.relatedEntityType).toBeNull();
    expect(result.relatedEntityId).toBeNull();
  });

  it("listPage() asks the repository for one LIST_PAGE_SIZE page after the cursor and returns it as-is", async () => {
    const records: NotificationRecord[] = [
      {
        id: asNotificationId("notification-2"),
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        type: NotificationType.OwnershipTransferResolved,
        title: "Transfer Ownership diterima",
        body: "Kepemilikan workspace telah berpindah.",
        isRead: false,
        relatedEntityType: null,
        relatedEntityId: null,
        createdAt: new Date("2026-08-31T00:00:00Z"),
      },
      {
        id: asNotificationId("notification-1"),
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        type: NotificationType.OwnershipTransferRequested,
        title: "Permintaan Transfer Ownership",
        body: "Anda diminta menerima transfer kepemilikan workspace ini.",
        isRead: true,
        relatedEntityType: "member",
        relatedEntityId: "member-1",
        createdAt: new Date("2026-08-30T00:00:00Z"),
      },
    ];
    const page = { items: records, nextCursor: asPageCursor("next") };
    let capturedUserId: unknown = null;
    let capturedRequest: unknown = null;
    const repository = createFakeRepository({
      listPage: async (userId, request) => {
        capturedUserId = userId;
        capturedRequest = request;
        return page;
      },
    });
    const service = new NotificationService(repository);

    const result = await service.listPage(USER_ID, asPageCursor("cursor-1"));

    expect(capturedUserId).toBe(USER_ID);
    expect(capturedRequest).toEqual({
      cursor: "cursor-1",
      limit: LIST_PAGE_SIZE,
    });
    expect(result).toBe(page);

    await service.listPage(USER_ID);
    expect(capturedRequest).toEqual({ cursor: null, limit: LIST_PAGE_SIZE });
  });

  it("countUnread() delegates to repository.countUnread() and returns its result", async () => {
    let capturedUserId: unknown = null;
    const repository = createFakeRepository({
      countUnread: async (userId) => {
        capturedUserId = userId;
        return 60;
      },
    });
    const service = new NotificationService(repository);

    const result = await service.countUnread(USER_ID);

    expect(capturedUserId).toBe(USER_ID);
    expect(result).toBe(60);
  });

  it("markAsRead() delegates to repository.markAsRead() with the given id and userId", async () => {
    const NOTIFICATION_ID = asNotificationId("notification-1");
    let captured: { id: unknown; userId: unknown } | null = null;
    const repository = createFakeRepository({
      markAsRead: async (id, userId) => {
        captured = { id, userId };
      },
    });
    const service = new NotificationService(repository);

    await service.markAsRead(NOTIFICATION_ID, USER_ID);

    expect(captured).toEqual({ id: NOTIFICATION_ID, userId: USER_ID });
  });

  it("markAllAsRead() delegates to repository.markAllAsRead() with the given userId", async () => {
    let capturedUserId: unknown = null;
    const repository = createFakeRepository({
      markAllAsRead: async (userId) => {
        capturedUserId = userId;
      },
    });
    const service = new NotificationService(repository);

    await service.markAllAsRead(USER_ID);

    expect(capturedUserId).toBe(USER_ID);
  });
});
