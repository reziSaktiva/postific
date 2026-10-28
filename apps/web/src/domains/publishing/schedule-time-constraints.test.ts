import { describe, expect, it } from "vitest";
import { PublishingDomainError } from "./errors";
import {
  SCHEDULE_TIME_IN_PAST_MESSAGE,
  assertScheduledAtNotInPast,
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

describe("assertScheduledAtNotInPast", () => {
  it("does not throw for a future time", () => {
    expect(() =>
      assertScheduledAtNotInPast(new Date("2026-09-28T12:00:00.000Z"), NOW),
    ).not.toThrow();
  });

  it("throws PublishingDomainError for a past time", () => {
    expect(() =>
      assertScheduledAtNotInPast(new Date("2026-09-28T08:00:00.000Z"), NOW),
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
