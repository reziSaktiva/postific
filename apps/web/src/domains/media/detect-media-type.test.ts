import { describe, expect, it } from "vitest";

import { detectMediaMimeType } from "./detect-media-type";
import { ALLOWED_MEDIA_MIME_TYPES } from "./validation";

const bytes = (...v: number[]) => Uint8Array.from(v);
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
const ftyp = (brand: string, compat: string[] = []) =>
  bytes(
    0,
    0,
    0,
    16 + compat.length * 4,
    ...text("ftyp"),
    ...text(brand),
    0,
    0,
    0,
    0,
    ...compat.flatMap(text),
  );

describe("detectMediaMimeType", () => {
  it("detects every allowed MIME type from content", () => {
    const detected = [
      detectMediaMimeType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)),
      detectMediaMimeType(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0),
      ),
      detectMediaMimeType(bytes(...text("RIFF"), 1, 2, 3, 4, ...text("WEBP"))),
      detectMediaMimeType(bytes(...text("GIF89a"), 1)),
      detectMediaMimeType(bytes(...text("GIF87a"), 1)),
      detectMediaMimeType(ftyp("isom")),
      detectMediaMimeType(ftyp("qt  ")),
    ];
    expect(detected).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/gif",
      "video/mp4",
      "video/quicktime",
    ]);
    for (const mime of detected) {
      expect(ALLOWED_MEDIA_MIME_TYPES[mime as string]).toBeDefined();
    }
  });

  it("uses compatible brands when the major brand is unknown", () => {
    expect(detectMediaMimeType(ftyp("zzzz", ["mp42"]))).toBe("video/mp4");
    expect(detectMediaMimeType(ftyp("zzzz", ["abcd"]))).toBeNull();
  });

  it.each([
    ["html", bytes(...text("<html><body>hi"))],
    ["svg", bytes(...text("<svg xmlns='x'></svg>"))],
    ["empty", bytes()],
    ["short", bytes(0xff, 0xd8)],
    ["RIFF but not WEBP", bytes(...text("RIFF"), 1, 2, 3, 4, ...text("WAVE"))],
    ["bad ftyp size", bytes(0, 0, 0, 4, ...text("ftyp"), ...text("isom"))],
    ["PE executable", bytes(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0)],
  ])("returns null for %s", (_l, data) => {
    expect(detectMediaMimeType(data)).toBeNull();
  });

  it("treats ftyp boxSize 1 (64-bit size) as valid and still scans compatible brands", () => {
    const withSize1 = (brand: string, compat: string[] = []) =>
      bytes(
        0,
        0,
        0,
        1,
        ...text("ftyp"),
        ...text(brand),
        0,
        0,
        0,
        0,
        ...compat.flatMap(text),
      );
    expect(detectMediaMimeType(withSize1("isom"))).toBe("video/mp4");
    expect(detectMediaMimeType(withSize1("qt  "))).toBe("video/quicktime");
    expect(detectMediaMimeType(withSize1("zzzz", ["mp42"]))).toBe("video/mp4");
  });
});
