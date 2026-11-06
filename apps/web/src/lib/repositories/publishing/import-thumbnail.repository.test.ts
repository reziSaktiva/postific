import {
  asUserId,
  asWorkspaceId,
  asConnectedAccountId,
  ContentStatus,
} from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: async (
    _userId: string,
    fn: (tx: unknown) => Promise<unknown>,
  ) =>
    fn({
      publishingPostTarget: { findMany, findFirst, updateMany },
    }),
}));
vi.mock("@/lib/prisma/client", () => ({ prisma: {} }));

import { publishingRepository } from "./publishing.repository";

const workspaceId = asWorkspaceId("w1");
const userId = asUserId("u1");
const connectedAccountId = asConnectedAccountId("a1");

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
  updateMany.mockReset();
});

describe("publishingRepository thumbnail posting impor (T-230)", () => {
  it("listImportedTargetIdsNeedingThumbnail: hanya posting imported yang belum punya dan belum dicoba, terbaru dulu", async () => {
    findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);

    const ids =
      await publishingRepository.listImportedTargetIdsNeedingThumbnail(
        { workspaceId, connectedAccountId, limit: 50 },
        userId,
      );

    expect(ids).toEqual(["t1", "t2"]);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      connectedAccountId,
      thumbnailStoragePath: null,
      thumbnailAttemptedAt: null,
      platformOptions: { path: ["mediaUrls", "0"], string_starts_with: "http" },
      post: { workspaceId, deletedAt: null, status: ContentStatus.Imported },
    });
    expect(args.orderBy).toEqual({ post: { publishedAt: "desc" } });
    expect(args.take).toBe(50);
  });

  it("findImportedTargetsNeedingThumbnail: mengembalikan URL pertama dan membuang target tanpa URL valid", async () => {
    findMany.mockResolvedValue([
      {
        id: "t1",
        platformOptions: { mediaUrls: ["https://x.fbcdn.net/a.jpg"] },
      },
      { id: "t2", platformOptions: { mediaUrls: [] } },
      { id: "t3", platformOptions: { mediaUrls: ["javascript:alert(1)"] } },
      { id: "t4", platformOptions: null },
    ]);

    const result =
      await publishingRepository.findImportedTargetsNeedingThumbnail(
        { workspaceId, targetIds: ["t1", "t2", "t3", "t4"] },
        userId,
      );

    expect(result).toEqual([
      { targetId: "t1", sourceUrl: "https://x.fbcdn.net/a.jpg" },
    ]);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      id: { in: ["t1", "t2", "t3", "t4"] },
      thumbnailStoragePath: null,
      thumbnailAttemptedAt: null,
    });
  });

  it("saveImportedTargetThumbnail: hasil sukses menyimpan path dan jenis, selalu mengisi waktu percobaan", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await publishingRepository.saveImportedTargetThumbnail(
      {
        workspaceId,
        targetId: "t1",
        thumbnail: { storagePath: "w1/imports/t1.webp", kind: "video_poster" },
      },
      userId,
    );

    const { where, data } = updateMany.mock.calls[0][0];
    expect(where).toMatchObject({
      id: "t1",
      post: { workspaceId, status: ContentStatus.Imported },
    });
    expect(where).not.toHaveProperty("thumbnailStoragePath");
    expect(data.thumbnailStoragePath).toBe("w1/imports/t1.webp");
    expect(data.thumbnailKind).toBe("video_poster");
    expect(data.thumbnailAttemptedAt).toBeInstanceOf(Date);
  });

  it("saveImportedTargetThumbnail: gagal menandai sudah dicoba tanpa path", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await publishingRepository.saveImportedTargetThumbnail(
      { workspaceId, targetId: "t1", thumbnail: null },
      userId,
    );

    const { where, data } = updateMany.mock.calls[0][0];
    // Tidak boleh menimpa thumbnail yang sudah tersimpan oleh job duplikat.
    expect(where.thumbnailStoragePath).toBeNull();
    expect(data.thumbnailStoragePath).toBeNull();
    expect(data.thumbnailKind).toBeNull();
    expect(data.thumbnailAttemptedAt).toBeInstanceOf(Date);
  });

  it("findPostSnapshotForEngagement: membawa thumbnail tersimpan dan menormalkan jenis tak dikenal", async () => {
    findFirst.mockResolvedValue({
      platformPostUrl: "https://ig/p/1",
      platformOptions: null,
      thumbnailStoragePath: "w1/imports/t1.webp",
      thumbnailKind: "video_poster",
      post: { caption: "c", mediaIds: [] },
    });
    const ok = await publishingRepository.findPostSnapshotForEngagement(
      { workspaceId, postId: "p1" as never, connectedAccountId },
      userId,
    );
    expect(ok).toMatchObject({
      thumbnailStoragePath: "w1/imports/t1.webp",
      thumbnailKind: "video_poster",
      externalMediaUrl: null,
    });

    findFirst.mockResolvedValue({
      platformPostUrl: null,
      platformOptions: null,
      thumbnailStoragePath: null,
      thumbnailKind: "aneh",
      post: { caption: "c", mediaIds: [] },
    });
    const odd = await publishingRepository.findPostSnapshotForEngagement(
      { workspaceId, postId: "p1" as never, connectedAccountId },
      userId,
    );
    expect(odd?.thumbnailKind).toBeNull();
  });
});
