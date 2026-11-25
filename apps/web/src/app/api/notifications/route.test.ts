import { asNotificationId, asPageCursor, asUserId } from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedSession = vi.fn();
const listPage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/better-auth/session", () => ({
  getCachedSession: () => getCachedSession(),
}));
vi.mock("@/lib/repositories/notification", () => ({
  notificationRepository: { listPage },
}));

import { GET } from "./route";

const call = (query = "") =>
  GET(new Request(`http://localhost/api/notifications${query}`));

describe("GET /api/notifications", () => {
  beforeEach(() => {
    getCachedSession.mockReset();
    listPage.mockReset();
  });

  it("answers 401 (no redirect) without a session", async () => {
    getCachedSession.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(listPage).not.toHaveBeenCalled();
  });

  it("returns the page after the cursor for the signed-in user", async () => {
    getCachedSession.mockResolvedValue({ user: { id: "user-1" } });
    listPage.mockResolvedValue({
      items: [{ id: asNotificationId("n-1") }],
      nextCursor: asPageCursor("next"),
    });
    const response = await call("?cursor=abc");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: "n-1" }],
      nextCursor: "next",
    });
    expect(listPage).toHaveBeenCalledWith(asUserId("user-1"), {
      cursor: "abc",
      limit: 20,
    });
  });

  it("answers 400 for an invalid cursor", async () => {
    getCachedSession.mockResolvedValue({ user: { id: "user-1" } });
    const { InvalidNotificationCursorError } =
      await import("@/domains/notification");
    listPage.mockRejectedValue(new InvalidNotificationCursorError());
    const response = await call("?cursor=bad");
    expect(response.status).toBe(400);
  });
});
