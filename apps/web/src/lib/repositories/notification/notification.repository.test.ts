import { asPageCursor, asUserId } from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidNotificationCursorError } from "@/domains/notification";

const tx = vi.hoisted(() => ({
  notification: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: (_userId: string, run: (client: typeof tx) => unknown) =>
    run(tx),
}));

import { notificationRepository } from "./notification.repository";

const USER = asUserId("user-1");
const ROW_ID = "0b6f1d6e-3c1a-4d2b-9f4e-1a2b3c4d5e6f";
const cursor = asPageCursor(
  Buffer.from(JSON.stringify({ v: 1, id: ROW_ID })).toString("base64url"),
);

describe("notificationRepository.listPage cursor (T-304)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tx.notification.findMany.mockResolvedValue([]);
  });

  it("rejects a cursor whose row no longer exists, so the panel shows Retry, not the end", async () => {
    tx.notification.findFirst.mockResolvedValue(null);
    await expect(
      notificationRepository.listPage(USER, { cursor, limit: 20 }),
    ).rejects.toBeInstanceOf(InvalidNotificationCursorError);
    expect(tx.notification.findFirst).toHaveBeenCalledWith({
      where: { id: ROW_ID, userId: USER },
      select: { id: true },
    });
    expect(tx.notification.findMany).not.toHaveBeenCalled();
  });

  it("reads the next page after a cursor row that still exists", async () => {
    tx.notification.findFirst.mockResolvedValue({ id: ROW_ID });
    const page = await notificationRepository.listPage(USER, {
      cursor,
      limit: 20,
    });
    expect(page).toEqual({ items: [], nextCursor: null });
    expect(tx.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: ROW_ID }, skip: 1 }),
    );
  });

  it("does not look up an anchor for the first page", async () => {
    await notificationRepository.listPage(USER, { cursor: null, limit: 20 });
    expect(tx.notification.findFirst).not.toHaveBeenCalled();
  });
});
