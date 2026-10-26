import { describe, expect, it } from "vitest";

import {
  getWibDateParts,
  getWibHour,
  startOfWibDay,
  toWibDateKey,
  wibLocalToUtc,
  wibMidnightUtc,
} from "./wib-time";

describe("wib-time", () => {
  it("batas hari WIB: 17:59Z masuk hari berikutnya, 16:59Z masih hari yang sama", () => {
    expect(toWibDateKey(new Date("2026-09-01T17:59:00Z"))).toBe("2026-09-02");
    expect(toWibDateKey(new Date("2026-09-01T16:59:00Z"))).toBe("2026-09-01");
    expect(toWibDateKey(new Date("2026-09-01T17:00:00Z"))).toBe("2026-09-02");
    expect(toWibDateKey(new Date("2026-09-01T16:59:59.999Z"))).toBe(
      "2026-09-01",
    );
  });

  it("pergantian tahun dan bulan mengikuti WIB", () => {
    expect(toWibDateKey(new Date("2026-12-31T18:00:00Z"))).toBe("2027-01-01");
    expect(toWibDateKey(new Date("2026-02-28T17:00:00Z"))).toBe("2026-03-01");
  });

  it("jam WIB = UTC + 7", () => {
    expect(getWibHour(new Date("2026-09-01T17:59:00Z"))).toBe(0);
    expect(getWibHour(new Date("2026-09-01T00:00:00Z"))).toBe(7);
    expect(getWibHour(new Date("2026-09-01T16:59:00Z"))).toBe(23);
  });

  it("startOfWibDay mengembalikan 00:00 WIB (= 17:00Z hari sebelumnya)", () => {
    expect(startOfWibDay(new Date("2026-09-01T17:59:00Z")).toISOString()).toBe(
      "2026-09-01T17:00:00.000Z",
    );
    expect(startOfWibDay(new Date("2026-09-01T16:59:00Z")).toISOString()).toBe(
      "2026-08-31T17:00:00.000Z",
    );
  });

  it("wibMidnightUtc menormalkan overflow hari", () => {
    expect(wibMidnightUtc(2026, 0, 32).toISOString()).toBe(
      "2026-01-31T17:00:00.000Z",
    );
  });

  it("getWibDateParts memberi weekday WIB", () => {
    // 2026-07-12 Minggu 17:00Z = Senin 13 Juli 00:00 WIB
    expect(getWibDateParts(new Date("2026-07-12T17:00:00Z"))).toEqual({
      year: 2026,
      month: 6,
      day: 13,
      weekday: 1,
    });
  });

  it("wibLocalToUtc menafsirkan input sebagai WIB (09:00 WIB = 02:00Z)", () => {
    expect(wibLocalToUtc("2026-09-01", "09:00").toISOString()).toBe(
      "2026-09-01T02:00:00.000Z",
    );
  });

  it("wibLocalToUtc melewati batas hari: 00:30 WIB = 17:30Z hari sebelumnya", () => {
    expect(wibLocalToUtc("2026-09-01", "00:30").toISOString()).toBe(
      "2026-08-31T17:30:00.000Z",
    );
  });

  it("wibLocalToUtc menerima detik dan menolak input tak valid", () => {
    expect(wibLocalToUtc("2026-09-01", "09:00:30").toISOString()).toBe(
      "2026-09-01T02:00:30.000Z",
    );
    expect(Number.isNaN(wibLocalToUtc("", "09:00").getTime())).toBe(true);
  });

  it("wibLocalToUtc tidak bergantung zona proses", () => {
    const original = process.env.TZ;
    process.env.TZ = "Asia/Makassar";
    try {
      expect(wibLocalToUtc("2026-09-01", "09:00").toISOString()).toBe(
        "2026-09-01T02:00:00.000Z",
      );
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
