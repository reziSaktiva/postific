import { ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  boardColumnOf,
  groupBoardColumns,
  type BoardColumn,
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

const ids = (columns: BoardColumn<{ id: string }>[], key: string) =>
  columns.find((column) => column.key === key)?.items.map((i) => i.id);

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

describe("groupBoardColumns", () => {
  it("always returns the five columns in order, empty ones included", () => {
    const columns = groupBoardColumns([]);

    expect(columns.map((c) => c.key)).toEqual([
      "draft",
      "approvals",
      "scheduled",
      "published",
      "failed",
    ]);
    expect(columns.every((c) => c.items.length === 0 && c.total === 0)).toBe(
      true,
    );
  });

  it("puts Ready to Schedule cards in Draft next to Draft cards", () => {
    const columns = groupBoardColumns([
      card("a", ContentStatus.Draft),
      card("b", ContentStatus.ReadyToSchedule),
      card("c", ContentStatus.InReview),
    ]);

    expect(ids(columns, "draft")?.sort()).toEqual(["a", "b"]);
    expect(ids(columns, "approvals")).toEqual(["c"]);
  });

  it("orders Scheduled soonest first, Published newest first, Draft by last edit", () => {
    const columns = groupBoardColumns([
      card("later", ContentStatus.Scheduled, {
        scheduledAt: d("2026-12-05T00:00:00Z"),
      }),
      card("sooner", ContentStatus.Scheduled, {
        scheduledAt: d("2026-12-01T00:00:00Z"),
      }),
      card("old", ContentStatus.Published, {
        publishedAt: d("2026-10-01T00:00:00Z"),
      }),
      card("new", ContentStatus.Imported, {
        publishedAt: d("2026-11-10T00:00:00Z"),
      }),
      card("stale", ContentStatus.Draft, {
        updatedAt: d("2026-10-01T00:00:00Z"),
      }),
      card("fresh", ContentStatus.Draft, {
        updatedAt: d("2026-11-20T00:00:00Z"),
      }),
    ]);

    expect(ids(columns, "scheduled")).toEqual(["sooner", "later"]);
    expect(ids(columns, "published")).toEqual(["new", "old"]);
    expect(ids(columns, "draft")).toEqual(["fresh", "stale"]);
  });

  it("cuts a column at the limit and says there is more, counting what was given", () => {
    const failed = ["1", "2", "3"].map((id) => card(id, ContentStatus.Failed));

    const column = groupBoardColumns(failed, 2).find((c) => c.key === "failed");

    expect(column).toMatchObject({ total: 3, hasMore: true });
    expect(column?.items).toHaveLength(2);
  });
});
