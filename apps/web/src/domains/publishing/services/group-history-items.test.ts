import { ContentStatus, asPostId, asUserId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { HistoryItemRecord } from "../repositories/publishing.repository";
import {
  compareHistoryItemsDesc,
  groupHistoryItemsByDate,
  historyItemOccurredAt,
} from "./group-history-items";

const WIB = "Asia/Jakarta";

function createHistoryItem(
  overrides: Partial<HistoryItemRecord> = {},
): HistoryItemRecord {
  const updatedAt = overrides.updatedAt ?? new Date("2026-07-14T10:00:00Z");
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    status: ContentStatus.Published,
    scheduledAt: null,
    publishedAt: updatedAt,
    failedAt: null,
    createdAt: new Date("2026-07-13T00:00:00Z"),
    updatedAt,
    mediaIds: [],
    authorId: asUserId("user-1"),
    targets: [],
    ...overrides,
  };
}

describe("groupHistoryItemsByDate", () => {
  it("mengembalikan array kosong kalau tidak ada item", () => {
    expect(groupHistoryItemsByDate([], WIB)).toEqual([]);
  });

  it("mengelompokkan beberapa item dalam satu tanggal updatedAt yang sama ke satu grup", () => {
    const itemA = createHistoryItem({
      id: asPostId("post-1"),
      updatedAt: new Date("2026-07-14T09:00:00Z"),
    });
    const itemB = createHistoryItem({
      id: asPostId("post-2"),
      updatedAt: new Date("2026-07-14T15:00:00Z"),
    });

    const groups = groupHistoryItemsByDate([itemA, itemB], WIB);

    expect(groups).toEqual([
      {
        date: "2026-07-14",
        items: [itemA, itemB],
      },
    ]);
  });

  it("mengelompokkan item ke beberapa grup terpisah kalau tanggal updatedAt-nya berbeda", () => {
    const itemDay1 = createHistoryItem({
      id: asPostId("post-1"),
      updatedAt: new Date("2026-07-14T09:00:00Z"),
    });
    const itemDay2 = createHistoryItem({
      id: asPostId("post-2"),
      updatedAt: new Date("2026-07-15T09:00:00Z"),
    });

    const groups = groupHistoryItemsByDate([itemDay1, itemDay2], WIB);

    expect(groups).toEqual([
      { date: "2026-07-14", items: [itemDay1] },
      { date: "2026-07-15", items: [itemDay2] },
    ]);
  });

  it("mempertahankan urutan dari input — tidak mengurutkan ulang", () => {
    const latest = createHistoryItem({
      id: asPostId("post-1"),
      updatedAt: new Date("2026-07-15T09:00:00Z"),
    });
    const middle = createHistoryItem({
      id: asPostId("post-2"),
      updatedAt: new Date("2026-07-14T12:00:00Z"),
    });
    const earliest = createHistoryItem({
      id: asPostId("post-3"),
      updatedAt: new Date("2026-07-14T09:00:00Z"),
    });

    // Urutan input meniru kontrak repository: descending `updatedAt`.
    const groups = groupHistoryItemsByDate([latest, middle, earliest], WIB);

    expect(groups.map((group) => group.date)).toEqual([
      "2026-07-15",
      "2026-07-14",
    ]);
    expect(groups[0]?.items).toEqual([latest]);
    expect(groups[1]?.items).toEqual([middle, earliest]);
  });

  it("post Failed tanpa publishedAt dikelompokkan berdasar failedAt", () => {
    const failed = createHistoryItem({
      id: asPostId("post-1"),
      status: ContentStatus.Failed,
      publishedAt: null,
      failedAt: new Date("2026-07-10T09:00:00Z"),
      updatedAt: new Date("2026-07-16T09:00:00Z"),
    });

    expect(groupHistoryItemsByDate([failed], WIB)).toEqual([
      { date: "2026-07-10", items: [failed] },
    ]);
  });

  it("Imported lintas tanggal dikelompokkan per publishedAt, bukan waktu import (updatedAt sama)", () => {
    const importAt = new Date("2026-10-19T07:49:00Z");
    const a = createHistoryItem({
      id: asPostId("a"),
      status: ContentStatus.Imported,
      authorId: null,
      publishedAt: new Date("2026-09-02T10:00:00Z"),
      updatedAt: importAt,
    });
    const b = createHistoryItem({
      id: asPostId("b"),
      status: ContentStatus.Imported,
      authorId: null,
      publishedAt: new Date("2026-08-15T10:00:00Z"),
      updatedAt: importAt,
    });

    expect(groupHistoryItemsByDate([a, b], WIB)).toEqual([
      { date: "2026-09-02", items: [a] },
      { date: "2026-08-15", items: [b] },
    ]);
  });

  it("publishedAt null (bukan Failed) jatuh ke updatedAt", () => {
    const item = createHistoryItem({
      publishedAt: null,
      updatedAt: new Date("2026-07-20T09:00:00Z"),
    });
    expect(groupHistoryItemsByDate([item], WIB)[0]?.date).toBe("2026-07-20");
  });

  it("Failed tanpa failedAt jatuh ke updatedAt", () => {
    const item = createHistoryItem({
      status: ContentStatus.Failed,
      publishedAt: null,
      failedAt: null,
      updatedAt: new Date("2026-07-21T09:00:00Z"),
    });
    expect(historyItemOccurredAt(item).toISOString()).toBe(
      "2026-07-21T09:00:00.000Z",
    );
  });

  it("campuran Imported/Published/Failed: urutan compareHistoryItemsDesc konsisten dengan grup", () => {
    const published = createHistoryItem({
      id: asPostId("pub"),
      publishedAt: new Date("2026-10-10T08:00:00Z"),
      updatedAt: new Date("2026-10-10T08:00:30Z"),
    });
    const imported = createHistoryItem({
      id: asPostId("imp"),
      status: ContentStatus.Imported,
      authorId: null,
      publishedAt: new Date("2026-10-12T08:00:00Z"),
      updatedAt: new Date("2026-10-19T07:49:00Z"),
    });
    const failed = createHistoryItem({
      id: asPostId("fail"),
      status: ContentStatus.Failed,
      publishedAt: null,
      failedAt: new Date("2026-10-11T08:00:00Z"),
      updatedAt: new Date("2026-10-11T08:00:05Z"),
    });
    const sorted = [published, imported, failed].sort(compareHistoryItemsDesc);

    expect(sorted.map((i) => i.id)).toEqual(["imp", "fail", "pub"]);
    expect(groupHistoryItemsByDate(sorted, WIB).map((g) => g.date)).toEqual([
      "2026-10-12",
      "2026-10-11",
      "2026-10-10",
    ]);
  });

  it("compareHistoryItemsDesc: tie-breaker updatedAt lalu id, deterministik", () => {
    const t = new Date("2026-10-10T08:00:00Z");
    const x = createHistoryItem({
      id: asPostId("x"),
      publishedAt: t,
      updatedAt: new Date("2026-10-10T09:00:00Z"),
    });
    const y = createHistoryItem({
      id: asPostId("y"),
      publishedAt: t,
      updatedAt: new Date("2026-10-10T09:00:00Z"),
    });
    const z = createHistoryItem({
      id: asPostId("z"),
      publishedAt: t,
      updatedAt: new Date("2026-10-10T10:00:00Z"),
    });
    expect([x, y, z].sort(compareHistoryItemsDesc).map((i) => i.id)).toEqual([
      "z",
      "y",
      "x",
    ]);
  });

  it("batas hari WIB (T-144): 17:59Z masuk 2 September, 16:59Z masih 1 September", () => {
    const afterMidnight = createHistoryItem({
      id: asPostId("after"),
      publishedAt: new Date("2026-09-01T17:59:00Z"),
    });
    const beforeMidnight = createHistoryItem({
      id: asPostId("before"),
      publishedAt: new Date("2026-09-01T16:59:00Z"),
    });

    expect(
      groupHistoryItemsByDate([afterMidnight, beforeMidnight], WIB),
    ).toEqual([
      { date: "2026-09-02", items: [afterMidnight] },
      { date: "2026-09-01", items: [beforeMidnight] },
    ]);
  });

  it("zona pengguna menentukan kunci grup (T-147)", () => {
    const late = createHistoryItem({
      id: asPostId("late"),
      publishedAt: new Date("2026-09-02T05:00:00Z"),
    });
    const early = createHistoryItem({
      id: asPostId("early"),
      publishedAt: new Date("2026-09-02T03:30:00Z"),
    });

    // New_York (EDT): 01:00 2 Sep dan 23:30 1 Sep
    expect(groupHistoryItemsByDate([late, early], "America/New_York")).toEqual([
      { date: "2026-09-02", items: [late] },
      { date: "2026-09-01", items: [early] },
    ]);
    // Kolkata (UTC+5:30): 10:30 dan 09:00, sama-sama 2 Sep
    expect(groupHistoryItemsByDate([late, early], "Asia/Kolkata")).toEqual([
      { date: "2026-09-02", items: [late, early] },
    ]);
  });
});
