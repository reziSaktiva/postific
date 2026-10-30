import { describe, expect, it } from "vitest";
import {
  getLinkDisplayHost,
  getLinkPlatform,
  isSafeHttpUrl,
  sanitizeAvatarUrl,
  sanitizeLinkUrl,
} from "./safe-url";

describe("sanitizeLinkUrl", () => {
  it("accepts http and https and returns the canonical href", () => {
    expect(sanitizeLinkUrl("https://Example.com")).toBe("https://example.com/");
    expect(sanitizeLinkUrl("  http://example.com/a?b=1  ")).toBe(
      "http://example.com/a?b=1",
    );
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com",
    "mailto:a@b.com",
    "//example.com",
    "example.com",
    "",
    "   ",
    "https://",
    "https://user:pass@example.com",
    "https://example.com/" + "a".repeat(2100),
  ])("rejects %j", (input) => {
    expect(sanitizeLinkUrl(input)).toBeNull();
    expect(isSafeHttpUrl(input)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(sanitizeLinkUrl(null)).toBeNull();
    expect(sanitizeLinkUrl(undefined)).toBeNull();
    expect(sanitizeLinkUrl(42)).toBeNull();
  });
});

describe("sanitizeAvatarUrl", () => {
  it("accepts only https", () => {
    expect(sanitizeAvatarUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(sanitizeAvatarUrl("http://cdn.example.com/a.png")).toBeNull();
    expect(sanitizeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeAvatarUrl("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("getLinkPlatform", () => {
  it.each([
    ["https://instagram.com/raka", "instagram"],
    ["https://www.instagram.com/raka", "instagram"],
    ["https://youtu.be/abc", "youtube"],
    ["https://m.youtube.com/watch?v=1", "youtube"],
    ["https://twitter.com/raka", "x"],
    ["https://wa.me/62812", "whatsapp"],
    ["https://example.com", "link"],
    ["https://notinstagram.com", "link"],
    ["https://instagram.com.evil.test", "link"],
    ["javascript:alert(1)", "link"],
  ])("%s -> %s", (url, platform) => {
    expect(getLinkPlatform(url)).toBe(platform);
  });
});

describe("getLinkDisplayHost", () => {
  it("strips www and returns null for invalid", () => {
    expect(getLinkDisplayHost("https://www.example.com/x")).toBe("example.com");
    expect(getLinkDisplayHost("nope")).toBeNull();
  });
});
