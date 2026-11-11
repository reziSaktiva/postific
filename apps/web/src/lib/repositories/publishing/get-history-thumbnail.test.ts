import { asPostId, asUserId, asWorkspaceId } from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();

vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: async (
    _userId: string,
    fn: (tx: unknown) => Promise<unknown>,
  ) => fn({ publishingPost: { findFirst } }),
}));
vi.mock("@/lib/prisma/client", () => ({ prisma: {} }));

import { publishingRepository } from "./publishing.repository";

const NOW = new Date("2026-11-01T00:00:00.000Z");

function postRow(thumbnailStoragePaths: Array<string | null>) {
  return {
    id: "p1",
    workspaceId: "w1",
    authorId: null,
    caption: "caption",
    status: "imported",
    source: "imported",
    scheduledAt: null,
    publishedAt: NOW,
    failedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    mediaIds: [],
    targets: thumbnailStoragePaths.map((thumbnailStoragePath, i) => ({
      id: `t${i}`,
      connectedAccountId: `a${i}`,
      platform: "instagram",
      contentFormat: "post",
      status: "published",
      platformPostUrl: null,
      error: null,
      platformOptions: { mediaUrls: ["https://cdn.example/x.jpg"] },
      thumbnailStoragePath,
      connectedAccount: { handle: `handle${i}` },
    })),
  };
}

beforeEach(() => findFirst.mockReset());

describe("publishingRepository.getHistoryById: thumbnail posting impor (T-232)", () => {
  it("memetakan thumbnailStoragePath tiap target ke item History", async () => {
    findFirst.mockResolvedValue(postRow([null, "w1/imports/t1.webp"]));

    const item = await publishingRepository.getHistoryById(
      { workspaceId: asWorkspaceId("w1"), postId: asPostId("p1") },
      asUserId("u1"),
    );

    expect(item?.targets.map((t) => t.thumbnailStoragePath)).toEqual([
      null,
      "w1/imports/t1.webp",
    ]);
  });
});
