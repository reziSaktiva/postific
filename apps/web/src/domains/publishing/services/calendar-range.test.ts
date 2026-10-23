import { describe, expect, it } from "vitest";

import { getMonthRange, getWeekRange } from "./calendar-range";

// Batas hari = 00:00 WIB = 17:00Z hari sebelumnya (T-144).
describe("getWeekRange (WIB)", () => {
  it("pertengahan minggu (Rabu) — Senin s.d. Minggu minggu yang sama", () => {
    const { from, to } = getWeekRange(new Date("2026-07-15T10:00:00Z")); // Rabu

    expect(from.toISOString()).toBe("2026-07-12T17:00:00.000Z"); // Senin 13 Jul 00:00 WIB
    expect(to.toISOString()).toBe("2026-07-19T16:59:59.999Z"); // Minggu 19 Jul 23:59:59.999 WIB
  });

  it("anchor tepat di awal hari Senin WIB — minggu itu sendiri", () => {
    const { from, to } = getWeekRange(new Date("2026-07-12T17:00:00.000Z"));

    expect(from.toISOString()).toBe("2026-07-12T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-19T16:59:59.999Z");
  });

  it("16:59Z Minggu masih Minggu WIB; 17:00Z Minggu sudah Senin WIB berikutnya", () => {
    const sunday = getWeekRange(new Date("2026-07-12T16:59:59.999Z"));
    expect(sunday.from.toISOString()).toBe("2026-07-05T17:00:00.000Z");
    expect(sunday.to.toISOString()).toBe("2026-07-12T16:59:59.999Z");

    const monday = getWeekRange(new Date("2026-07-12T17:00:00.000Z"));
    expect(monday.from.toISOString()).toBe("2026-07-12T17:00:00.000Z");
  });

  it("anchor di hari Minggu WIB — tetap minggu yang sama (bukan minggu berikutnya)", () => {
    const { from, to } = getWeekRange(new Date("2026-07-19T16:59:59.999Z"));

    expect(from.toISOString()).toBe("2026-07-12T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-19T16:59:59.999Z");
  });

  it("pergantian tahun — minggu menyambung Desember ke Januari tahun berikutnya", () => {
    // 2026-12-31 = Kamis; Senin = 28 Des, Minggu = 3 Jan 2027 (WIB)
    const { from, to } = getWeekRange(new Date("2026-12-31T12:00:00Z"));

    expect(from.toISOString()).toBe("2026-12-27T17:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-03T16:59:59.999Z");
  });
});

describe("getMonthRange (WIB)", () => {
  it("pertengahan bulan — tanggal 1 s.d. hari terakhir bulan yang sama", () => {
    const { from, to } = getMonthRange(new Date("2026-07-15T10:00:00Z"));

    expect(from.toISOString()).toBe("2026-06-30T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-31T16:59:59.999Z");
  });

  it("17:00Z akhir bulan sudah bulan berikutnya di WIB", () => {
    const { from } = getMonthRange(new Date("2026-07-31T17:00:00Z"));
    expect(from.toISOString()).toBe("2026-07-31T17:00:00.000Z"); // 1 Agustus 00:00 WIB
  });

  it("Februari tahun non-kabisat — 28 hari", () => {
    const { from, to } = getMonthRange(new Date("2027-02-10T00:00:00Z"));

    expect(from.toISOString()).toBe("2027-01-31T17:00:00.000Z");
    expect(to.toISOString()).toBe("2027-02-28T16:59:59.999Z");
  });

  it("Februari tahun kabisat — 29 hari", () => {
    const { from, to } = getMonthRange(new Date("2028-02-10T00:00:00Z"));

    expect(from.toISOString()).toBe("2028-01-31T17:00:00.000Z");
    expect(to.toISOString()).toBe("2028-02-29T16:59:59.999Z");
  });

  it("Desember — hari terakhir bulan tetap dalam tahun yang sama", () => {
    const { from, to } = getMonthRange(new Date("2026-12-05T00:00:00Z"));

    expect(from.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-12-31T16:59:59.999Z");
  });
});
