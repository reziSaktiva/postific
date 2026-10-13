import { describe, expect, it } from "vitest";
import { PublishingDomainError } from "./errors";
import {
  SCHEDULE_TIME_IN_PAST_MESSAGE,
  assertScheduledAtNotInPast,
  scheduleTimeConstraintMessage,
} from "./schedule-time-constraints";

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
