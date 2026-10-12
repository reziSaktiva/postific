import { asMediaId, asUserId, asWorkspaceId } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/utils/errors";

import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import { resolveOutstandPostMedia } from "./resolve-outstand-post-media";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");

describe("resolveOutstandPostMedia", () => {
  it("returns undefined when mediaIds empty", async () => {
    const result = await resolveOutstandPostMedia({
      workspaceId: WORKSPACE_ID,
      mediaIds: [],
      actingUserId: USER_ID,
      outstandAdapter: {} as IOutstandAdapter,
      mediaLookup: undefined,
    });
    expect(result).toBeUndefined();
  });

  it("reuses valid outstandMediaUrl without re-upload", async () => {
    const upload = vi.fn();
    const result = await resolveOutstandPostMedia({
      workspaceId: WORKSPACE_ID,
      mediaIds: [asMediaId("media-1")],
      actingUserId: USER_ID,
      outstandAdapter: {
        uploadMediaWorkingCopy: upload,
      } as unknown as IOutstandAdapter,
      mediaLookup: {
        listByIds: async () => [
          {
            id: asMediaId("media-1"),
            filename: "photo.jpg",
            mimeType: "image/jpeg",
            storagePath: "ws/photo.jpg",
            url: null,
            outstandMediaUrl: "https://outstand.example/media/photo.jpg",
            outstandExpiresAt: new Date(Date.now() + 60_000),
          },
        ],
        downloadBytes: async () => Buffer.from("x"),
        saveOutstandWorkingCopy: async () => undefined,
      },
    });

    expect(result).toEqual([
      {
        url: "https://outstand.example/media/photo.jpg",
        filename: "photo.jpg",
      },
    ]);
    expect(upload).not.toHaveBeenCalled();
  });

  it("downloads + uploadMediaWorkingCopy when outstand URL missing", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const upload = vi.fn().mockResolvedValue({
      outstandMediaId: "m1",
      outstandMediaUrl: "https://outstand.example/media/new.jpg",
      expiresAt,
    });
    const download = vi.fn().mockResolvedValue(Buffer.from("bytes"));
    const save = vi.fn().mockResolvedValue(undefined);

    const result = await resolveOutstandPostMedia({
      workspaceId: WORKSPACE_ID,
      mediaIds: [asMediaId("media-2")],
      actingUserId: USER_ID,
      outstandAdapter: {
        uploadMediaWorkingCopy: upload,
      } as unknown as IOutstandAdapter,
      mediaLookup: {
        listByIds: async () => [
          {
            id: asMediaId("media-2"),
            filename: "clip.mp4",
            mimeType: "video/mp4",
            storagePath: "ws/clip.mp4",
            url: "https://signed.example/clip.mp4",
            outstandMediaUrl: null,
            outstandExpiresAt: null,
          },
        ],
        downloadBytes: download,
        saveOutstandWorkingCopy: save,
      },
    });

    expect(download).toHaveBeenCalledWith("ws/clip.mp4");
    expect(upload).toHaveBeenCalledWith({
      fileBuffer: Buffer.from("bytes"),
      mimeType: "video/mp4",
    });
    expect(save).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE_ID,
        mediaId: asMediaId("media-2"),
        outstandMediaId: "m1",
        outstandMediaUrl: "https://outstand.example/media/new.jpg",
        outstandExpiresAt: expiresAt,
      },
      USER_ID,
    );
    expect(result).toEqual([
      {
        url: "https://outstand.example/media/new.jpg",
        filename: "clip.mp4",
      },
    ]);
  });

  it("keeps draft mediaIds order even when listByIds returns createdAt desc", async () => {
    const result = await resolveOutstandPostMedia({
      workspaceId: WORKSPACE_ID,
      mediaIds: [asMediaId("second"), asMediaId("first")],
      actingUserId: USER_ID,
      outstandAdapter: {} as IOutstandAdapter,
      mediaLookup: {
        listByIds: async () => [
          {
            id: asMediaId("first"),
            filename: "first.jpg",
            mimeType: "image/jpeg",
            storagePath: "ws/first.jpg",
            url: null,
            outstandMediaUrl: "https://outstand.example/first.jpg",
            outstandExpiresAt: new Date(Date.now() + 60_000),
          },
          {
            id: asMediaId("second"),
            filename: "second.jpg",
            mimeType: "image/jpeg",
            storagePath: "ws/second.jpg",
            url: null,
            outstandMediaUrl: "https://outstand.example/second.jpg",
            outstandExpiresAt: new Date(Date.now() + 60_000),
          },
        ],
        downloadBytes: async () => Buffer.from("x"),
        saveOutstandWorkingCopy: async () => undefined,
      },
    });

    expect(result?.map((item) => item.filename)).toEqual([
      "second.jpg",
      "first.jpg",
    ]);
  });

  it("throws when a media id is missing instead of publishing a partial set", async () => {
    await expect(
      resolveOutstandPostMedia({
        workspaceId: WORKSPACE_ID,
        mediaIds: [asMediaId("media-1"), asMediaId("missing")],
        actingUserId: USER_ID,
        outstandAdapter: {} as IOutstandAdapter,
        mediaLookup: {
          listByIds: async () => [
            {
              id: asMediaId("media-1"),
              filename: "photo.jpg",
              mimeType: "image/jpeg",
              storagePath: "ws/photo.jpg",
              url: null,
              outstandMediaUrl: "https://outstand.example/media/photo.jpg",
              outstandExpiresAt: new Date(Date.now() + 60_000),
            },
          ],
          downloadBytes: async () => Buffer.from("x"),
          saveOutstandWorkingCopy: async () => undefined,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
