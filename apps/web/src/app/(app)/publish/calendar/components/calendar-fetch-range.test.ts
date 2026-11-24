import { describe, expect, it } from "vitest";

import { getCalendarFetchRange, getThreeDays } from "./calendar-fetch-range";

const WIB = "Asia/Jakarta";

describe("getCalendarFetchRange", () => {
  it("keeps the week when the three days fit inside it", () => {
    // Wednesday 2026-11-25 10:00 WIB.
    const date = new Date("2026-11-25T03:00:00.000Z");
    expect(getCalendarFetchRange("week", date, WIB)).toEqual({
      from: new Date("2026-11-22T17:00:00.000Z"), // Mon 23 Nov 00:00 WIB
      to: new Date("2026-11-29T16:59:59.999Z"), // Sun 29 Nov 23:59:59.999 WIB
    });
  });

  it("widens the week to the end of the third day on a Saturday", () => {
    // Saturday 2026-11-28 10:00 WIB: the third day is Monday 30 Nov.
    const date = new Date("2026-11-28T03:00:00.000Z");
    expect(getCalendarFetchRange("week", date, WIB)).toEqual({
      from: new Date("2026-11-22T17:00:00.000Z"),
      to: new Date("2026-11-30T16:59:59.999Z"),
    });
  });

  it("widens the month into the next month at its end", () => {
    // Monday 2026-11-30 10:00 WIB: the three days end on 2 Dec.
    const date = new Date("2026-11-30T03:00:00.000Z");
    expect(getCalendarFetchRange("month", date, WIB)).toEqual({
      from: new Date("2026-10-31T17:00:00.000Z"), // 1 Nov 00:00 WIB
      to: new Date("2026-12-02T16:59:59.999Z"),
    });
  });
});

describe("getThreeDays", () => {
  it("returns the selected day and the two after it at midnight", () => {
    const date = new Date("2026-11-30T03:00:00.000Z");
    expect(getThreeDays(date, WIB)).toEqual([
      new Date("2026-11-29T17:00:00.000Z"),
      new Date("2026-11-30T17:00:00.000Z"),
      new Date("2026-12-01T17:00:00.000Z"),
    ]);
  });
});
