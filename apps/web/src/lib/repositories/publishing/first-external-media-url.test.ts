import { describe, expect, it } from "vitest";

import { firstExternalMediaUrl } from "./first-external-media-url";

describe("firstExternalMediaUrl (T-227)", () => {
  it("mengambil URL pertama dari platformOptions.mediaUrls", () => {
    expect(
      firstExternalMediaUrl({
        mediaUrls: ["https://scontent.cdninstagram.com/a.jpg", "https://x/b"],
      }),
    ).toBe("https://scontent.cdninstagram.com/a.jpg");
  });

  it("null untuk platformOptions kosong, bukan objek, atau array", () => {
    expect(firstExternalMediaUrl(null)).toBeNull();
    expect(firstExternalMediaUrl("x")).toBeNull();
    expect(firstExternalMediaUrl([])).toBeNull();
    expect(firstExternalMediaUrl({})).toBeNull();
  });

  it("null bila mediaUrls bukan array atau kosong", () => {
    expect(firstExternalMediaUrl({ mediaUrls: "https://a/b" })).toBeNull();
    expect(firstExternalMediaUrl({ mediaUrls: [] })).toBeNull();
  });

  it("menolak elemen pertama yang bukan string https://", () => {
    expect(firstExternalMediaUrl({ mediaUrls: [42] })).toBeNull();
    expect(
      firstExternalMediaUrl({ mediaUrls: ["http://x.fbcdn.net/a.jpg"] }),
    ).toBeNull();
    expect(firstExternalMediaUrl({ mediaUrls: ["httpx://x/a"] })).toBeNull();
    expect(
      firstExternalMediaUrl({ mediaUrls: ["javascript:alert(1)"] }),
    ).toBeNull();
    expect(
      firstExternalMediaUrl({ mediaUrls: ["data:image/png;base64,AA"] }),
    ).toBeNull();
  });
});
