// @vitest-environment jsdom
import { createRef } from "react";

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Skeleton } from "@/components/ui/skeleton";

import { InfiniteListSentinel } from "./InfiniteListSentinel";
import { InfiniteListFooter } from "./InfiniteListStates";
import type { InfiniteListStatus } from "./infinite-list-state";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

const observers: Array<{
  callback: ObserverCallback;
  options: IntersectionObserverInit | undefined;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      constructor(
        callback: ObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        observers.push({ callback, options, disconnect: this.disconnect });
      }
      observe() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderFooter(
  status: InfiniteListStatus,
  items: unknown[] = [1, 2],
  handlers = { loadMore: vi.fn(), retry: vi.fn() },
) {
  render(
    <InfiniteListFooter
      list={{ items, status, ...handlers }}
      loading={{
        count: 2,
        label: "Memuat posting lainnya",
        renderRow: (i) => <Skeleton data-testid={`sk-${i}`} className="h-12" />,
      }}
      endText="Sudah sampai posting terlama."
      error={{
        title: "Gagal memuat posting lainnya",
        description: "Periksa koneksi, lalu coba lagi.",
        retryLabel: "Coba Lagi",
      }}
    />,
  );
  return handlers;
}

describe("InfiniteListFooter", () => {
  it("arms the sentinel when more pages exist", () => {
    const { loadMore } = renderFooter("idle");
    expect(observers).toHaveLength(1);
    act(() => observers[0].callback([{ isIntersecting: true }]));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("shows skeleton rows with a status for screen readers while loading", () => {
    renderFooter("loading");
    expect(screen.getByRole("status").textContent).toContain(
      "Memuat posting lainnya",
    );
    expect(screen.getByTestId("sk-0")).toBeTruthy();
    expect(screen.getByTestId("sk-1")).toBeTruthy();
    expect(screen.queryByTestId("sk-2")).toBeNull();
    expect(observers).toHaveLength(0);
  });

  it("shows the end line at the end", () => {
    renderFooter("end");
    expect(screen.getByText("Sudah sampai posting terlama.")).toBeTruthy();
  });

  it("shows nothing at the end of an empty list (its empty state stays)", () => {
    renderFooter("end", []);
    expect(screen.queryByText("Sudah sampai posting terlama.")).toBeNull();
  });

  it("shows the error Alert and Retry calls retry", async () => {
    const { retry, loadMore } = renderFooter("error");
    expect(screen.getByRole("alert").textContent).toContain(
      "Gagal memuat posting lainnya",
    );
    await userEvent.click(screen.getByRole("button", { name: "Coba Lagi" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(loadMore).not.toHaveBeenCalled();
  });
});

describe("InfiniteListSentinel", () => {
  it("observes inside the scroll container with a margin before the end", () => {
    const root = document.createElement("div");
    const rootRef = createRef<HTMLDivElement>() as { current: HTMLDivElement };
    rootRef.current = root;
    const onVisible = vi.fn();
    const { unmount } = render(
      <InfiniteListSentinel onVisible={onVisible} rootRef={rootRef} />,
    );

    expect(observers[0].options?.root).toBe(root);
    expect(observers[0].options?.rootMargin).toBe("0px 0px 400px 0px");

    act(() => observers[0].callback([{ isIntersecting: false }]));
    expect(onVisible).not.toHaveBeenCalled();

    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });
});
