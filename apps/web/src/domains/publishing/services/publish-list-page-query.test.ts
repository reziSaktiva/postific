import { asPageCursor, ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  buildBoardColumnPageSearch,
  buildPublishListPageSearch,
  EMPTY_PUBLISH_LIST_FILTER,
  InvalidPublishPageQueryError,
  isEmptyPublishListFilter,
  parseBoardColumnPageQuery,
  parsePublishListPageQuery,
  publishTabSelection,
} from "./publish-list-page-query";

const ACC = "0b6f1d6e-3c1a-4d2b-9f4e-1a2b3c4d5e6f";
const params = (search: string) => new URLSearchParams(search.slice(1));

describe("publishTabSelection (S-009)", () => {
  it("maps each tab to its statuses and order", () => {
    const pick = (tab: Parameters<typeof publishTabSelection>[0]) => {
      const selection = publishTabSelection(tab, EMPTY_PUBLISH_LIST_FILTER);
      return [selection?.statuses, selection?.order];
    };
    expect(pick("queue")).toEqual([[ContentStatus.Scheduled], "scheduled-asc"]);
    expect(pick("drafts")).toEqual([
      [ContentStatus.Draft, ContentStatus.ReadyToSchedule],
      "updated-desc",
    ]);
    expect(pick("approvals")).toEqual([
      [ContentStatus.InReview],
      "updated-desc",
    ]);
    expect(pick("history")).toEqual([
      [ContentStatus.Published, ContentStatus.Failed, ContentStatus.Imported],
      "occurred-desc",
    ]);
  });

  it("keeps only History statuses from the status filter; none left means an empty tab", () => {
    expect(
      publishTabSelection("history", {
        ...EMPTY_PUBLISH_LIST_FILTER,
        statuses: [ContentStatus.Failed, ContentStatus.Draft],
      })?.statuses,
    ).toEqual([ContentStatus.Failed]);
    expect(
      publishTabSelection("history", {
        ...EMPTY_PUBLISH_LIST_FILTER,
        statuses: [ContentStatus.Draft],
      }),
    ).toBeNull();
  });

  it("applies channels except on Drafts, and the source everywhere", () => {
    const filter = { channelIds: [ACC], source: "mcp" as const, statuses: [] };
    expect(publishTabSelection("queue", filter)).toMatchObject({
      connectedAccountIds: [ACC],
      source: "mcp",
    });
    expect(publishTabSelection("drafts", filter)).toMatchObject({
      connectedAccountIds: [],
      source: "mcp",
    });
  });
});

describe("List page query string", () => {
  it("round-trips tab, filter, cursor and count", () => {
    const search = buildPublishListPageSearch({
      tab: "history",
      filter: {
        channelIds: [ACC],
        source: "manual",
        statuses: [ContentStatus.Published],
      },
      cursor: asPageCursor("abc"),
      countOnly: true,
    });
    expect(parsePublishListPageQuery(params(search))).toEqual({
      tab: "history",
      filter: {
        channelIds: [ACC],
        source: "manual",
        statuses: [ContentStatus.Published],
      },
      cursor: "abc",
      countOnly: true,
    });
  });

  it("reads a first page without a cursor and with the default filter", () => {
    const query = parsePublishListPageQuery(
      params(
        buildPublishListPageSearch({
          tab: "queue",
          filter: EMPTY_PUBLISH_LIST_FILTER,
        }),
      ),
    );
    expect(query.cursor).toBeNull();
    expect(query.countOnly).toBe(false);
    expect(isEmptyPublishListFilter(query.filter)).toBe(true);
  });

  it.each([
    ["?tab=calendar", "tab"],
    ["?tab=queue&channels=not-a-uuid", "channels"],
    ["?tab=queue&source=robots", "source"],
    ["?tab=history&statuses=deleted", "statuses"],
    [`?tab=queue&cursor=${"x".repeat(2000)}`, "cursor"],
  ])("rejects %s", (search) => {
    expect(() => parsePublishListPageQuery(params(search))).toThrow(
      InvalidPublishPageQueryError,
    );
  });
});

describe("Board column page query string", () => {
  it("round-trips the column and cursor", () => {
    const search = buildBoardColumnPageSearch({
      column: "published",
      cursor: asPageCursor("c1"),
    });
    expect(parseBoardColumnPageQuery(params(search))).toEqual({
      column: "published",
      cursor: "c1",
    });
  });

  it("needs a known column and a cursor", () => {
    expect(() =>
      parseBoardColumnPageQuery(params("?column=x&cursor=c")),
    ).toThrow(InvalidPublishPageQueryError);
    expect(() => parseBoardColumnPageQuery(params("?column=draft"))).toThrow(
      InvalidPublishPageQueryError,
    );
  });
});
