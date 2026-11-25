import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidPageCursorError } from "@/domains/publishing";

const composition = vi.hoisted(() => ({
  getPublishRequestContext: vi.fn(),
  loadPublishListPage: vi.fn(),
  countPublishListTab: vi.fn(),
}));

vi.mock(
  "../../../(app)/publish/components/views/publish-list-pages",
  () => composition,
);

import { GET } from "./route";

const context = { workspaceId: "ws-1", userId: "user-1" };
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
});
