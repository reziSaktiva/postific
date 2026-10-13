import { describe, expect, it } from "vitest";

import { resolvePostPerformancePeriodRange } from "./post-performance-period-range";

// Test unit murni untuk `resolvePostPerformancePeriodRange` (T-043.1) —
// ditambahkan Najwa QA Engineer (2026-09-18) menindaklanjuti temuan non-
// blocking Ridwan Architecture Reviewer: cakupan sebelumnya di
// `publishing.service.test.ts` hanya menguji "weekly" secara tidak langsung
// (lewat `getPostPerformance`, tanpa override `now`), belum ada test khusus
// "monthly" maupun edge case tanggal tepat di batas rentang. Pola sama
// `calendar-range.test.ts`.
describe("resolvePostPerformancePeriodRange", () => {
  it("weekly — 7 hari terakhir dari `now`", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const { from, to } = resolvePostPerformancePeriodRange("weekly", now);

    expect(to.toISOString()).toBe("2026-09-18T12:00:00.000Z");
    expect(from.toISOString()).toBe("2026-09-11T12:00:00.000Z");
  });

  it("monthly — 30 hari terakhir dari `now`", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const { from, to } = resolvePostPerformancePeriodRange("monthly", now);

    expect(to.toISOString()).toBe("2026-09-18T12:00:00.000Z");
    expect(from.toISOString()).toBe("2026-08-19T12:00:00.000Z");
  });

  it("weekly — rentang menyambung pergantian bulan", () => {
    const now = new Date("2026-08-02T00:00:00.000Z");
    const { from, to } = resolvePostPerformancePeriodRange("weekly", now);

    expect(to.toISOString()).toBe("2026-08-02T00:00:00.000Z");
    expect(from.toISOString()).toBe("2026-07-26T00:00:00.000Z");
  });

  it("monthly — rentang menyambung pergantian tahun", () => {
    const now = new Date("2027-01-05T00:00:00.000Z");
    const { from, to } = resolvePostPerformancePeriodRange("monthly", now);

    expect(to.toISOString()).toBe("2027-01-05T00:00:00.000Z");
    expect(from.toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });

  it("edge case — `publishedAt` persis di `to` (batas atas) dianggap masih dalam rentang oleh caller inklusif (`>= from && <= to`)", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const { to } = resolvePostPerformancePeriodRange("weekly", now);
    const publishedAt = to;

    expect(publishedAt.getTime()).toBeGreaterThanOrEqual(
      resolvePostPerformancePeriodRange("weekly", now).from.getTime(),
    );
    expect(publishedAt.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  it("edge case — `publishedAt` persis di `from` (batas bawah) dianggap masih dalam rentang oleh caller inklusif (`>= from && <= to`)", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const { from, to } = resolvePostPerformancePeriodRange("weekly", now);
    const publishedAt = from;

    expect(publishedAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(publishedAt.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  it("edge case — satu milidetik sebelum `from` dianggap di LUAR rentang oleh caller inklusif (`>= from && <= to`)", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const { from } = resolvePostPerformancePeriodRange("weekly", now);
    const publishedAt = new Date(from.getTime() - 1);

    expect(publishedAt.getTime()).toBeLessThan(from.getTime());
  });

  it("default `now` — tidak melempar error saat dipanggil tanpa argumen kedua (pemanggilan produksi nyata)", () => {
    expect(() => resolvePostPerformancePeriodRange("weekly")).not.toThrow();
    expect(() => resolvePostPerformancePeriodRange("monthly")).not.toThrow();
  });
});
