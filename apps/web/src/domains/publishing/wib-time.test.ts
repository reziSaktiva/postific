import { describe, expect, it } from "vitest";

import {
  getDateParts,
  getHour,
  getTimeZoneOffsetMs,
  isValidTimeZone,
  startOfDay,
  toDateKey,
  WIB_TIME_ZONE,
  zonedLocalToUtc,
  zonedMidnightUtc,
} from "./wib-time";

const WIB = WIB_TIME_ZONE;
const NY = "America/New_York";
const KOLKATA = "Asia/Kolkata";
const AUCKLAND = "Pacific/Auckland";
const HOUR = 60 * 60 * 1000;

describe("wib-time — zona WIB (perilaku T-144/T-146 tetap)", () => {
  it("batas hari WIB: 17:59Z masuk hari berikutnya, 16:59Z masih hari yang sama", () => {
    expect(toDateKey(new Date("2026-09-01T17:59:00Z"), WIB)).toBe("2026-09-02");
    expect(toDateKey(new Date("2026-09-01T16:59:00Z"), WIB)).toBe("2026-09-01");
    expect(toDateKey(new Date("2026-09-01T17:00:00Z"), WIB)).toBe("2026-09-02");
    expect(toDateKey(new Date("2026-09-01T16:59:59.999Z"), WIB)).toBe(
      "2026-09-01",
    );
  });

  it("pergantian tahun dan bulan mengikuti WIB", () => {
    expect(toDateKey(new Date("2026-12-31T18:00:00Z"), WIB)).toBe("2027-01-01");
    expect(toDateKey(new Date("2026-02-28T17:00:00Z"), WIB)).toBe("2026-03-01");
  });

  it("jam WIB = UTC + 7", () => {
    expect(getHour(new Date("2026-09-01T17:59:00Z"), WIB)).toBe(0);
    expect(getHour(new Date("2026-09-01T00:00:00Z"), WIB)).toBe(7);
    expect(getHour(new Date("2026-09-01T16:59:00Z"), WIB)).toBe(23);
  });

  it("startOfDay mengembalikan 00:00 WIB (= 17:00Z hari sebelumnya)", () => {
    expect(
      startOfDay(new Date("2026-09-01T17:59:00Z"), WIB).toISOString(),
    ).toBe("2026-09-01T17:00:00.000Z");
    expect(
      startOfDay(new Date("2026-09-01T16:59:00Z"), WIB).toISOString(),
    ).toBe("2026-08-31T17:00:00.000Z");
  });

  it("zonedMidnightUtc menormalkan overflow hari", () => {
    expect(zonedMidnightUtc(2026, 0, 32, WIB).toISOString()).toBe(
      "2026-01-31T17:00:00.000Z",
    );
  });

  it("getDateParts memberi weekday WIB", () => {
    // 2026-07-12 Minggu 17:00Z = Senin 13 Juli 00:00 WIB
    expect(getDateParts(new Date("2026-07-12T17:00:00Z"), WIB)).toEqual({
      year: 2026,
      month: 6,
      day: 13,
      weekday: 1,
    });
  });

  it("zonedLocalToUtc menafsirkan input sebagai WIB (09:00 WIB = 02:00Z)", () => {
    expect(zonedLocalToUtc("2026-09-01", "09:00", WIB).toISOString()).toBe(
      "2026-09-01T02:00:00.000Z",
    );
  });

  it("zonedLocalToUtc melewati batas hari: 00:30 WIB = 17:30Z hari sebelumnya", () => {
    expect(zonedLocalToUtc("2026-09-01", "00:30", WIB).toISOString()).toBe(
      "2026-08-31T17:30:00.000Z",
    );
  });

  it("zonedLocalToUtc tidak bergantung zona proses", () => {
    const original = process.env.TZ;
    process.env.TZ = "Asia/Makassar";
    try {
      expect(zonedLocalToUtc("2026-09-01", "09:00", WIB).toISOString()).toBe(
        "2026-09-01T02:00:00.000Z",
      );
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("wib-time — zona non-WIB (T-147)", () => {
  it("offset memakai DST: New_York EDT (UTC-4) di musim panas, EST (UTC-5) di musim dingin", () => {
    expect(getTimeZoneOffsetMs(new Date("2026-07-01T12:00:00Z"), NY)).toBe(
      -4 * HOUR,
    );
    expect(getTimeZoneOffsetMs(new Date("2026-01-15T12:00:00Z"), NY)).toBe(
      -5 * HOUR,
    );
  });

  it("offset setengah jam: Asia/Kolkata UTC+5:30", () => {
    expect(getTimeZoneOffsetMs(new Date("2026-07-01T12:00:00Z"), KOLKATA)).toBe(
      5.5 * HOUR,
    );
    expect(toDateKey(new Date("2026-07-01T18:30:00Z"), KOLKATA)).toBe(
      "2026-07-02",
    );
    expect(toDateKey(new Date("2026-07-01T18:29:59Z"), KOLKATA)).toBe(
      "2026-07-01",
    );
    expect(getHour(new Date("2026-07-01T18:30:00Z"), KOLKATA)).toBe(0);
  });

  it("Pacific/Auckland: NZST UTC+12 (Juli) dan NZDT UTC+13 (Januari)", () => {
    expect(
      getTimeZoneOffsetMs(new Date("2026-07-01T00:00:00Z"), AUCKLAND),
    ).toBe(12 * HOUR);
    expect(
      getTimeZoneOffsetMs(new Date("2026-01-15T00:00:00Z"), AUCKLAND),
    ).toBe(13 * HOUR);
    // 2026-01-15T11:30Z = 00:30 NZDT 16 Jan
    expect(toDateKey(new Date("2026-01-15T11:30:00Z"), AUCKLAND)).toBe(
      "2026-01-16",
    );
  });

  it("batas hari New_York: 03:59Z masih hari sebelumnya, 04:00Z hari baru (EDT)", () => {
    expect(toDateKey(new Date("2026-07-01T03:59:59Z"), NY)).toBe("2026-06-30");
    expect(toDateKey(new Date("2026-07-01T04:00:00Z"), NY)).toBe("2026-07-01");
    expect(getHour(new Date("2026-07-01T03:59:00Z"), NY)).toBe(23);
  });

  it("hari DST: spring-forward New_York 2026-03-08 hanya 23 jam, fall-back 2026-11-01 25 jam", () => {
    const springStart = zonedMidnightUtc(2026, 2, 8, NY).getTime();
    const springNext = zonedMidnightUtc(2026, 2, 9, NY).getTime();
    expect((springNext - springStart) / HOUR).toBe(23);

    const fallStart = zonedMidnightUtc(2026, 10, 1, NY).getTime();
    const fallNext = zonedMidnightUtc(2026, 10, 2, NY).getTime();
    expect((fallNext - fallStart) / HOUR).toBe(25);
  });

  it("zonedLocalToUtc: 09:00 New_York = 13:00Z (EDT) dan 14:00Z (EST)", () => {
    expect(zonedLocalToUtc("2026-07-01", "09:00", NY).toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
    expect(zonedLocalToUtc("2026-01-15", "09:00", NY).toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
  });

  it("zonedLocalToUtc di sekitar DST: 03:30 tepat setelah spring-forward, 01:30 ambigu fall-back memakai kemunculan pertama", () => {
    // 2026-03-08 02:00 -> 03:00 EDT; 03:30 EDT = 07:30Z
    expect(zonedLocalToUtc("2026-03-08", "03:30", NY).toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
    // jam yang tidak ada (02:30) bergeser maju ke 03:30 EDT
    expect(zonedLocalToUtc("2026-03-08", "02:30", NY).toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
    // 2026-11-01 01:30 terjadi dua kali; kemunculan pertama = EDT = 05:30Z
    expect(zonedLocalToUtc("2026-11-01", "01:30", NY).toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
  });

  it("zonedLocalToUtc Kolkata dan Auckland", () => {
    expect(zonedLocalToUtc("2026-07-01", "09:00", KOLKATA).toISOString()).toBe(
      "2026-07-01T03:30:00.000Z",
    );
    expect(zonedLocalToUtc("2026-01-15", "09:00", AUCKLAND).toISOString()).toBe(
      "2026-01-14T20:00:00.000Z",
    );
  });

  it("round-trip: zonedLocalToUtc lalu toDateKey/getHour mengembalikan input", () => {
    for (const tz of [WIB, NY, KOLKATA, AUCKLAND, "UTC", "Europe/London"]) {
      const utc = zonedLocalToUtc("2026-10-28", "13:45", tz);
      expect(toDateKey(utc, tz)).toBe("2026-10-28");
      expect(getHour(utc, tz)).toBe(13);
    }
  });

  it("getDateParts weekday dan tanggal mengikuti zona", () => {
    // 2026-07-12T20:00Z: Minggu di New_York (16:00), Senin 13 di Kolkata (01:30)
    const instant = new Date("2026-07-12T20:00:00Z");
    expect(getDateParts(instant, NY)).toMatchObject({ day: 12, weekday: 0 });
    expect(getDateParts(instant, KOLKATA)).toMatchObject({
      day: 13,
      weekday: 1,
    });
  });

  it("startOfDay New_York", () => {
    expect(startOfDay(new Date("2026-07-01T15:00:00Z"), NY).toISOString()).toBe(
      "2026-07-01T04:00:00.000Z",
    );
  });

  it("UTC: kunci tanggal = tanggal UTC", () => {
    expect(toDateKey(new Date("2026-09-01T23:59:59Z"), "UTC")).toBe(
      "2026-09-01",
    );
  });
});

describe("wib-time — input tak valid", () => {
  it("zonedLocalToUtc: tanggal/jam tak valid menghasilkan Invalid Date", () => {
    expect(Number.isNaN(zonedLocalToUtc("", "09:00", WIB).getTime())).toBe(
      true,
    );
    expect(Number.isNaN(zonedLocalToUtc("2026-09-01", "", NY).getTime())).toBe(
      true,
    );
    expect(
      Number.isNaN(zonedLocalToUtc("bukan-tanggal", "xx:yy", NY).getTime()),
    ).toBe(true);
  });

  it("zonedLocalToUtc menerima detik", () => {
    expect(zonedLocalToUtc("2026-09-01", "09:00:30", WIB).toISOString()).toBe(
      "2026-09-01T02:00:30.000Z",
    );
  });

  it("nama zona tak valid melempar RangeError, bukan jatuh ke WIB", () => {
    expect(() => toDateKey(new Date(), "Bukan/Zona")).toThrow(RangeError);
    expect(() => zonedLocalToUtc("2026-09-01", "09:00", "Bukan/Zona")).toThrow(
      RangeError,
    );
    expect(() => zonedLocalToUtc("", "", "Bukan/Zona")).toThrow(RangeError);
  });

  it("isValidTimeZone", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Bukan/Zona")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
