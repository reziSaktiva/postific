import { asPageCursor, type CursorPage } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  appendUnique,
  createInfiniteListState,
  infiniteListReducer,
  removeItem,
  upsertItem,
  type InfiniteListState,
} from "./infinite-list-state";

interface Row {
  id: string;
  at: number;
}

const getKey = (row: Row) => row.id;
// Newest first, id as the tie-break (same order as the repositories).
const compare = (a: Row, b: Row) => b.at - a.at || a.id.localeCompare(b.id);

const c1 = asPageCursor("c1");
const c2 = asPageCursor("c2");

function page(items: Row[], next: string | null): CursorPage<Row> {
  return { items, nextCursor: next === null ? null : asPageCursor(next) };
}

function loading(state: InfiniteListState<Row>) {
  return infiniteListReducer(state, { type: "load-start" });
}

describe("createInfiniteListState", () => {
  it("is idle when a next cursor exists and at the end when it does not", () => {
    expect(createInfiniteListState(page([], "c1")).status).toBe("idle");
    expect(createInfiniteListState(page([], null)).status).toBe("end");
  });
});

describe("infiniteListReducer", () => {
  it("appends the next page and moves the cursor", () => {
    const start = createInfiniteListState(page([{ id: "a", at: 9 }], "c1"));
    const next = infiniteListReducer(loading(start), {
      type: "load-success",
      generation: 0,
      cursor: c1,
      page: page([{ id: "b", at: 8 }], "c2"),
      getKey,
      compare,
    });
    expect(next.items.map(getKey)).toEqual(["a", "b"]);
    expect(next.nextCursor).toBe(c2);
    expect(next.status).toBe("idle");
  });

  it("reaches the end when the page has no next cursor", () => {
    const start = createInfiniteListState(page([{ id: "a", at: 9 }], "c1"));
    const next = infiniteListReducer(loading(start), {
      type: "load-success",
      generation: 0,
      cursor: c1,
      page: page([{ id: "b", at: 8 }], null),
      getKey,
      compare,
    });
    expect(next.status).toBe("end");
    expect(next.nextCursor).toBeNull();
  });

  it("does not start a second load while one is running or at the end", () => {
    const busy = loading(createInfiniteListState(page([], "c1")));
    expect(loading(busy)).toBe(busy);
    const done = createInfiniteListState(page([], null));
    expect(loading(done)).toBe(done);
  });

  it("drops a response from before a reset", () => {
    const busy = loading(
      createInfiniteListState(page([{ id: "a", at: 9 }], "c1")),
    );
    const reset = infiniteListReducer(busy, {
      type: "reset",
      page: page([{ id: "x", at: 5 }], "c1"),
    });
    const late = infiniteListReducer(reset, {
      type: "load-success",
      generation: 0,
      cursor: c1,
      page: page([{ id: "b", at: 8 }], null),
      getKey,
      compare,
    });
    expect(late).toBe(reset);
    expect(late.items.map(getKey)).toEqual(["x"]);
  });

  it("skips page items that are already loaded", () => {
    expect(
      appendUnique(
        [{ id: "a", at: 9 }],
        [
          { id: "a", at: 9 },
          { id: "b", at: 8 },
        ],
        getKey,
      ).map(getKey),
    ).toEqual(["a", "b"]);
  });

  it("keeps the cursor on failure so retry asks for the same page", () => {
    const busy = loading(
      createInfiniteListState(page([{ id: "a", at: 9 }], "c1")),
    );
    const failed = infiniteListReducer(busy, {
      type: "load-failure",
      generation: 0,
      cursor: c1,
    });
    expect(failed.status).toBe("error");
    expect(failed.nextCursor).toBe(c1);
    expect(failed.items.map(getKey)).toEqual(["a"]);
    expect(loading(failed).status).toBe("loading");
  });
});

describe("upsertItem", () => {
  const loaded: Row[] = [
    { id: "a", at: 9 },
    { id: "b", at: 7 },
  ];

  it("puts a newer item on top", () => {
    expect(
      upsertItem(loaded, { id: "n", at: 10 }, true, getKey, compare).map(
        getKey,
      ),
    ).toEqual(["n", "a", "b"]);
  });

  it("puts an item between loaded items in sort order", () => {
    expect(
      upsertItem(loaded, { id: "m", at: 8 }, true, getKey, compare).map(getKey),
    ).toEqual(["a", "m", "b"]);
  });

  it("leaves out an item past the loaded pages while more pages exist", () => {
    expect(
      upsertItem(loaded, { id: "o", at: 1 }, true, getKey, compare),
    ).toEqual(loaded);
  });

  it("appends an item past the last one when every page is loaded", () => {
    expect(
      upsertItem(loaded, { id: "o", at: 1 }, false, getKey, compare).map(
        getKey,
      ),
    ).toEqual(["a", "b", "o"]);
  });

  it("updates a loaded item without a duplicate", () => {
    const next = upsertItem(loaded, { id: "b", at: 7 }, true, getKey, compare);
    expect(next.map(getKey)).toEqual(["a", "b"]);
  });

  it("moves an updated item to its new place", () => {
    const next = upsertItem(loaded, { id: "b", at: 12 }, true, getKey, compare);
    expect(next).toEqual([
      { id: "b", at: 12 },
      { id: "a", at: 9 },
    ]);
  });
});

