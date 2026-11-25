import { describe, expect, it } from "vitest";
import { inboxDateRangeStart } from "./inbox-post-groups";

describe("inboxDateRangeStart", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");

  it("7 dan 30 hari mundur dari now", () => {
    expect(inboxDateRangeStart("7d", now)).toEqual(
      new Date("2026-10-30T12:00:00.000Z"),
    );
    expect(inboxDateRangeStart("30d", now)).toEqual(
      new Date("2026-10-07T12:00:00.000Z"),
    );
  });

  it("6 dan 12 bulan mundur dengan tanggal dijepit ke akhir bulan target", () => {
    expect(inboxDateRangeStart("6m", now)).toEqual(
      new Date("2026-05-06T12:00:00.000Z"),
    );
    expect(inboxDateRangeStart("12m", now)).toEqual(
      new Date("2025-11-06T12:00:00.000Z"),
    );
    expect(
      inboxDateRangeStart("6m", new Date("2026-08-31T00:00:00.000Z")),
    ).toEqual(new Date("2026-02-28T00:00:00.000Z"));
  });
});
