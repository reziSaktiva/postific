import { describe, expect, it } from "vitest";

import { formatPublishDateTime, formatPublishTime } from "./date-time-format";

describe("Publish date and time format", () => {
  const at = new Date("2026-12-12T06:05:00Z");

  it("shows the time as HH:mm with a colon in the display zone", () => {
    expect(formatPublishTime(at, "Asia/Jakarta")).toBe("13:05");
    expect(formatPublishTime(at, "UTC")).toBe("06:05");
  });

  it("puts the HH:mm time after the Indonesian date, never 'pukul 13.05'", () => {
    expect(formatPublishDateTime(at, "Asia/Jakarta")).toBe("12 Des 2026 13:05");
    expect(formatPublishDateTime(at, "Asia/Jakarta", "long")).toBe(
      "12 Desember 2026 13:05",
    );
  });
});
