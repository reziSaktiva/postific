import { describe, expect, it } from "vitest";

import { asPageCursor } from "@postific/shared";

import { mergeRevalidatedPage } from "./revalidated-page-merge";

interface Card {
  id: string;
  rank: number;
}
const card = (id: string, rank: number): Card => ({ id, rank });
const compare = (a: Card, b: Card) => a.rank - b.rank;
const more = asPageCursor("more");

describe("mergeRevalidatedPage (S-009 Board reload, T-308 List tabs)", () => {
  it("keeps loaded pages past the new first page and upserts the first page", () => {
    const loaded = [card("a", 1), card("b", 2), card("c", 3), card("d", 4)];
    const result = mergeRevalidatedPage({
      loaded,
      page: { items: [card("a", 1), card("b", 2)], nextCursor: more },
      movedToOtherColumn: new Set(),
      compare,
    });
    expect(result.removes).toEqual([]);
    expect(result.upserts.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("removes a card that moved to another column, even past the first page", () => {
    const loaded = [card("a", 1), card("b", 2), card("x", 30)];
    const result = mergeRevalidatedPage({
      loaded,
      page: { items: [card("a", 1), card("b", 2)], nextCursor: more },
      movedToOtherColumn: new Set(["x"]),
      compare,
    });
    expect(result.removes).toEqual(["x"]);
  });

  it("removes a card that sorts inside the new first page but is not on it", () => {
    const loaded = [card("a", 1), card("gone", 2), card("c", 3), card("z", 9)];
    const result = mergeRevalidatedPage({
      loaded,
      page: { items: [card("a", 1), card("c", 3)], nextCursor: more },
      movedToOtherColumn: new Set(),
      compare,
    });
    expect(result.removes).toEqual(["gone"]);
  });

  it("removes every missing card when the new first page is the whole column", () => {
    const loaded = [card("a", 1), card("gone", 50)];
    const result = mergeRevalidatedPage({
      loaded,
      page: { items: [card("a", 1)], nextCursor: null },
      movedToOtherColumn: new Set(),
      compare,
    });
    expect(result.removes).toEqual(["gone"]);
  });

  it("drops a deleted item from a List tab, which has no other columns (T-308)", () => {
    const loaded = [card("deleted", 1), card("b", 2), card("c", 3)];
    const result = mergeRevalidatedPage({
      loaded,
      page: { items: [card("b", 2), card("c", 3)], nextCursor: null },
      compare,
    });
    expect(result.removes).toEqual(["deleted"]);
    expect(result.upserts.map((c) => c.id)).toEqual(["b", "c"]);
  });
});
