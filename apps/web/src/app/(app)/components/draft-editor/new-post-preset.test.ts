import { describe, expect, it } from "vitest";

import { resolveNewPostPresetSchedule } from "./new-post-preset";

const JAKARTA = "Asia/Jakarta"; // UTC+7
const LA = "America/Los_Angeles"; // UTC-8 in November

describe("resolveNewPostPresetSchedule", () => {
  it("returns nothing without a preset or without a date", () => {
    expect(resolveNewPostPresetSchedule(undefined, JAKARTA)).toEqual({});
    expect(
      resolveNewPostPresetSchedule({ connectedAccountId: "a" }, JAKARTA),
    ).toEqual({});
    expect(resolveNewPostPresetSchedule({ time: "09:00" }, JAKARTA)).toEqual(
      {},
    );
  });

  it("keeps a date-only preset in the editor zone as it is", () => {
    expect(
      resolveNewPostPresetSchedule({ date: "2026-12-05" }, JAKARTA),
    ).toEqual({ scheduleDate: "2026-12-05" });
  });

  it("sets date and time as given when the zones are the same", () => {
    expect(
      resolveNewPostPresetSchedule(
        { date: "2026-12-05", time: "09:30", timeZone: JAKARTA },
        JAKARTA,
      ),
    ).toEqual({ scheduleDate: "2026-12-05", scheduleTime: "09:30" });
  });

  it("converts the time into the editor zone, moving the day when needed", () => {
    // 21:00 on 5 Dec in Los Angeles is 12:00 on 6 Dec in Jakarta.
    expect(
      resolveNewPostPresetSchedule(
        { date: "2026-12-05", time: "21:00", timeZone: LA },
        JAKARTA,
      ),
    ).toEqual({ scheduleDate: "2026-12-06", scheduleTime: "12:00" });
  });

  it("converts a date-only preset from another zone through midday", () => {
    // Midday on 5 Dec in Los Angeles is 03:00 on 6 Dec in Jakarta.
    expect(
      resolveNewPostPresetSchedule(
        { date: "2026-12-05", timeZone: LA },
        JAKARTA,
      ),
    ).toEqual({ scheduleDate: "2026-12-06" });
  });

  it("ignores an unreadable date", () => {
    expect(
      resolveNewPostPresetSchedule({ date: "soon", time: "09:00" }, JAKARTA),
    ).toEqual({});
  });
});
