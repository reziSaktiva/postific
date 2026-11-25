// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import {
  asPageCursor,
  type CursorPage,
  type PageCursor,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";

import { useInfiniteList } from "./useInfiniteList";

interface Row {
  id: string;
  at: number;
}

const getKey = (row: Row) => row.id;
const compare = (a: Row, b: Row) => b.at - a.at || a.id.localeCompare(b.id);

function page(items: Row[], next: string | null): CursorPage<Row> {
  return { items, nextCursor: next === null ? null : asPageCursor(next) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(
  loadPage: (cursor: PageCursor) => Promise<CursorPage<Row>>,
  initialPage = page(
    [
      { id: "a", at: 9 },
      { id: "b", at: 8 },
    ],
    "c1",
  ),
) {
  return renderHook(() =>
    useInfiniteList({ initialPage, loadPage, getKey, compare }),
  );
}

describe("useInfiniteList", () => {
  it("appends the next page and advances the cursor", async () => {
    const loadPage = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: "c", at: 7 }], "c2"));
    const { result } = setup(loadPage);

    await act(async () => result.current.loadMore());

    expect(loadPage).toHaveBeenCalledWith("c1");
    expect(result.current.items.map(getKey)).toEqual(["a", "b", "c"]);
    expect(result.current.nextCursor).toBe("c2");
    expect(result.current.status).toBe("idle");
  });

  it("ends when the next cursor is null and stops loading", async () => {
    const loadPage = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: "c", at: 7 }], null));
    const { result } = setup(loadPage);

    await act(async () => result.current.loadMore());
    expect(result.current.status).toBe("end");

    await act(async () => result.current.loadMore());
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it("does not start a second request while one is on its way", async () => {
    const pending = deferred<CursorPage<Row>>();
    const loadPage = vi.fn().mockReturnValue(pending.promise);
    const { result } = setup(loadPage);

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(result.current.status).toBe("loading");
    act(() => result.current.loadMore());
    expect(loadPage).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(page([{ id: "c", at: 7 }], "c2")));
    expect(result.current.items.map(getKey)).toEqual(["a", "b", "c"]);
  });

  it("shows an error, keeps the items, and retries the same cursor", async () => {
    const loadPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([{ id: "c", at: 7 }], null));
    const { result } = setup(loadPage);

    await act(async () => result.current.loadMore());
    expect(result.current.status).toBe("error");
    expect(result.current.items.map(getKey)).toEqual(["a", "b"]);

    // The sentinel is gone in the error state; loadMore must not retry on its own.
    await act(async () => result.current.loadMore());
    expect(loadPage).toHaveBeenCalledTimes(1);

    await act(async () => result.current.retry());
    expect(loadPage).toHaveBeenNthCalledWith(2, "c1");
    expect(result.current.items.map(getKey)).toEqual(["a", "b", "c"]);
    expect(result.current.status).toBe("end");
  });

  it("treats a loadPage that throws synchronously as a failed page", async () => {
    const loadPage = vi.fn(() => {
      throw new Error("boom");
    });
    const { result } = setup(loadPage);

    await act(async () => result.current.loadMore());
    expect(result.current.status).toBe("error");
  });

  it("reset drops a page that was still on its way", async () => {
    const stale = deferred<CursorPage<Row>>();
    const loadPage = vi
      .fn()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(page([{ id: "y", at: 4 }], null));
    const { result } = setup(loadPage);

    act(() => result.current.loadMore());
    act(() => result.current.reset(page([{ id: "x", at: 5 }], "f1")));
    expect(result.current.status).toBe("idle");

    // The new filter can load right away, without waiting for the stale one.
    await act(async () => result.current.loadMore());
    expect(loadPage).toHaveBeenNthCalledWith(2, "f1");

    await act(async () => stale.resolve(page([{ id: "c", at: 7 }], "c2")));
    expect(result.current.items.map(getKey)).toEqual(["x", "y"]);
    expect(result.current.status).toBe("end");
  });

  it("merges realtime items without duplicates and in sort order", () => {
    const { result } = setup(vi.fn());

    act(() => result.current.upsert({ id: "n", at: 10 }));
    expect(result.current.items.map(getKey)).toEqual(["n", "a", "b"]);

    act(() => result.current.upsert({ id: "n", at: 10 }));
    expect(result.current.items.map(getKey)).toEqual(["n", "a", "b"]);

    act(() => result.current.upsert({ id: "old", at: 1 }));
    expect(result.current.items.map(getKey)).toEqual(["n", "a", "b"]);

    act(() => result.current.remove("a"));
    expect(result.current.items.map(getKey)).toEqual(["n", "b"]);
  });
});

describe("useInfiniteList refresh", () => {
  it("keeps filter B when filter A's first page arrives last", async () => {
    const pageA = deferred<CursorPage<Row>>();
    const pageB = deferred<CursorPage<Row>>();
    const { result } = setup(vi.fn());

    act(() => result.current.refresh(() => pageA.promise));
    expect(result.current.status).toBe("loading");
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.items).toEqual([]);

    act(() => result.current.refresh(() => pageB.promise));
    await act(async () => pageB.resolve(page([{ id: "b1", at: 5 }], "b-c1")));
    await act(async () => pageA.resolve(page([{ id: "a1", at: 6 }], null)));

    expect(result.current.items.map(getKey)).toEqual(["b1"]);
    expect(result.current.nextCursor).toBe("b-c1");
    expect(result.current.isRefreshing).toBe(false);
  });

  it("shows the error when a refresh fails and retry runs that refresh again", async () => {
    const loadFirstPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([{ id: "x", at: 5 }], null));
    const loadPage = vi.fn();
    const { result } = setup(loadPage);

    await act(async () => result.current.refresh(loadFirstPage));
    expect(result.current.status).toBe("error");
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => result.current.loadMore());
    expect(loadPage).not.toHaveBeenCalled();

    await act(async () => result.current.retry());
    expect(loadFirstPage).toHaveBeenCalledTimes(2);
    expect(result.current.items.map(getKey)).toEqual(["x"]);
    expect(result.current.status).toBe("end");
  });

  it("does not bring back an item removed while the next page loads", async () => {
    const pending = deferred<CursorPage<Row>>();
    const { result } = setup(vi.fn().mockReturnValue(pending.promise));

    act(() => result.current.loadMore());
    act(() => result.current.remove("c"));
    await act(async () =>
      pending.resolve(
        page(
          [
            { id: "c", at: 7 },
            { id: "d", at: 6 },
          ],
          null,
        ),
      ),
    );
    expect(result.current.items.map(getKey)).toEqual(["a", "b", "d"]);
  });
});
