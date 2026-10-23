import { ContentFormat, ContentStatus } from "@postific/shared";
import type { ConnectedAccountId, PostId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { CalendarPostItem } from "@/domains/publishing";
import {
  addMonths,
  flattenCalendarItemsToEntries,
} from "./calendar-grid-shared";

function item(overrides: Partial<CalendarPostItem>): CalendarPostItem {
  return {
    id: "post-1" as PostId,
    caption: "x",
    status: ContentStatus.Scheduled,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    targets: [
      {
        id: "t-1",
        connectedAccountId: "acc-1" as ConnectedAccountId,
        platform: "instagram",
        contentFormat: ContentFormat.Post,
        accountHandle: "h",
        platformPostUrl: null,
      },
    ],
    metrics: null,
    ...overrides,
  } as unknown as CalendarPostItem;
}

describe("flattenCalendarItemsToEntries (T-144, WIB)", () => {
  it("17:00Z (= 00:00 WIB) pindah ke hari berikutnya jam 0; 16:59Z tetap hari itu jam 23", () => {
    const [after] = flattenCalendarItemsToEntries([
      item({ scheduledAt: new Date("2026-09-01T17:00:00Z") }),
    ]);
    const [before] = flattenCalendarItemsToEntries([
      item({ scheduledAt: new Date("2026-09-01T16:59:00Z") }),
    ]);

    expect(after).toMatchObject({ dateKey: "2026-09-02", hour: 0 });
    expect(before).toMatchObject({ dateKey: "2026-09-01", hour: 23 });
  });
});

describe("addMonths (T-144, WIB)", () => {
  it("31 Jan + 1 bulan jatuh di Februari (tanggal 1 WIB), bukan melompat ke Maret", () => {
    const result = addMonths(new Date("2027-01-31T10:00:00Z"), 1);
    expect(result.toISOString()).toBe("2027-01-31T17:00:00.000Z"); // 1 Feb 00:00 WIB
  });

  it("anchor 17:00Z di akhir bulan dihitung sebagai bulan berikutnya (WIB)", () => {
    // 2026-01-31T17:00Z = 1 Feb 00:00 WIB -> +1 bulan = 1 Mar 00:00 WIB
    const result = addMonths(new Date("2026-01-31T17:00:00Z"), 1);
    expect(result.toISOString()).toBe("2026-02-28T17:00:00.000Z");
  });

  it("mundur melewati pergantian tahun", () => {
    const result = addMonths(new Date("2026-01-10T00:00:00Z"), -1);
    expect(result.toISOString()).toBe("2025-11-30T17:00:00.000Z"); // 1 Des 2025 00:00 WIB
  });
});
