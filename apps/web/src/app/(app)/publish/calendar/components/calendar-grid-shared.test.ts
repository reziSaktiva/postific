import { ContentFormat, ContentStatus } from "@postific/shared";
import type { ConnectedAccountId, PostId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { CalendarPostItem } from "@/domains/publishing";
import {
  addDays,
  addMonths,
  flattenCalendarItemsToEntries,
} from "./calendar-grid-shared";

const WIB = "Asia/Jakarta";

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
    const [after] = flattenCalendarItemsToEntries(
      [item({ scheduledAt: new Date("2026-09-01T17:00:00Z") })],
      WIB,
    );
    const [before] = flattenCalendarItemsToEntries(
      [item({ scheduledAt: new Date("2026-09-01T16:59:00Z") })],
      WIB,
    );

    expect(after).toMatchObject({ dateKey: "2026-09-02", hour: 0 });
    expect(before).toMatchObject({ dateKey: "2026-09-01", hour: 23 });
  });
});

describe("addMonths (T-144, WIB)", () => {
  it("31 Jan + 1 bulan jatuh di Februari (tanggal 1 WIB), bukan melompat ke Maret", () => {
    const result = addMonths(new Date("2027-01-31T10:00:00Z"), 1, WIB);
    expect(result.toISOString()).toBe("2027-01-31T17:00:00.000Z"); // 1 Feb 00:00 WIB
  });

  it("anchor 17:00Z di akhir bulan dihitung sebagai bulan berikutnya (WIB)", () => {
    // 2026-01-31T17:00Z = 1 Feb 00:00 WIB -> +1 bulan = 1 Mar 00:00 WIB
    const result = addMonths(new Date("2026-01-31T17:00:00Z"), 1, WIB);
    expect(result.toISOString()).toBe("2026-02-28T17:00:00.000Z");
  });

  it("mundur melewati pergantian tahun", () => {
    const result = addMonths(new Date("2026-01-10T00:00:00Z"), -1, WIB);
    expect(result.toISOString()).toBe("2025-11-30T17:00:00.000Z"); // 1 Des 2025 00:00 WIB
  });
});

describe("zona non-WIB (T-147)", () => {
  it("kartu mengikuti zona pengguna: 03:30Z = 23:30 hari sebelumnya di New_York (EDT)", () => {
    const [entry] = flattenCalendarItemsToEntries(
      [item({ scheduledAt: new Date("2026-09-02T03:30:00Z") })],
      "America/New_York",
    );
    expect(entry).toMatchObject({ dateKey: "2026-09-01", hour: 23 });
  });

  it("zona yang sama menghasilkan hari/jam beda dari WIB", () => {
    const scheduledAt = new Date("2026-09-01T20:00:00Z");
    const [wib] = flattenCalendarItemsToEntries([item({ scheduledAt })], WIB);
    const [kolkata] = flattenCalendarItemsToEntries(
      [item({ scheduledAt })],
      "Asia/Kolkata",
    );
    expect(wib).toMatchObject({ dateKey: "2026-09-02", hour: 3 });
    expect(kolkata).toMatchObject({ dateKey: "2026-09-02", hour: 1 });
  });

  it("addDays memakai hari kalender, bukan 24 jam, melewati DST fall-back New_York", () => {
    // 1 Nov 2026 00:00 EDT (04:00Z); 2 Nov sudah EST (hari 1 Nov = 25 jam)
    const start = new Date("2026-11-01T04:00:00Z");
    expect(addDays(start, 1, "America/New_York").toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });

  it("addMonths di New_York dipatok ke tanggal 1 00:00 lokal", () => {
    const result = addMonths(
      new Date("2026-10-15T12:00:00Z"),
      1,
      "America/New_York",
    );
    expect(result.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });
});
