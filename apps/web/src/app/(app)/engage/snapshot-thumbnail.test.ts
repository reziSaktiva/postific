import { MediaType } from "@postific/shared";
import { describe, expect, it } from "vitest";

import type { MediaThumbnailDto } from "@/domains/media";

import { resolveSnapshotThumbnail } from "./snapshot-thumbnail";

const stored: MediaThumbnailDto = {
  url: "https://supabase/signed",
  type: MediaType.Video,
};

describe("resolveSnapshotThumbnail (T-227)", () => {
  it("memakai media Postific bila mediaIds ada", () => {
    expect(
      resolveSnapshotThumbnail(
        { mediaIds: ["m1"], externalMediaUrl: "https://cdn/x.jpg" },
        new Map([["m1", stored]]),
      ),
    ).toBe(stored);
  });

  it("tidak jatuh ke URL eksternal bila media Postific ada tetapi gagal di-resolve", () => {
    expect(
      resolveSnapshotThumbnail(
        { mediaIds: ["m1"], externalMediaUrl: "https://cdn/x.jpg" },
        new Map(),
      ),
    ).toBeNull();
  });

  it("memakai URL eksternal sebagai gambar bila mediaIds kosong (posting impor)", () => {
    expect(
      resolveSnapshotThumbnail(
        { mediaIds: [], externalMediaUrl: "https://cdn/x.jpg" },
        new Map(),
      ),
    ).toEqual({ url: "https://cdn/x.jpg", type: MediaType.Image });
  });

  it("null tanpa media maupun URL eksternal (posting teks murni)", () => {
    expect(
      resolveSnapshotThumbnail(
        { mediaIds: [], externalMediaUrl: null },
        new Map(),
      ),
    ).toBeNull();
    expect(resolveSnapshotThumbnail({ mediaIds: [] }, new Map())).toBeNull();
  });

  it("T-230: thumbnail tersimpan (signed URL) diutamakan atas URL CDN", () => {
    expect(
      resolveSnapshotThumbnail(
        {
          mediaIds: [],
          externalMediaUrl: "https://cdn/x.jpg",
          thumbnailStoragePath: "w/imports/t1.webp",
        },
        new Map(),
        new Map([["w/imports/t1.webp", "https://supabase/signed-thumb"]]),
      ),
    ).toEqual({ url: "https://supabase/signed-thumb", type: MediaType.Image });
  });

  it("T-230: path tersimpan tetapi gagal ditandatangani jatuh ke URL CDN", () => {
    expect(
      resolveSnapshotThumbnail(
        {
          mediaIds: [],
          externalMediaUrl: "https://cdn/x.jpg",
          thumbnailStoragePath: "w/imports/t1.webp",
        },
        new Map(),
        new Map(),
      ),
    ).toEqual({ url: "https://cdn/x.jpg", type: MediaType.Image });
  });

  it("T-230: media Postific tetap mengalahkan thumbnail tersimpan", () => {
    expect(
      resolveSnapshotThumbnail(
        { mediaIds: ["m1"], thumbnailStoragePath: "w/imports/t1.webp" },
        new Map([["m1", stored]]),
        new Map([["w/imports/t1.webp", "https://supabase/signed-thumb"]]),
      ),
    ).toBe(stored);
  });
});
