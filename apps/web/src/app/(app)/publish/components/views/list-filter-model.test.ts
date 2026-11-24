import { ContentStatus, PostCreatedVia } from "@postific/shared";
import { describe, expect, it } from "vitest";

import { SourceFilter } from "@/components/shared/source-filter";

import {
  focusAccountId,
  matchesListFilter,
  type ListFilterState,
} from "./list-filter-model";

const ALL: ListFilterState = {
  channelIds: [],
  source: SourceFilter.All,
  statuses: [],
};

const post = (
  accounts: string[],
  createdVia: PostCreatedVia = PostCreatedVia.App,
  status: ContentStatus = ContentStatus.Published,
) => ({
  createdVia,
  status,
  targets: accounts.map((connectedAccountId) => ({ connectedAccountId })),
});

describe("matchesListFilter", () => {
  it("keeps every post when no filter is set", () => {
    expect(matchesListFilter(post(["a"]), ALL)).toBe(true);
    expect(matchesListFilter({ createdVia: PostCreatedVia.Mcp }, ALL)).toBe(
      true,
    );
  });

  it("keeps a post that goes to any selected channel", () => {
    const filter = { ...ALL, channelIds: ["b", "c"] };
    expect(matchesListFilter(post(["a", "b"]), filter)).toBe(true);
    expect(matchesListFilter(post(["a"]), filter)).toBe(false);
    // A post without accounts in the list data never matches a channel.
    expect(matchesListFilter({}, filter)).toBe(false);
  });

  it("filters History by the selected statuses", () => {
    const filter = { ...ALL, statuses: [ContentStatus.Failed] };
    expect(
      matchesListFilter(
        post(["a"], PostCreatedVia.App, ContentStatus.Failed),
        filter,
      ),
    ).toBe(true);
    expect(matchesListFilter(post(["a"]), filter)).toBe(false);
  });

  it("filters by source together with channels", () => {
    const filter = {
      ...ALL,
      channelIds: ["a"],
      source: SourceFilter.Mcp,
    };
    expect(matchesListFilter(post(["a"], PostCreatedVia.Mcp), filter)).toBe(
      true,
    );
    expect(matchesListFilter(post(["a"]), filter)).toBe(false);
    expect(matchesListFilter(post(["b"], PostCreatedVia.Mcp), filter)).toBe(
      false,
    );
  });
});

describe("focusAccountId", () => {
  const targets = [{ connectedAccountId: "a" }, { connectedAccountId: "b" }];

  it("previews the first selected channel of the post", () => {
    expect(focusAccountId(targets, ["b"])).toBe("b");
  });

  it("falls back to the first account", () => {
    expect(focusAccountId(targets, [])).toBe("a");
    expect(focusAccountId(targets, ["z"])).toBe("a");
    expect(focusAccountId([], [])).toBeUndefined();
  });
});
