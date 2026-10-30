import { asPostId, PostCreatedVia } from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { QueueItemRecord } from "../repositories/publishing.repository";
import { groupQueueItemsByDate } from "./group-queue-items";

const WIB = "Asia/Jakarta";

function createQueueItem(
  overrides: Partial<QueueItemRecord> = {},
): QueueItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    scheduledAt: new Date("2026-07-14T10:00:00Z"),
    createdAt: new Date("2026-07-13T00:00:00Z"),
    targets: [],
    createdVia: PostCreatedVia.App,
    createdViaClientId: null,
    createdViaClientName: null,
    ...overrides,
  };
}

describe("groupQueueItemsByDate", () => {
  it("mengembalikan array kosong kalau tidak ada item", () => {
    expect(groupQueueItemsByDate([], WIB)).toEqual([]);
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

    const groups = groupQueueItemsByDate([itemA, itemB], WIB);

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

    const groups = groupQueueItemsByDate([itemDay1, itemDay2], WIB);

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

    const groups = groupQueueItemsByDate(
      [earliest, middle, latestNextDay],
      WIB,
    );

    expect(groups.map((group) => group.date)).toEqual([
      "2026-07-14",
      "2026-07-15",
    ]);
    expect(groups[0]?.items).toEqual([earliest, middle]);
    expect(groups[1]?.items).toEqual([latestNextDay]);
  });

  it("batas hari WIB (T-144): 17:59Z masuk 2 September, 16:59Z masih 1 September", () => {
    const beforeMidnight = createQueueItem({
      id: asPostId("before"),
      scheduledAt: new Date("2026-09-01T16:59:00Z"),
    });
    const afterMidnight = createQueueItem({
      id: asPostId("after"),
      scheduledAt: new Date("2026-09-01T17:59:00Z"),
    });

    expect(groupQueueItemsByDate([beforeMidnight, afterMidnight], WIB)).toEqual(
      [
        { date: "2026-09-01", items: [beforeMidnight] },
        { date: "2026-09-02", items: [afterMidnight] },
      ],
    );
  });

  it("zona pengguna menentukan kunci grup (T-147): sama instan, tanggal beda per zona", () => {
    const a = createQueueItem({
      id: asPostId("a"),
      scheduledAt: new Date("2026-09-02T03:30:00Z"),
    });
    const b = createQueueItem({
      id: asPostId("b"),
      scheduledAt: new Date("2026-09-02T05:00:00Z"),
    });

    // New_York (EDT): 23:30 1 Sep dan 01:00 2 Sep -> dua grup
    expect(groupQueueItemsByDate([a, b], "America/New_York")).toEqual([
      { date: "2026-09-01", items: [a] },
      { date: "2026-09-02", items: [b] },
    ]);
    // WIB: keduanya 2 Sep -> satu grup
    expect(groupQueueItemsByDate([a, b], WIB)).toEqual([
      { date: "2026-09-02", items: [a, b] },
    ]);
  });
});
