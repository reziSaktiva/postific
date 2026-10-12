import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import {
  bumpClientNowMs,
  readClientNowMs,
  serverRelativeNowMs,
  subscribeRelativeNow,
} from "./relative-now";

describe("relative now History", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydration memakai stempel server, bukan jam browser", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T10:00:00.000Z"));

    const renderedAt = "2026-10-12T09:00:00.000Z";
    const publishedAt = new Date("2026-10-12T08:30:00.000Z");
    const hydratedNow = new Date(serverRelativeNowMs(renderedAt));

    expect(serverRelativeNowMs(renderedAt)).toBe(Date.parse(renderedAt));
    expect(formatRelativeTime(publishedAt, hydratedNow)).toBe("30 menit lalu");
    expect(formatRelativeTime(publishedAt, new Date())).toBe("1 jam lalu");
  });

  it("jam klien tetap sampai diberi tahu, lalu listener ikut maju", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T10:00:00.000Z"));
    const renderedAt = "history-bump-2026-10-12T09:00:00.000Z";

    expect(readClientNowMs(renderedAt)).toBe(
      Date.parse("2026-10-12T10:00:00.000Z"),
    );

    vi.setSystemTime(new Date("2026-10-12T10:05:00.000Z"));
    expect(readClientNowMs(renderedAt)).toBe(
      Date.parse("2026-10-12T10:00:00.000Z"),
    );

    let notices = 0;
    const unsubscribe = subscribeRelativeNow(() => {
      notices += 1;
    });
    bumpClientNowMs(renderedAt);

    expect(notices).toBe(1);
    expect(readClientNowMs(renderedAt)).toBe(
      Date.parse("2026-10-12T10:05:00.000Z"),
    );

    unsubscribe();
    bumpClientNowMs(renderedAt);
    expect(notices).toBe(1);
  });
});
