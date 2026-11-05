import { describe, expect, it } from "vitest";
import { PublishingDomainError } from "./errors";
import {
  SCHEDULE_TIME_IN_PAST_MESSAGE,
  assertScheduledAtAllowed,
  scheduleMaxDateKey,
  scheduleTimeConstraintMessage,
} from "./schedule-time-constraints";
import { zonedLocalToUtc } from "./wib-time";

const NOW = new Date("2026-09-28T11:48:00.000Z");

describe("scheduleTimeConstraintMessage", () => {
  it("allows a future time on the same day", () => {
    expect(
      scheduleTimeConstraintMessage(new Date("2026-09-28T12:00:00.000Z"), NOW),
    ).toBeNull();
  });

  it("allows a future date entirely", () => {
    expect(
      scheduleTimeConstraintMessage(new Date("2026-09-29T08:00:00.000Z"), NOW),
    ).toBeNull();
  });

  it("rejects a time earlier today than now", () => {
    expect(
      scheduleTimeConstraintMessage(new Date("2026-09-28T08:00:00.000Z"), NOW),
    ).toBe(SCHEDULE_TIME_IN_PAST_MESSAGE);
  });

  it("rejects a date entirely in the past", () => {
    expect(
      scheduleTimeConstraintMessage(new Date("2026-09-27T23:59:00.000Z"), NOW),
    ).toBe(SCHEDULE_TIME_IN_PAST_MESSAGE);
  });

  it("rejects exactly now (not strictly in the future)", () => {
    expect(scheduleTimeConstraintMessage(new Date(NOW), NOW)).toBe(
      SCHEDULE_TIME_IN_PAST_MESSAGE,
    );
  });

  it("ignores an invalid Date instead of rejecting it", () => {
    expect(
      scheduleTimeConstraintMessage(new Date("not-a-date"), NOW),
    ).toBeNull();
  });
});

describe("assertScheduledAtAllowed", () => {
  it("does not throw for a future time", () => {
    expect(() =>
      assertScheduledAtAllowed(new Date("2026-09-28T12:00:00.000Z"), NOW),
    ).not.toThrow();
  });

  it("throws PublishingDomainError for a past time", () => {
    expect(() =>
      assertScheduledAtAllowed(new Date("2026-09-28T08:00:00.000Z"), NOW),
    ).toThrow(PublishingDomainError);
  });
});

describe("scheduleTimeConstraintMessage dengan input picker WIB (T-146)", () => {
  // NOW = 11:48Z = 18:48 WIB.
  it("menolak 18:00 WIB hari itu (sudah lewat di WIB)", () => {
    expect(
      scheduleTimeConstraintMessage(
        zonedLocalToUtc("2026-09-28", "18:00", "Asia/Jakarta"),
        NOW,
      ),
    ).toBe(SCHEDULE_TIME_IN_PAST_MESSAGE);
  });

  it("menerima 19:00 WIB hari itu (masa depan di WIB, 12:00Z)", () => {
    expect(
      scheduleTimeConstraintMessage(
        zonedLocalToUtc("2026-09-28", "19:00", "Asia/Jakarta"),
        NOW,
      ),
    ).toBeNull();
  });
});

describe("batas jadwal 30 hari (ADR-154, T-198)", () => {
  const limit = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);

  it("accepts a schedule exactly at the 30-day limit", () => {
    expect(scheduleTimeConstraintMessage(limit, NOW)).toBeNull();
  });

  it("rejects a schedule one second past the limit and names the exact limit", () => {
    const message = scheduleTimeConstraintMessage(
      new Date(limit.getTime() + 1000),
      NOW,
      "Asia/Jakarta",
    );
    expect(message).toBe(
      "Jadwal maksimal 30 hari dari sekarang. Pilih waktu paling lambat 28 Oct 2026 18:48 (Asia/Jakarta).",
    );
  });

  it("formats the limit in the given time zone", () => {
    expect(
      scheduleTimeConstraintMessage(
        new Date(limit.getTime() + 1000),
        NOW,
        "UTC",
      ),
    ).toContain("28 Oct 2026 11:48 (UTC)");
  });

  it("throws PublishingDomainError for a schedule beyond 30 days", () => {
    expect(() =>
      assertScheduledAtAllowed(new Date("2027-01-03T03:00:00.000Z"), NOW),
    ).toThrow(PublishingDomainError);
  });

  it("exposes the last selectable date key for the date input max", () => {
    expect(scheduleMaxDateKey(NOW, "Asia/Jakarta")).toBe("2026-10-28");
  });
});

describe("batas jadwal di zona negatif, DST, dan zona tak valid (T-213.4)", () => {
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  it("zona negatif: jam batas ditulis di zona itu", () => {
    // 11:48Z = 07:48 EDT (UTC-4); batas 28 Okt masih EDT.
    expect(
      scheduleTimeConstraintMessage(
        new Date(NOW.getTime() + THIRTY_DAYS + 1000),
        NOW,
        "America/New_York",
      ),
    ).toContain("28 Oct 2026 07:48 (America/New_York)");
  });

  it("melewati akhir DST: jam dinding batas bergeser satu jam", () => {
    // 15 Okt 12:00Z = 08:00 EDT; batas 14 Nov 12:00Z = 07:00 EST.
    const now = new Date("2026-10-15T12:00:00Z");
    expect(
      scheduleTimeConstraintMessage(
        new Date(now.getTime() + THIRTY_DAYS + 1000),
        now,
        "America/New_York",
      ),
    ).toContain("14 Nov 2026 07:00 (America/New_York)");
  });

  it("tanggal batas di zona negatif mengikuti hari lokal, bukan UTC", () => {
    // 03:00Z = 20:00 PDT 27 Sep.
    const now = new Date("2026-09-28T03:00:00Z");
    expect(scheduleMaxDateKey(now, "America/Los_Angeles")).toBe("2026-10-27");
    expect(scheduleMaxDateKey(now, "UTC")).toBe("2026-10-28");
  });

  it("zona tak valid ditolak server sebagai UTC, bukan melempar galat zona", () => {
    const beyond = new Date(NOW.getTime() + THIRTY_DAYS + 1000);
    expect(() => assertScheduledAtAllowed(beyond, NOW, "Bukan/Zona")).toThrow(
      /\(UTC\)/,
    );
  });
});
