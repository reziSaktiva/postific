import {
  ContentStatus,
  asPostId,
  asUserId,
  PostCreatedVia,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { groupHistoryItemsByDate, toDateKey } from "@/domains/publishing";
import type { HistoryItemRecord } from "@/domains/publishing";
import {
  historyListClockDate,
  historyListShowsPublishMeta,
} from "./history-list-row";

function createHistoryItem(
  overrides: Partial<HistoryItemRecord> = {},
): HistoryItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    status: ContentStatus.Published,
    scheduledAt: null,
    publishedAt: new Date("2026-09-01T17:59:00Z"),
    failedAt: null,
    createdAt: new Date("2026-09-01T17:59:00Z"),
    updatedAt: new Date("2026-10-19T07:49:00Z"),
    mediaIds: [],
    authorId: asUserId("user-1"),
    targets: [],
    createdVia: PostCreatedVia.App,
    createdViaClientId: null,
    createdViaClientName: null,
    ...overrides,
  };
}

describe("history list row", () => {
  it("jam kartu Imported mengikuti publishedAt dan satu tanggal dengan kelompok", () => {
    const item = createHistoryItem({
      status: ContentStatus.Imported,
      authorId: null,
    });
    const [group] = groupHistoryItemsByDate([item], "Asia/Jakarta");

    expect(group?.date).toBe("2026-09-02"); // 17:59Z = 00:59 WIB (T-144)
    expect(toDateKey(historyListClockDate(item), "Asia/Jakarta")).toBe(
      group?.date,
    );
    expect(historyListShowsPublishMeta(item.status)).toBe(true);
  });

  it("Published dan Imported memakai meta sukses, Failed memakai jalur error", () => {
    expect(historyListShowsPublishMeta(ContentStatus.Published)).toBe(true);
    expect(historyListShowsPublishMeta(ContentStatus.Imported)).toBe(true);
    expect(historyListShowsPublishMeta(ContentStatus.Failed)).toBe(false);
  });
});
