import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCalendarViewState } from "./parse-calendar-view-state";

describe("parseCalendarViewState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("view", () => {
    it("default ke month kalau tidak ada (T-125)", () => {
      expect(parseCalendarViewState({}).view).toBe("month");
    });

    it("menerima month", () => {
      expect(parseCalendarViewState({ view: "month" }).view).toBe("month");
    });

    it("menerima week eksplisit", () => {
      expect(parseCalendarViewState({ view: "week" }).view).toBe("week");
    });

    it("fallback ke month untuk value invalid", () => {
      expect(parseCalendarViewState({ view: "yearly" }).view).toBe("month");
    });

    it("case-sensitive — Month (kapital) fallback ke default month", () => {
      expect(parseCalendarViewState({ view: "Month" }).view).toBe("month");
    });

    it("mengambil elemen pertama kalau query param diulang (array)", () => {
      expect(parseCalendarViewState({ view: ["month", "week"] }).view).toBe(
        "month",
      );
    });
  });

  describe("date", () => {
    it("default ke hari ini kalau tidak ada", () => {
      expect(parseCalendarViewState({}).date).toEqual(new Date());
    });

    it("default ke hari ini untuk string kosong", () => {
      expect(parseCalendarViewState({ date: "" }).date).toEqual(new Date());
    });

    it("default ke hari ini untuk whitespace", () => {
      expect(parseCalendarViewState({ date: "   " }).date).toEqual(new Date());
    });

    it("default ke hari ini untuk non-numeric", () => {
      expect(parseCalendarViewState({ date: "not-a-timestamp" }).date).toEqual(
        new Date(),
      );
    });

    it("mem-parse epoch milliseconds valid", () => {
      const timestamp = new Date("2026-09-01T00:00:00Z").getTime();
      expect(parseCalendarViewState({ date: String(timestamp) }).date).toEqual(
        new Date(timestamp),
      );
    });

    it("default ke hari ini untuk timestamp non-finite (Infinity)", () => {
      expect(parseCalendarViewState({ date: "Infinity" }).date).toEqual(
        new Date(),
      );
    });

    it("mengambil elemen pertama kalau query param diulang (array)", () => {
      const timestamp = new Date("2026-09-01T00:00:00Z").getTime();
      expect(
        parseCalendarViewState({ date: [String(timestamp), "999"] }).date,
      ).toEqual(new Date(timestamp));
    });
  });

  describe("status", () => {
    it("default array kosong kalau tidak ada (All Posts)", () => {
      expect(parseCalendarViewState({}).statuses).toEqual([]);
    });

    it("mem-parse satu status valid", () => {
      expect(parseCalendarViewState({ status: "scheduled" }).statuses).toEqual([
        "scheduled",
      ]);
    });

    it("mem-parse beberapa status dipisah koma", () => {
      expect(
        parseCalendarViewState({ status: "scheduled,published" }).statuses,
      ).toEqual(["scheduled", "published"]);
    });

    it("drop token invalid (typo) diam-diam, sisakan yang valid", () => {
      expect(
        parseCalendarViewState({ status: "scheduled,typo,published" }).statuses,
      ).toEqual(["scheduled", "published"]);
    });

    it("array kosong kalau semua token invalid", () => {
      expect(
        parseCalendarViewState({ status: "typo,another" }).statuses,
      ).toEqual([]);
    });
  });

  describe("accounts", () => {
    it("default array kosong kalau tidak ada (Semua Akun)", () => {
      expect(parseCalendarViewState({}).connectedAccountIds).toEqual([]);
    });

    it("mem-parse satu account id", () => {
      expect(
        parseCalendarViewState({ accounts: "acc-1" }).connectedAccountIds,
      ).toEqual(["acc-1"]);
    });

    it("mem-parse beberapa account id dipisah koma, drop token kosong", () => {
      expect(
        parseCalendarViewState({ accounts: "acc-1,,acc-2" })
          .connectedAccountIds,
      ).toEqual(["acc-1", "acc-2"]);
    });
  });

  it("default view+date+statuses+connectedAccountIds sekaligus kalau searchParams kosong total", () => {
    expect(parseCalendarViewState({})).toEqual({
      view: "month",
      date: new Date(),
      statuses: [],
      connectedAccountIds: [],
    });
  });
});
