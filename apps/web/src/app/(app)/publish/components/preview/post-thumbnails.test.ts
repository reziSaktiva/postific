import { MediaType, asUserId, asWorkspaceId } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";

import { resolvePostThumbnails } from "./post-thumbnails";

const workspaceId = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const userId = asUserId("22222222-2222-4222-8222-222222222222");

type Sign = (
  workspaceId: unknown,
  paths: string[],
) => Promise<Map<string, string>>;

function mediaService(
  items: { id: string; url: string | null; type: MediaType }[],
  sign?: Sign,
) {
  return {
    listByIds: vi.fn(async () => items as never),
    signStoragePaths: vi.fn<Sign>(
      sign ??
        (async (_w, paths) =>
          new Map(paths.map((p) => [p, `https://signed/${p}`]))),
    ),
  };
}

describe("resolvePostThumbnails", () => {
  it("returns the first media of a post, with its type so a video can show the play mark", async () => {
    const service = mediaService([
      { id: "m1", url: "https://signed/m1", type: MediaType.Video },
      { id: "m2", url: "https://signed/m2", type: MediaType.Image },
    ]);

    const result = await resolvePostThumbnails(
      [
        { id: "p1", mediaIds: ["m1", "m2"], targets: [] },
        { id: "p2", mediaIds: ["m2"], targets: [] },
      ],
      workspaceId,
      userId,
      service as never,
    );

    expect(result).toEqual({
      p1: { url: "https://signed/m1", type: MediaType.Video },
      p2: { url: "https://signed/m2", type: MediaType.Image },
    });
  });

  it("looks the media up once for the whole list", async () => {
    const service = mediaService([
      { id: "m1", url: "https://signed/m1", type: MediaType.Image },
    ]);

    await resolvePostThumbnails(
      [
        { id: "p1", mediaIds: ["m1"], targets: [] },
        { id: "p2", mediaIds: ["m1"], targets: [] },
      ],
      workspaceId,
      userId,
      service as never,
    );

    expect(service.listByIds).toHaveBeenCalledTimes(1);
  });

  it("uses the stored thumbnail of an imported post as an image", async () => {
    const path = `${workspaceId}/imports/t1.webp`;
    const service = mediaService([]);

    const result = await resolvePostThumbnails(
      [
        {
          id: "p1",
          mediaIds: [],
          targets: [
            { thumbnailStoragePath: null },
            { thumbnailStoragePath: path },
          ],
        },
      ],
      workspaceId,
      userId,
      service as never,
    );

    expect(result).toEqual({
      p1: { url: `https://signed/${path}`, type: MediaType.Image },
    });
    expect(service.listByIds).not.toHaveBeenCalled();
  });

  it("leaves out a post with no media and no stored thumbnail", async () => {
    const result = await resolvePostThumbnails(
      [{ id: "p1", mediaIds: [], targets: [{ thumbnailStoragePath: null }] }],
      workspaceId,
      userId,
      mediaService([]) as never,
    );

    expect(result).toEqual({});
  });

  it("does not throw when the lookups fail, the chips show no thumbnail", async () => {
    const service = {
      listByIds: vi.fn(async () => {
        throw new Error("db down");
      }),
      signStoragePaths: vi.fn<Sign>(async () => {
        throw new Error("storage down");
      }),
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await resolvePostThumbnails(
      [
        { id: "p1", mediaIds: ["m1"], targets: [] },
        { id: "p2", mediaIds: [], targets: [{ thumbnailStoragePath: "x" }] },
      ],
      workspaceId,
      userId,
      service as never,
    );

    expect(result).toEqual({});
  });
});