describe("removeItem", () => {
  it("removes by key and keeps the same array when the key is absent", () => {
    const loaded: Row[] = [
      { id: "a", at: 9 },
      { id: "b", at: 7 },
    ];
    expect(removeItem(loaded, "a", getKey).map(getKey)).toEqual(["b"]);
    expect(removeItem(loaded, "z", getKey)).toBe(loaded);
  });
});

describe("upsertItem at the edge of the loaded pages", () => {
  it("drops a middle item that moved past the last loaded item", () => {
    const loaded: Row[] = [
      { id: "a", at: 9 },
      { id: "b", at: 8 },
      { id: "c", at: 7 },
    ];
    expect(
      upsertItem(loaded, { id: "b", at: 1 }, true, getKey, compare).map(getKey),
    ).toEqual(["a", "c"]);
  });
});

describe("refresh", () => {
  const start = createInfiniteListState(page([{ id: "a", at: 9 }], "c1"));

  it("empties the list, waits for the first page, then applies it", () => {
    const busy = infiniteListReducer(start, { type: "refresh-start" });
    expect(busy.items).toEqual([]);
    expect(busy.status).toBe("loading");
    expect(busy.request).toBe("first");
    const done = infiniteListReducer(busy, {
      type: "refresh-success",
      generation: busy.generation,
      page: page([{ id: "x", at: 5 }], "f1"),
      getKey,
      compare,
    });
    expect(done.items.map(getKey)).toEqual(["x"]);
    expect(done.status).toBe("idle");
    expect(done.request).toBe("next");
  });

  it("ignores an older refresh that resolves after a newer one", () => {
    const first = infiniteListReducer(start, { type: "refresh-start" });
    const second = infiniteListReducer(first, { type: "refresh-start" });
    const late = infiniteListReducer(second, {
      type: "refresh-success",
      generation: first.generation,
      page: page([{ id: "old", at: 5 }], null),
      getKey,
      compare,
    });
    expect(late).toBe(second);
  });

  it("drops a next page that was on its way when the refresh started", () => {
    const busy = loading(start);
    const refreshing = infiniteListReducer(busy, { type: "refresh-start" });
    const late = infiniteListReducer(refreshing, {
      type: "load-success",
      generation: busy.generation,
      cursor: c1,
      page: page([{ id: "b", at: 8 }], null),
      getKey,
      compare,
    });
    expect(late).toBe(refreshing);
  });

  it("shows the error state when the refresh fails, and a next-page load cannot start", () => {
    const busy = infiniteListReducer(start, { type: "refresh-start" });
    const failed = infiniteListReducer(busy, {
      type: "refresh-failure",
      generation: busy.generation,
    });
    expect(failed.status).toBe("error");
    expect(failed.request).toBe("first");
    expect(loading(failed)).toBe(failed);
  });
});

describe("realtime changes while a page is on its way", () => {
  const start = createInfiniteListState(
    page(
      [
        { id: "a", at: 9 },
        { id: "b", at: 8 },
      ],
      "c1",
    ),
  );

  function arrive(state: InfiniteListState<Row>, items: Row[]) {
    return infiniteListReducer(state, {
      type: "load-success",
      generation: state.generation,
      cursor: c1,
      page: page(items, null),
      getKey,
      compare,
    });
  }

  it("does not bring back an item removed while the page was loading", () => {
    const busy = infiniteListReducer(loading(start), {
      type: "remove",
      key: "c",
      getKey,
    });
    const done = arrive(busy, [
      { id: "c", at: 7 },
      { id: "d", at: 6 },
    ]);
    expect(done.items.map(getKey)).toEqual(["a", "b", "d"]);
  });

  it("keeps the newer upserted version instead of the page's copy", () => {
    const busy = infiniteListReducer(loading(start), {
      type: "upsert",
      item: { id: "c", at: 6.5 },
      getKey,
      compare,
    });
    // `c` sorted past the loaded items, so it waits for the page.
    expect(busy.items.map(getKey)).toEqual(["a", "b"]);
    const done = arrive(busy, [
      { id: "c", at: 7 },
      { id: "d", at: 6 },
    ]);
    expect(done.items).toEqual([
      { id: "a", at: 9 },
      { id: "b", at: 8 },
      { id: "c", at: 6.5 },
      { id: "d", at: 6 },
    ]);
  });

  it("keeps a loaded item's newer version when the page repeats it", () => {
    const busy = infiniteListReducer(loading(start), {
      type: "upsert",
      item: { id: "b", at: 8, edited: true } as Row,
      getKey,
      compare,
    });
    const done = arrive(busy, [{ id: "b", at: 8 }]);
    expect(done.items[1]).toEqual({ id: "b", at: 8, edited: true });
  });

  it("clears the tracking on success, failure and reset", () => {
    const tracked = infiniteListReducer(loading(start), {
      type: "remove",
      key: "z",
      getKey,
    });
    expect(tracked.removedWhileLoading.size).toBe(1);
    expect(arrive(tracked, []).removedWhileLoading.size).toBe(0);
    const failed = infiniteListReducer(tracked, {
      type: "load-failure",
      generation: tracked.generation,
      cursor: c1,
    });
    expect(failed.removedWhileLoading.size).toBe(0);
    const reset = infiniteListReducer(tracked, {
      type: "reset",
      page: page([], null),
    });
    expect(reset.removedWhileLoading.size).toBe(0);
  });

  it("does not track changes when nothing is loading", () => {
    const next = infiniteListReducer(start, {
      type: "remove",
      key: "a",
      getKey,
    });
    expect(next.items.map(getKey)).toEqual(["b"]);
    expect(next.removedWhileLoading.size).toBe(0);
  });
});
