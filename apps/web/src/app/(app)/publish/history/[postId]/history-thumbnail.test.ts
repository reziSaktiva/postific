import { MediaType, asUserId, asWorkspaceId } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";

import { resolveHistoryThumbnail } from "./history-thumbnail";

const workspaceId = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const userId = asUserId("22222222-2222-4222-8222-222222222222");

type Target = {
  thumbnailStoragePath: string | null;
  externalMediaUrl: string | null;
};
type Sign = (
  workspaceId: unknown,
  paths: string[],
) => Promise<Map<string, string>>;
const target = (t: Partial<Target> = {}): Target => ({
  thumbnailStoragePath: null,
  externalMediaUrl: null,
  ...t,
});

function service(
  overrides: {
    sign?: Sign;
  } = {},
) {
  return {
    resolveFirstThumbnail: vi.fn(async () => ({
      url: "https://signed/postific",
      type: MediaType.Image,
    })),
    signStoragePaths: vi.fn<Sign>(
      overrides.sign ??
        (async (_w, paths) =>
          new Map(paths.map((p) => [p, `https://signed/${p}`]))),
    ),
  };
}

// Cast: tes hanya membutuhkan field yang dibaca resolver.
const asItem = (mediaIds: string[], targets: Target[]) =>
  ({ mediaIds, targets }) as never;

describe("resolveHistoryThumbnail (T-232)", () => {
  it("post dengan media Postific memakai resolveFirstThumbnail", async () => {
    const svc = service();
    const result = await resolveHistoryThumbnail(
      asItem(["m1"], [target({ thumbnailStoragePath: "w/imports/a.webp" })]),
      workspaceId,
      userId,
      svc,
    );
    expect(result?.url).toBe("https://signed/postific");
    expect(svc.signStoragePaths).not.toHaveBeenCalled();
  });

  it("posting impor memakai thumbnail tersimpan yang ditandatangani", async () => {
    const svc = service();
    const result = await resolveHistoryThumbnail(
      asItem([], [target({ thumbnailStoragePath: "w/imports/a.webp" })]),
      workspaceId,
      userId,
      svc,
    );
    expect(result).toEqual({
      url: "https://signed/w/imports/a.webp",
      type: MediaType.Image,
    });
  });

  it("multi-target: memakai target pertama yang punya thumbnailStoragePath", async () => {
    const svc = service();
    const result = await resolveHistoryThumbnail(
      asItem(
        [],
        [
          target({ externalMediaUrl: "https://cdn/x.jpg" }),
          target({ thumbnailStoragePath: "w/imports/second.webp" }),
          target({ thumbnailStoragePath: "w/imports/third.webp" }),
        ],
      ),
      workspaceId,
      userId,
      svc,
    );
    expect(result?.url).toBe("https://signed/w/imports/second.webp");
    expect(svc.signStoragePaths).toHaveBeenCalledWith(workspaceId, [
      "w/imports/second.webp",
    ]);
  });

  it("gagal tanda tangan (peta kosong) jatuh ke URL CDN", async () => {
    const svc = service({ sign: async () => new Map() });
    const result = await resolveHistoryThumbnail(
      asItem(
        [],
        [
          target({
            thumbnailStoragePath: "w/imports/a.webp",
            externalMediaUrl: "https://cdn/x.jpg",
          }),
        ],
      ),
      workspaceId,
      userId,
      svc,
    );
    expect(result).toEqual({ url: "https://cdn/x.jpg", type: MediaType.Image });
  });

  it("tanda tangan melempar: tidak melempar, jatuh ke CDN atau null", async () => {
    const svc = service({
      sign: async () => {
        throw new Error("boom");
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      resolveHistoryThumbnail(
        asItem([], [target({ thumbnailStoragePath: "w/imports/a.webp" })]),
        workspaceId,
        userId,
        svc,
      ),
    ).resolves.toBeNull();
    spy.mockRestore();
  });

  it("tanpa thumbnail maupun URL CDN: null (media dihilangkan)", async () => {
    const svc = service();
    expect(
      await resolveHistoryThumbnail(
        asItem([], [target(), target()]),
        workspaceId,
        userId,
        svc,
      ),
    ).toBeNull();
  });

  it("hanya URL CDN (belum ada thumbnail tersimpan): memakai CDN tanpa tanda tangan", async () => {
    const svc = service();
    const result = await resolveHistoryThumbnail(
      asItem([], [target({ externalMediaUrl: "https://cdn/x.jpg" })]),
      workspaceId,
      userId,
      svc,
    );
    expect(result).toEqual({ url: "https://cdn/x.jpg", type: MediaType.Image });
    expect(svc.signStoragePaths).not.toHaveBeenCalled();
  });
});
