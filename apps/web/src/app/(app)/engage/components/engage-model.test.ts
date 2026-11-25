import { describe, expect, it } from "vitest";

import type { InboxItemStatus } from "@/domains/engagement";

import type { InboxPostGroupDto } from "../engage-dto";
import {
  applyStatusToGroup,
  countPanelFilters,
  availableStatusActions,
  handledPercent,
  applyStatusToCounts,
  compareComments,
  compareGroups,
  hasStaleComments,
  summarizeGroup,
} from "./engage-model";

let seq = 0;
const item = (status: InboxItemStatus, iso: string) => {
  seq += 1;
  return { id: `item-${seq}`, status, receivedAt: new Date(iso) };
};

const group = (unreplied: number, handled: number, replied = 0) =>
  ({
    totalCount: unreplied + handled,
    unrepliedCount: unreplied,
    handledCount: handled,
    repliedCount: replied,
  }) as InboxPostGroupDto;

describe("summarizeGroup", () => {
  it("memakai hitungan kelompok (count query), bukan komentar yang dimuat", () => {
    expect(summarizeGroup(group(1, 3, 1))).toEqual({
      total: 4,
      replied: 1,
      unread: 1,
      handled: 3,
    });
  });
});

describe("handledPercent", () => {
  it("membulatkan rasio ditangani dan 0 untuk posting tanpa komentar", () => {
    expect(handledPercent(group(1, 2))).toBe(67);
    expect(handledPercent(group(0, 0))).toBe(0);
  });
});

describe("compareComments (urutan sama dengan kueri repository)", () => {
  const list = () => [
    item("replied", "2026-11-03"),
    item("unread", "2026-11-01"),
    item("unread", "2026-11-02"),
  ];
  const day = (i: { receivedAt: Date }) =>
    i.receivedAt.toISOString().slice(0, 10);
  it("belum dibalas dulu, lalu terbaru", () => {
    expect(list().sort(compareComments("unreplied_first")).map(day)).toEqual([
      "2026-11-02",
      "2026-11-01",
      "2026-11-03",
    ]);
  });
  it("newest dan oldest mengabaikan status", () => {
    expect(list().sort(compareComments("newest"))[0].status).toBe("replied");
    expect(day(list().sort(compareComments("oldest"))[0])).toBe("2026-11-01");
  });
  it("waktu sama: id sebagai tie-breaker, turun untuk newest dan naik untuk oldest", () => {
    const a = { ...item("unread", "2026-11-01"), id: "a" };
    const b = { ...item("unread", "2026-11-01"), id: "b" };
    expect([a, b].sort(compareComments("newest")).map((i) => i.id)).toEqual([
      "b",
      "a",
    ]);
    expect([b, a].sort(compareComments("oldest")).map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("compareGroups (urutan sama dengan kueri repository)", () => {
  const g = (
    postId: string | null,
    unreplied: number,
    total: number,
    iso: string | null,
  ) =>
    ({
      postId,
      unrepliedCount: unreplied,
      totalCount: total,
      latestReceivedAt: iso ? new Date(iso) : null,
    }) as unknown as InboxPostGroupDto;
  const ids = (list: InboxPostGroupDto[]) => list.map((x) => x.postId);

  it("posting berkomentar, lalu posting kosong, lalu Tanpa posting di dasar untuk sort apa pun", () => {
    const list = [
      g(null, 5, 5, "2026-11-05"),
      g("empty", 0, 0, null),
      g("p1", 1, 2, "2026-11-01"),
    ];
    for (const sort of ["unreplied_first", "newest", "oldest"] as const) {
      expect(ids([...list].sort(compareGroups(sort)))).toEqual([
        "p1",
        "empty",
        null,
      ]);
    }
  });
  it("belum dibalas terbanyak dulu, lalu komentar terbaru, lalu id posting", () => {
    const list = [
      g("b", 1, 1, "2026-11-05"),
      g("a", 1, 1, "2026-11-05"),
      g("c", 3, 3, "2026-11-01"),
      g("d", 1, 1, "2026-11-09"),
    ];
    expect(ids(list.sort(compareGroups("unreplied_first")))).toEqual([
      "c",
      "d",
      "a",
      "b",
    ]);
  });
  it("newest dan oldest memakai komentar terbaru kelompok", () => {
    const list = [g("a", 0, 1, "2026-11-01"), g("b", 0, 1, "2026-11-05")];
    expect(ids([...list].sort(compareGroups("newest")))).toEqual(["b", "a"]);
    expect(ids([...list].sort(compareGroups("oldest")))).toEqual(["a", "b"]);
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
  it("replied ke resolved memindahkan hitungan dibalas tanpa mengubah belum dibalas", () => {
    const g = applyStatusToGroup(group(1, 2, 1), "replied", "resolved");
    expect([g.unrepliedCount, g.handledCount, g.repliedCount]).toEqual([
      1, 2, 0,
    ]);
  });
  it("unread ke replied menambah dibalas dan memindahkan satu ke ditangani", () => {
    const g = applyStatusToGroup(group(2, 1, 0), "unread", "replied");
    expect([g.unrepliedCount, g.handledCount, g.repliedCount]).toEqual([
      1, 2, 1,
    ]);
  });
  it("status sama tidak mengubah apa pun", () => {
    const g = group(1, 2);
    expect(applyStatusToGroup(g, "resolved", "resolved")).toBe(g);
  });
});

describe("applyStatusToCounts", () => {
  const counts = { total: 10, unread: 4 };
  it("tanpa filter status: hanya belum dibalas yang berubah", () => {
    expect(applyStatusToCounts(counts, "unread", "resolved", "all")).toEqual({
      total: 10,
      unread: 3,
    });
    expect(applyStatusToCounts(counts, "dismissed", "unread", "all")).toEqual({
      total: 10,
      unread: 5,
    });
  });
  it("komentar yang keluar dari filter status keluar dari total", () => {
    expect(applyStatusToCounts(counts, "unread", "resolved", "unread")).toEqual(
      { total: 9, unread: 3 },
    );
    expect(
      applyStatusToCounts(counts, "resolved", "unread", "resolved"),
    ).toEqual({ total: 9, unread: 4 });
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
  it("true bila komentar tertua kelompok lebih dari 30 hari", () => {
    const at = (iso: string | null) => ({
      oldestReceivedAt: iso ? new Date(iso) : null,
    });
    expect(hasStaleComments(at("2026-09-01"), now)).toBe(true);
    expect(hasStaleComments(at("2026-10-20"), now)).toBe(false);
    expect(hasStaleComments(at(null), now)).toBe(false);
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
