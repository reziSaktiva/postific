import { beforeEach, describe, expect, it, vi } from "vitest";

import { asPageCursor, asWorkspaceId } from "@postific/shared";

import { InvalidPageCursorError } from "@/domains/publishing";
import { publishTabSelection } from "@/domains/publishing/services/publish-list-page-query";
import { encodePostPageCursor } from "@/lib/repositories/publishing/post-page";

const composition = vi.hoisted(() => ({
  getPublishRequestContext: vi.fn(),
  loadPublishListPage: vi.fn(),
  countPublishListTab: vi.fn(),
}));

vi.mock(
  "../../../(app)/publish/components/views/publish-list-pages",
  () => composition,
);

// The real composition below must reject the cursor before any query: a
// database call fails the test.
vi.mock("@/lib/prisma/client", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        throw new Error("the cursor reached the database");
      },
    },
  ),
}));
vi.mock("@/lib/better-auth/session", () => ({ getCachedSession: vi.fn() }));

import { GET } from "./route";

const context = {
  workspaceId: "5e1f0a3c-2b4d-4c6e-8f10-1a2b3c4d5e6f",
  userId: "user-1",
};
const get = (search: string) =>
  GET(new Request(`http://localhost/api/publish/list${search}`));

describe("GET /api/publish/list (T-302)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    composition.getPublishRequestContext.mockResolvedValue(context);
  });

  it("answers 401 without a session, never a redirect", async () => {
    composition.getPublishRequestContext.mockResolvedValue(null);
    const response = await get("?tab=history");
    expect(response.status).toBe(401);
    expect(composition.loadPublishListPage).not.toHaveBeenCalled();
  });

  it("loads the page for the parsed tab, filter and cursor", async () => {
    composition.loadPublishListPage.mockResolvedValue({
      items: [],
      nextCursor: null,
      thumbnails: {},
    });
    const response = await get("?tab=history&source=mcp&cursor=abc");
    expect(response.status).toBe(200);
    expect(composition.loadPublishListPage).toHaveBeenCalledWith(context, {
      tab: "history",
      filter: { channelIds: [], source: "mcp", statuses: [] },
      cursor: "abc",
      countOnly: false,
    });
  });

  it("answers the count only when asked", async () => {
    composition.countPublishListTab.mockResolvedValue(503);
    const response = await get("?tab=history&count=1");
    expect(await response.json()).toEqual({ total: 503 });
    expect(composition.loadPublishListPage).not.toHaveBeenCalled();
  });

  it("answers 400 for a bad query or an invalid cursor", async () => {
    expect((await get("?tab=nope")).status).toBe(400);
    composition.loadPublishListPage.mockRejectedValue(
      new InvalidPageCursorError(),
    );
    const response = await get("?tab=queue&cursor=broken");
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
  });

  describe("cursor through the real page composition", () => {
    beforeEach(async () => {
      // The real composition: the repository reads the cursor before any
      // query, so a rejected cursor never reaches the database.
      const actual = await vi.importActual<typeof composition>(
        "../../../(app)/publish/components/views/publish-list-pages",
      );
      composition.loadPublishListPage.mockImplementation(
        actual.loadPublishListPage,
      );
    });

    it("answers 400 for a malformed cursor", async () => {
      const response = await get(
        `?tab=drafts&cursor=${asPageCursor("not-a-cursor%%")}`,
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty("error");
    });

    it("answers 400 for a Drafts cursor sent with the Approvals tab", async () => {
      const drafts = publishTabSelection("drafts", {
        channelIds: [],
        source: "all",
        statuses: [],
      });
      if (!drafts) throw new Error("drafts tab has no selection");
      const cursor = encodePostPageCursor(
        { workspaceId: asWorkspaceId(context.workspaceId), ...drafts },
        {
          id: "0b6f1d6e-3c1a-4d2b-9f4e-1a2b3c4d5e6f",
          updated: "2026-11-25 10:00:00.123456+00",
          scheduled: null,
          occurred: "2026-11-25 10:00:00+00",
        },
      );
      const response = await get(`?tab=approvals&cursor=${cursor}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty("error");
    });
  });
});
