import { asPostId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { QueueItemRecord } from "../repositories/publishing.repository";
import { groupQueueItemsByDate } from "./group-queue-items";

function createQueueItem(
  overrides: Partial<QueueItemRecord> = {},
): QueueItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    scheduledAt: new Date("2026-07-14T10:00:00Z"),
    createdAt: new Date("2026-07-13T00:00:00Z"),
    targets: [],
    ...overrides,
  };
}

describe("groupQueueItemsByDate", () => {
  it("mengembalikan array kosong kalau tidak ada item", () => {
    expect(groupQueueItemsByDate([])).toEqual([]);
  });

  it("mengelompokkan beberapa item dalam satu tanggal yang sama ke satu grup", () => {
    const itemA = createQueueItem({
      id: asPostId("post-1"),
      scheduledAt: new Date("2026-07-14T09:00:00Z"),
    });
    const itemB = createQueueItem({
      id: asPostId("post-2"),
      scheduledAt: new Date("2026-07-14T15:00:00Z"),
    });

    const groups = groupQueueItemsByDate([itemA, itemB]);

    expect(groups).toEqual([
      {
        date: "2026-07-14",
        items: [itemA, itemB],
      },
    ]);
  });

  it("mengelompokkan item ke beberapa grup terpisah kalau tanggalnya berbeda", () => {
    const itemDay1 = createQueueItem({
      id: asPostId("post-1"),
      scheduledAt: new Date("2026-07-14T09:00:00Z"),
    });
    const itemDay2 = createQueueItem({
      id: asPostId("post-2"),
      scheduledAt: new Date("2026-07-15T09:00:00Z"),
    });

    const groups = groupQueueItemsByDate([itemDay1, itemDay2]);

    expect(groups).toEqual([
      { date: "2026-07-14", items: [itemDay1] },
      { date: "2026-07-15", items: [itemDay2] },
    ]);
  });

  it("mempertahankan urutan ascending dari input — tidak mengurutkan ulang", () => {
    const earliest = createQueueItem({
      id: asPostId("post-1"),
      scheduledAt: new Date("2026-07-14T09:00:00Z"),
    });
    const middle = createQueueItem({
      id: asPostId("post-2"),
      scheduledAt: new Date("2026-07-14T12:00:00Z"),
    });
    const latestNextDay = createQueueItem({
      id: asPostId("post-3"),
      scheduledAt: new Date("2026-07-15T08:00:00Z"),
    });

    const groups = groupQueueItemsByDate([earliest, middle, latestNextDay]);

    expect(groups.map((group) => group.date)).toEqual([
      "2026-07-14",
      "2026-07-15",
    ]);
    expect(groups[0]?.items).toEqual([earliest, middle]);
    expect(groups[1]?.items).toEqual([latestNextDay]);
  });
});
