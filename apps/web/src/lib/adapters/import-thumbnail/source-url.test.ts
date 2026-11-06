import { describe, expect, it } from "vitest";
import { isAllowedThumbnailSource, looksLikeVideoUrl } from "./source-url";

describe("isAllowedThumbnailSource (T-230, pagar SSRF)", () => {
  it.each([
    "https://scontent-lax3-1.xx.fbcdn.net/v/t15/a.jpg?oe=1",
    "https://scontent-sjc3-1.cdninstagram.com/o1/v/x.mp4",
    "https://p16-common-sign.tiktokcdn.com/tos/a.webp?x-expires=1",
  ])("menerima host CDN platform: %s", (url) => {
    expect(isAllowedThumbnailSource(url)).toBe(true);
  });

  it.each([
    "http://scontent.fbcdn.net/a.jpg",
    "https://evil.example.com/a.jpg",
    "https://fbcdn.net.evil.com/a.jpg",
    "https://notfbcdn.net/a.jpg",
    "https://user:pw@scontent.fbcdn.net/a.jpg",
    "https://scontent.fbcdn.net:8443/a.jpg",
    "https://127.0.0.1/a.jpg",
    "https://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "bukan url",
    "",
  ])("menolak: %s", (url) => {
    expect(isAllowedThumbnailSource(url)).toBe(false);
  });
});

describe("looksLikeVideoUrl", () => {
  it("mengenali ekstensi video pada path, mengabaikan query", () => {
    expect(looksLikeVideoUrl("https://x.cdninstagram.com/a/b.mp4?oe=1")).toBe(
      true,
    );
    expect(looksLikeVideoUrl("https://x.cdninstagram.com/a/b.MOV")).toBe(true);
    expect(looksLikeVideoUrl("https://x.fbcdn.net/a/b.jpg?x=.mp4")).toBe(false);
    expect(looksLikeVideoUrl("bukan url")).toBe(false);
  });
});
