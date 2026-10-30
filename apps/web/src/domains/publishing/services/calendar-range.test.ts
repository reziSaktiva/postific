import { describe, expect, it } from "vitest";

import { getMonthRange, getWeekRange } from "./calendar-range";

const WIB = "Asia/Jakarta";

// Batas hari = 00:00 WIB = 17:00Z hari sebelumnya (T-144).
describe("getWeekRange (WIB)", () => {
  it("pertengahan minggu (Rabu) — Senin s.d. Minggu minggu yang sama", () => {
    const { from, to } = getWeekRange(new Date("2026-07-15T10:00:00Z"), WIB); // Rabu

    expect(from.toISOString()).toBe("2026-07-12T17:00:00.000Z"); // Senin 13 Jul 00:00 WIB
    expect(to.toISOString()).toBe("2026-07-19T16:59:59.999Z"); // Minggu 19 Jul 23:59:59.999 WIB
  });

  it("anchor tepat di awal hari Senin WIB — minggu itu sendiri", () => {
    const { from, to } = getWeekRange(
      new Date("2026-07-12T17:00:00.000Z"),
      WIB,
    );

    expect(from.toISOString()).toBe("2026-07-12T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-19T16:59:59.999Z");
  });

  it("16:59Z Minggu masih Minggu WIB; 17:00Z Minggu sudah Senin WIB berikutnya", () => {
    const sunday = getWeekRange(new Date("2026-07-12T16:59:59.999Z"), WIB);
    expect(sunday.from.toISOString()).toBe("2026-07-05T17:00:00.000Z");
    expect(sunday.to.toISOString()).toBe("2026-07-12T16:59:59.999Z");

    const monday = getWeekRange(new Date("2026-07-12T17:00:00.000Z"), WIB);
    expect(monday.from.toISOString()).toBe("2026-07-12T17:00:00.000Z");
  });

  it("anchor di hari Minggu WIB — tetap minggu yang sama (bukan minggu berikutnya)", () => {
    const { from, to } = getWeekRange(
      new Date("2026-07-19T16:59:59.999Z"),
      WIB,
    );

    expect(from.toISOString()).toBe("2026-07-12T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-19T16:59:59.999Z");
  });

  it("pergantian tahun — minggu menyambung Desember ke Januari tahun berikutnya", () => {
    // 2026-12-31 = Kamis; Senin = 28 Des, Minggu = 3 Jan 2027 (WIB)
    const { from, to } = getWeekRange(new Date("2026-12-31T12:00:00Z"), WIB);

    expect(from.toISOString()).toBe("2026-12-27T17:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-03T16:59:59.999Z");
  });
});

describe("getMonthRange (WIB)", () => {
  it("pertengahan bulan — tanggal 1 s.d. hari terakhir bulan yang sama", () => {
    const { from, to } = getMonthRange(new Date("2026-07-15T10:00:00Z"), WIB);

    expect(from.toISOString()).toBe("2026-06-30T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-31T16:59:59.999Z");
  });

  it("17:00Z akhir bulan sudah bulan berikutnya di WIB", () => {
    const { from } = getMonthRange(new Date("2026-07-31T17:00:00Z"), WIB);
    expect(from.toISOString()).toBe("2026-07-31T17:00:00.000Z"); // 1 Agustus 00:00 WIB
  });

  it("Februari tahun non-kabisat — 28 hari", () => {
    const { from, to } = getMonthRange(new Date("2027-02-10T00:00:00Z"), WIB);

    expect(from.toISOString()).toBe("2027-01-31T17:00:00.000Z");
    expect(to.toISOString()).toBe("2027-02-28T16:59:59.999Z");
  });

  it("Februari tahun kabisat — 29 hari", () => {
    const { from, to } = getMonthRange(new Date("2028-02-10T00:00:00Z"), WIB);

    expect(from.toISOString()).toBe("2028-01-31T17:00:00.000Z");
    expect(to.toISOString()).toBe("2028-02-29T16:59:59.999Z");
  });

  it("Desember — hari terakhir bulan tetap dalam tahun yang sama", () => {
    const { from, to } = getMonthRange(new Date("2026-12-05T00:00:00Z"), WIB);

    expect(from.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-12-31T16:59:59.999Z");
  });
});

describe("rentang Calendar di zona non-WIB (T-147)", () => {
  const NY = "America/New_York";

  it("Week di New_York: Senin 00:00 EDT s.d. Minggu 23:59:59.999 EDT", () => {
    // Rabu 15 Jul 2026 -> Senin 13 Jul 00:00 EDT = 04:00Z
    const { from, to } = getWeekRange(new Date("2026-07-15T10:00:00Z"), NY);
    expect(from.toISOString()).toBe("2026-07-13T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-20T03:59:59.999Z");
  });

  it("Week yang memuat fall-back (2026-11-01) berdurasi 7 hari + 1 jam", () => {
    const { from, to } = getWeekRange(new Date("2026-10-29T12:00:00Z"), NY);
    // Senin 26 Okt 00:00 EDT -> Senin 2 Nov 00:00 EST = 05:00Z
    expect(from.toISOString()).toBe("2026-10-26T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-02T04:59:59.999Z");
  });

  it("anchor 03:00Z masih hari sebelumnya di New_York: minggu sebelumnya bila Senin", () => {
    // Senin 13 Jul 03:00Z = Minggu 12 Jul 23:00 EDT -> minggu 6-12 Jul
    const { from } = getWeekRange(new Date("2026-07-13T03:00:00Z"), NY);
    expect(from.toISOString()).toBe("2026-07-06T04:00:00.000Z");
  });

  it("Month Auckland: 1 Okt 00:00 NZST (30 Sep 12:00Z) s.d. akhir Okt NZDT", () => {
    const { from, to } = getMonthRange(
      new Date("2026-10-15T00:00:00Z"),
      "Pacific/Auckland",
    );
    // DST NZ mulai 27 Sep 2026; 1 Okt sudah NZDT (UTC+13)
    expect(from.toISOString()).toBe("2026-09-30T11:00:00.000Z");
    // 1 Nov 00:00 NZDT = 31 Okt 11:00Z
    expect(to.toISOString()).toBe("2026-10-31T10:59:59.999Z");
  });

  it("Month Kolkata (UTC+5:30)", () => {
    const { from, to } = getMonthRange(
      new Date("2026-07-15T00:00:00Z"),
      "Asia/Kolkata",
    );
    expect(from.toISOString()).toBe("2026-06-30T18:30:00.000Z");
    expect(to.toISOString()).toBe("2026-07-31T18:29:59.999Z");
  });

  it("Month New_York bulan berisi fall-back (Nov 2026)", () => {
    const { from, to } = getMonthRange(new Date("2026-11-15T12:00:00Z"), NY);
    expect(from.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-12-01T04:59:59.999Z");
  });
});
