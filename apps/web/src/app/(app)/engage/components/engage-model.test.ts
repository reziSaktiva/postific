import { describe, expect, it } from "vitest";

import type { InboxItemStatus } from "@/domains/engagement";

import type { InboxPostGroupDto } from "../actions";
import {
  applyStatusToGroup,
  countPanelFilters,
  availableStatusActions,
  filterByStatus,
  handledPercent,
  hasStaleComments,
  sortComments,
  summarizeComments,
} from "./engage-model";

const item = (status: InboxItemStatus, iso: string) => ({
  status,
  receivedAt: new Date(iso),
});

const group = (unreplied: number, handled: number) =>
  ({
    totalCount: unreplied + handled,
    unrepliedCount: unreplied,
    handledCount: handled,
  }) as InboxPostGroupDto;

describe("summarizeComments", () => {
  it("menghitung dibalas hanya dari status replied dan ditangani dari semua selain unread", () => {
    const s = summarizeComments([
      item("unread", "2026-11-01"),
      item("replied", "2026-11-01"),
      item("resolved", "2026-11-01"),
      item("dismissed", "2026-11-01"),
    ]);
    expect(s).toEqual({ total: 4, replied: 1, unread: 1, handled: 3 });
  });
});

describe("handledPercent", () => {
  it("membulatkan rasio ditangani dan 0 untuk posting tanpa komentar", () => {
    expect(handledPercent(group(1, 2))).toBe(67);
    expect(handledPercent(group(0, 0))).toBe(0);
  });
});

describe("sortComments", () => {
  const list = [
    item("replied", "2026-11-03"),
    item("unread", "2026-11-01"),
    item("unread", "2026-11-02"),
  ];
  it("bawaan: belum dibalas dulu, lalu terbaru", () => {
    expect(
      sortComments(list).map((i) => i.receivedAt.toISOString().slice(0, 10)),
    ).toEqual(["2026-11-02", "2026-11-01", "2026-11-03"]);
  });
  it("newest dan oldest mengabaikan status", () => {
    expect(sortComments(list, "newest")[0].status).toBe("replied");
    expect(sortComments(list, "oldest")[0].receivedAt.getDate()).toBe(1);
  });
  it("tidak mengubah masukan", () => {
    const copy = [...list];
    sortComments(list);
    expect(list).toEqual(copy);
  });
});

describe("filterByStatus", () => {
  it("all mengembalikan semua, status tertentu menyaring", () => {
    const list = [item("unread", "2026-11-01"), item("resolved", "2026-11-01")];
    expect(filterByStatus(list, "all")).toHaveLength(2);
    expect(filterByStatus(list, "resolved")).toHaveLength(1);
  });
});

describe("applyStatusToGroup", () => {
  it("unread ke selesai memindahkan satu hitungan ke ditangani", () => {
    const g = applyStatusToGroup(group(2, 1), "unread", "resolved");
    expect([g.unrepliedCount, g.handledCount, g.totalCount]).toEqual([1, 2, 3]);
  });
  it("buka kembali memindahkannya balik", () => {
    const g = applyStatusToGroup(group(1, 2), "dismissed", "unread");
    expect([g.unrepliedCount, g.handledCount]).toEqual([2, 1]);
  });
  it("replied ke resolved tidak mengubah hitungan", () => {
    const g = group(1, 2);
    expect(applyStatusToGroup(g, "replied", "resolved")).toBe(g);
  });
});

describe("availableStatusActions", () => {
  it("unread dan replied: resolve + dismiss; selesai dan diabaikan: buka kembali", () => {
    expect(availableStatusActions("unread")).toEqual({
      resolve: true,
      dismiss: true,
      reopen: false,
    });
    expect(availableStatusActions("replied").resolve).toBe(true);
    expect(availableStatusActions("resolved")).toEqual({
      resolve: false,
      dismiss: false,
      reopen: true,
    });
    expect(availableStatusActions("dismissed").reopen).toBe(true);
  });
});

describe("hasStaleComments", () => {
  const now = new Date("2026-11-06T00:00:00Z");
  it("true bila ada komentar lebih dari 30 hari", () => {
    expect(hasStaleComments([item("unread", "2026-09-01")], now)).toBe(true);
    expect(hasStaleComments([item("unread", "2026-10-20")], now)).toBe(false);
    expect(hasStaleComments([], now)).toBe(false);
  });
});

describe("countPanelFilters", () => {
  it("menghitung hanya yang menyimpang dari bawaan", () => {
    const d = {
      sort: "unreplied_first",
      dateRange: "12m",
      platform: "all",
    } as const;
    expect(countPanelFilters(d)).toBe(0);
    expect(countPanelFilters({ ...d, sort: "oldest" })).toBe(1);
    expect(
      countPanelFilters({
        sort: "newest",
        dateRange: "7d",
        platform: "tiktok",
      }),
    ).toBe(3);
  });
});
