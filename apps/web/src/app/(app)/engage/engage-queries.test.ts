import {
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

// Repository/adapter memuat Prisma client / env server di module scope:
// di-stub supaya tes tidak butuh DB/env sungguhan (pola `actions.test.ts`).
vi.mock("@/lib/repositories/workspace", () => ({ workspaceRepository: {} }));
vi.mock("@/lib/repositories/engagement", () => ({ engagementRepository: {} }));
vi.mock("@/lib/repositories/publishing", () => ({ publishingRepository: {} }));
vi.mock("@/lib/repositories/media", () => ({ mediaRepository: {} }));
vi.mock("@/lib/adapters/outstand", () => ({ getOutstandAdapter: () => ({}) }));
vi.mock("@/lib/adapters/media-storage/supabase-media-storage-adapter", () => ({
  supabaseMediaStorageAdapter: {},
}));

import { EngagementService } from "@/domains/engagement";
import { MediaService } from "@/domains/media";
import { loadCommentsPage, loadPostGroupsPage } from "./engage-queries";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");
const ACCOUNT = asConnectedAccountId("account-1");

function group(postId: string | null, mediaIds: string[]) {
  return {
    postId: postId ? asPostId(postId) : null,
    connectedAccountId: ACCOUNT,
    platform: SocialPlatform.Instagram,
    connectedAccountIds: [ACCOUNT],
    totalCount: 2,
    unrepliedCount: 1,
    handledCount: 1,
    repliedCount: 0,
    latestReceivedAt: new Date("2026-10-01T00:00:00Z"),
    oldestReceivedAt: new Date("2026-09-01T00:00:00Z"),
    statuses: ["unread" as const],
    postSnapshot: postId
      ? {
          caption: "Caption",
          mediaIds: mediaIds.map((id) => asMediaId(id)),
          platformPostUrl: null,
        }
      : null,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("loadPostGroupsPage (T-218, T-303)", () => {
  it("mengganti mediaIds dengan thumbnail ber-URL segar lewat satu pencarian media dan meneruskan cursor dan hitungan", async () => {
    const listPage = vi
      .spyOn(EngagementService.prototype, "listInboxPostGroupsPage")
      .mockResolvedValue({
        groups: [
          group("post-1", ["m1", "m2"]),
          group("post-2", []),
          group(null, []),
        ],
        nextCursor: "next" as never,
        counts: { postCount: 41, unrepliedCount: 7 },
      });
    const listByIds = vi
      .spyOn(MediaService.prototype, "listByIds")
      .mockResolvedValue([
        {
          id: asMediaId("m1"),
          url: "https://signed.example/m1",
          type: "image",
        },
      ] as never);
    vi.spyOn(MediaService.prototype, "signStoragePaths").mockResolvedValue(
      new Map(),
    );

    const page = await loadPostGroupsPage(
      { sort: "newest", cursor: "abc", withCounts: true },
      WORKSPACE_ID,
      USER_ID,
    );

    expect(listPage.mock.calls[0][0]).toMatchObject({
      workspaceId: WORKSPACE_ID,
      sort: "newest",
      cursor: "abc",
      withCounts: true,
    });
    expect(page.nextCursor).toBe("next");
    expect(page.counts).toEqual({ postCount: 41, unrepliedCount: 7 });
    expect(listByIds).toHaveBeenCalledTimes(1);
    expect(listByIds.mock.calls[0][0].mediaIds).toEqual(["m1"]);
    expect(page.groups[0].postSnapshot).toEqual({
      caption: "Caption",
      platformPostUrl: null,
      thumbnail: { url: "https://signed.example/m1", type: "image" },
    });
    expect(page.groups[1].postSnapshot?.thumbnail).toBeNull();
    expect(page.groups[2].postSnapshot).toBeNull();
    expect(page.groups[0]).not.toHaveProperty("postSnapshot.mediaIds");
  });

  it("tetap mengembalikan daftar tanpa thumbnail bila resolve media gagal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(
      EngagementService.prototype,
      "listInboxPostGroupsPage",
    ).mockResolvedValue({
      groups: [group("post-1", ["m1"])],
      nextCursor: null,
      counts: null,
    });
    vi.spyOn(MediaService.prototype, "listByIds").mockRejectedValue(
      new Error("storage down"),
    );
    vi.spyOn(MediaService.prototype, "signStoragePaths").mockResolvedValue(
      new Map(),
    );

    const page = await loadPostGroupsPage({}, WORKSPACE_ID, USER_ID);

    expect(page.groups[0].postSnapshot?.thumbnail).toBeNull();
  });
});

describe("loadCommentsPage (T-219, T-303)", () => {
  it("memetakan postId, null (Tanpa posting), dan tanpa postId ke input service", async () => {
    const listPage = vi
      .spyOn(EngagementService.prototype, "listInboxPage")
      .mockResolvedValue({
        items: [],
        nextCursor: null,
        counts: null,
        postCaptions: {},
      });

    await loadCommentsPage(
      { postId: "post-1", dateRange: "30d" },
      WORKSPACE_ID,
      USER_ID,
    );
    expect(listPage.mock.calls[0][0]).toMatchObject({
      postId: "post-1",
      dateRange: "30d",
    });

    await loadCommentsPage({ postId: null }, WORKSPACE_ID, USER_ID);
    expect(listPage.mock.calls[1][0].postId).toBeNull();

    await loadCommentsPage({}, WORKSPACE_ID, USER_ID);
    expect(listPage.mock.calls[2][0]).not.toHaveProperty("postId");
    expect(listPage.mock.calls[2][0]).not.toHaveProperty("cursor");
  });
});
