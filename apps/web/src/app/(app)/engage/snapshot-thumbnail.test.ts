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
});
