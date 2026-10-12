import { ContentStatus, asPostId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { HistoryItemRecord } from "../repositories/publishing.repository";
import { groupHistoryItemsByDate } from "./group-history-items";

function createHistoryItem(
  overrides: Partial<HistoryItemRecord> = {},
): HistoryItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    status: ContentStatus.Published,
    scheduledAt: null,
    publishedAt: new Date("2026-07-14T10:00:00Z"),
    createdAt: new Date("2026-07-13T00:00:00Z"),
    updatedAt: new Date("2026-07-14T10:00:00Z"),
    mediaIds: [],
    targets: [],
    ...overrides,
  };
}

describe("groupHistoryItemsByDate", () => {
  it("mengembalikan array kosong kalau tidak ada item", () => {
    expect(groupHistoryItemsByDate([])).toEqual([]);
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

    const groups = groupHistoryItemsByDate([itemA, itemB]);

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

    const groups = groupHistoryItemsByDate([itemDay1, itemDay2]);

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
    const groups = groupHistoryItemsByDate([latest, middle, earliest]);

    expect(groups.map((group) => group.date)).toEqual([
      "2026-07-15",
      "2026-07-14",
    ]);
    expect(groups[0]?.items).toEqual([latest]);
    expect(groups[1]?.items).toEqual([middle, earliest]);
  });

  it("mengelompokkan berdasar updatedAt, bukan publishedAt — post Failed tanpa publishedAt tetap terkelompok", () => {
    const failed = createHistoryItem({
      id: asPostId("post-1"),
      status: ContentStatus.Failed,
      publishedAt: null,
      updatedAt: new Date("2026-07-16T09:00:00Z"),
    });

    const groups = groupHistoryItemsByDate([failed]);

    expect(groups).toEqual([{ date: "2026-07-16", items: [failed] }]);
  });
});
