import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCalendarViewState } from "./parse-calendar-view-state";
import {
  buildPublishSearch,
  legacyPublishHref,
  parsePublishViewState,
} from "./parse-publish-view-state";

const defaults = { profileTimeZone: "Asia/Jakarta" };

describe("parsePublishViewState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("view", () => {
    it("opens Calendar when there is no view and no last used view", () => {
      expect(parsePublishViewState({}, defaults).view).toBe("calendar");
    });

    it("reopens the last used view from the cookie", () => {
      expect(
        parsePublishViewState({}, { ...defaults, lastView: "board" }).view,
      ).toBe("board");
    });

    it("ignores an unknown cookie value", () => {
      expect(
        parsePublishViewState({}, { ...defaults, lastView: "kanban" }).view,
      ).toBe("calendar");
    });

    it("prefers the view in the URL over the cookie", () => {
      expect(
        parsePublishViewState(
          { view: "list" },
          { ...defaults, lastView: "board" },
        ).view,
      ).toBe("list");
    });

    it("reads the old ?view=week|month as Calendar on that range", () => {
      const state = parsePublishViewState(
        { view: "week" },
        { ...defaults, lastView: "list" },
      );
      expect(state.view).toBe("calendar");
      expect(state.calendar.view).toBe("week");
    });

    it("falls back to the last used view for an unknown view", () => {
      expect(
        parsePublishViewState(
          { view: "grid" },
          { ...defaults, lastView: "list" },
        ).view,
      ).toBe("list");
    });
  });

  describe("tab", () => {
    it("defaults to Queue", () => {
      expect(parsePublishViewState({ view: "list" }, defaults).tab).toBe(
        "queue",
      );
    });

    it.each(["queue", "drafts", "approvals", "history"])(
      "accepts %s",
      (tab) => {
        expect(parsePublishViewState({ view: "list", tab }, defaults).tab).toBe(
          tab,
        );
      },
    );

    it("falls back to Queue for an unknown tab", () => {
      expect(
        parsePublishViewState({ view: "list", tab: "archive" }, defaults).tab,
      ).toBe("queue");
    });
  });

  describe("calendar range", () => {
    it("reads range next to view=calendar", () => {
      expect(
        parsePublishViewState({ view: "calendar", range: "week" }, defaults)
          .calendar.view,
      ).toBe("week");
    });

    it("opens Month when there is no range", () => {
      expect(
        parsePublishViewState({ view: "calendar" }, defaults).calendar.view,
      ).toBe("month");
    });

    it("keeps date and filters", () => {
      const state = parsePublishViewState(
        {
          view: "calendar",
          date: String(Date.UTC(2026, 10, 2)),
          status: "scheduled,nope",
          accounts: "acc-1",
        },
        defaults,
      );
      expect(state.calendar.date).toEqual(new Date(Date.UTC(2026, 10, 2)));
      expect(state.calendar.statuses).toEqual(["scheduled"]);
      expect(state.calendar.connectedAccountIds).toEqual(["acc-1"]);
    });
  });

  describe("display time zone", () => {
    it("starts at the Profile time zone", () => {
      expect(parsePublishViewState({}, defaults).timeZone).toBe("Asia/Jakarta");
    });

    it("uses a valid tz from the URL", () => {
      expect(
        parsePublishViewState({ tz: "Asia/Makassar" }, defaults).timeZone,
      ).toBe("Asia/Makassar");
    });

    it("falls back to the Profile zone for an unknown tz", () => {
      expect(
        parsePublishViewState({ tz: "Mars/Olympus" }, defaults).timeZone,
      ).toBe("Asia/Jakarta");
    });
  });

  describe("post", () => {
    it("is null without post", () => {
      expect(parsePublishViewState({}, defaults).postId).toBeNull();
    });

    it("reads the post id", () => {
      expect(
        parsePublishViewState(
          { view: "list", tab: "history", post: "p-1" },
          defaults,
        ).postId,
      ).toBe("p-1");
    });
  });
});

describe("buildPublishSearch", () => {
  it("drops the List tab and post when switching to Board", () => {
    expect(buildPublishSearch({ view: "board", tab: "drafts" })).toBe(
      "?view=board",
    );
  });

  it("writes the List tab", () => {
    expect(buildPublishSearch({ view: "list", tab: "history" })).toBe(
      "?view=list&tab=history",
    );
  });

  it("leaves out tz when it equals the Profile zone", () => {
    expect(
      buildPublishSearch({
        view: "calendar",
        timeZone: "Asia/Jakarta",
        profileTimeZone: "Asia/Jakarta",
      }),
    ).toBe("?view=calendar");
  });

  it("keeps a picked tz", () => {
    expect(
      buildPublishSearch({
        view: "calendar",
        timeZone: "Asia/Jayapura",
        profileTimeZone: "Asia/Jakarta",
      }),
    ).toBe("?view=calendar&tz=Asia%2FJayapura");
  });
});

describe("legacyPublishHref", () => {
  it.each([
    ["queue", "/publish?view=list&tab=queue"],
    ["drafts", "/publish?view=list&tab=drafts"],
    ["history", "/publish?view=list&tab=history"],
  ] as const)("/publish/%s lands on that List tab", (route, href) => {
    expect(legacyPublishHref(route, {})).toBe(href);
  });

  it("/publish/history/[postId] lands on that post", () => {
    expect(legacyPublishHref("history", {}, "p-9")).toBe(
      "/publish?view=list&tab=history&post=p-9",
    );
  });

  it("/publish/calendar keeps range, date and filters", () => {
    const href = legacyPublishHref("calendar", {
      view: "week",
      date: "1764547200000",
      status: "Scheduled",
      accounts: "acc-1,acc-2",
    });
    expect(href).toBe(
      "/publish?view=calendar&range=week&date=1764547200000&status=Scheduled&accounts=acc-1%2Cacc-2",
    );
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseCalendarViewState(params).view).toBe("week");
  });

  it("/publish/calendar without params opens Calendar", () => {
    expect(legacyPublishHref("calendar", {})).toBe("/publish?view=calendar");
  });

  it("keeps a tz already in the URL", () => {
    expect(legacyPublishHref("queue", { tz: "Asia/Makassar" })).toBe(
      "/publish?view=list&tab=queue&tz=Asia%2FMakassar",
    );
  });
});
