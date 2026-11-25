import { ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  boardColumnOf,
  compareBoardCards,
  isBoardColumnKey,
} from "./group-board-columns";

const d = (iso: string) => new Date(iso);
const card = (
  id: string,
  status: ContentStatus,
  over: Partial<{
    scheduledAt: Date | null;
    publishedAt: Date | null;
    updatedAt: Date;
  }> = {},
) => ({
  id,
  status,
  scheduledAt: null,
  publishedAt: null,
  updatedAt: d("2026-11-01T00:00:00Z"),
  ...over,
});

describe("boardColumnOf", () => {
  it.each([
    [ContentStatus.Draft, "draft"],
    [ContentStatus.ReadyToSchedule, "draft"],
    [ContentStatus.InReview, "approvals"],
    [ContentStatus.Scheduled, "scheduled"],
    [ContentStatus.Published, "published"],
    [ContentStatus.Imported, "published"],
    [ContentStatus.Failed, "failed"],
  ])("%s goes to %s", (status, column) => {
    expect(boardColumnOf(status)).toBe(column);
  });
});

describe("isBoardColumnKey", () => {
  it("accepts the five columns only", () => {
    expect(isBoardColumnKey("published")).toBe(true);
    expect(isBoardColumnKey("history")).toBe(false);
    expect(isBoardColumnKey(undefined)).toBe(false);
  });
});

describe("compareBoardCards", () => {
  const sortIds = (
    key: Parameters<typeof compareBoardCards>[0],
    items: ReturnType<typeof card>[],
  ) => [...items].sort(compareBoardCards(key)).map((item) => item.id);

  it("orders Scheduled by publish time, soonest first, id as tie-breaker", () => {
    expect(
      sortIds("scheduled", [
        card("b", ContentStatus.Scheduled, {
          scheduledAt: d("2026-11-03T00:00:00Z"),
        }),
        card("c", ContentStatus.Scheduled, {
          scheduledAt: d("2026-11-02T00:00:00Z"),
        }),
        card("a", ContentStatus.Scheduled, {
          scheduledAt: d("2026-11-03T00:00:00Z"),
        }),
      ]),
    ).toEqual(["c", "a", "b"]);
  });

  it("orders Published by publish time, newest first, falling back to the last edit", () => {
    expect(
      sortIds("published", [
        card("old", ContentStatus.Published, {
          publishedAt: d("2026-11-01T00:00:00Z"),
        }),
        card("imported", ContentStatus.Imported, {
          updatedAt: d("2026-11-05T00:00:00Z"),
        }),
        card("new", ContentStatus.Published, {
          publishedAt: d("2026-11-04T00:00:00Z"),
        }),
      ]),
    ).toEqual(["imported", "new", "old"]);
  });

  it("orders the other columns by last edit, newest first, id descending on a tie", () => {
    expect(
      sortIds("draft", [
        card("a", ContentStatus.Draft),
        card("c", ContentStatus.Draft),
        card("b", ContentStatus.Draft, {
          updatedAt: d("2026-11-02T00:00:00Z"),
        }),
      ]),
    ).toEqual(["b", "c", "a"]);
  });
});
