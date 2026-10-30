import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime — tanggal absolut mengikuti zona (T-147)", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  // 2026-10-01T02:00Z: 1 Okt di WIB (09:00), 30 Sep di New_York (22:00 EDT)
  const old = new Date("2026-10-01T02:00:00Z");

  it("WIB: 1 Okt 2026", () => {
    expect(formatRelativeTime(old, "Asia/Jakarta", now)).toContain("1 Okt");
  });

  it("New_York: 30 Sep 2026", () => {
    expect(formatRelativeTime(old, "America/New_York", now)).toContain(
      "30 Sep",
    );
  });

  it("relatif tidak bergantung zona", () => {
    const recent = new Date("2026-10-28T10:00:00Z");
    expect(formatRelativeTime(recent, "America/New_York", now)).toBe(
      "2 jam lalu",
    );
    expect(formatRelativeTime(recent, "Asia/Jakarta", now)).toBe("2 jam lalu");
  });
});
