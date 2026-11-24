import { describe, expect, it } from "vitest";

import type { BestTimeSlot } from "@/domains/analytics";

import { pickVisibleSlots } from "./queue-suggestions";

function slot(rank: number, iso: string): BestTimeSlot {
  return {
    slotAt: new Date(iso),
    weekday: 1,
    hour: 9,
    rank,
    medianEngagementRate: 0.1,
    medianReach: 10,
    postCount: 3,
  };
}

const SLOTS = [
  slot(4, "2026-07-14T01:00:00Z"),
  slot(1, "2026-07-14T05:00:00Z"),
  slot(3, "2026-07-15T05:00:00Z"),
  slot(2, "2026-07-16T05:00:00Z"),
];

describe("pickVisibleSlots", () => {
  it("shows the three best-ranked slots first, in time order, not the three earliest", () => {
    expect(pickVisibleSlots(SLOTS, false).map((s) => s.rank)).toEqual([
      1, 3, 2,
    ]);
  });

  it("shows every slot, in time order, after show more", () => {
    expect(pickVisibleSlots(SLOTS, true).map((s) => s.rank)).toEqual([
      4, 1, 3, 2,
    ]);
  });

  it("returns what exists when there are fewer slots than the initial count", () => {
    expect(pickVisibleSlots(SLOTS.slice(0, 2), false)).toHaveLength(2);
    expect(pickVisibleSlots([], false)).toEqual([]);
  });
});
