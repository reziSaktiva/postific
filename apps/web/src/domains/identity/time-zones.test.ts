import { describe, expect, it } from "vitest";

import {
  buildTimeZoneOptionGroups,
  canonicalizeTimeZone,
  formatTimeZoneLabel,
  formatUtcOffset,
  getSupportedTimeZones,
  isSupportedTimeZone,
  normalizeDetectedTimeZone,
} from "./time-zones";
import { parseTimeZone } from "./validation";
import { ValidationError } from "@/lib/utils/errors";

const SUMMER = new Date("2026-07-01T12:00:00Z");
const WINTER = new Date("2026-01-15T12:00:00Z");

describe("time-zones", () => {
  it("daftar mencakup zona umum dan UTC", () => {
    expect(isSupportedTimeZone("Asia/Jakarta")).toBe(true);
    expect(isSupportedTimeZone("America/New_York")).toBe(true);
    expect(isSupportedTimeZone("UTC")).toBe(true);
    expect(getSupportedTimeZones().length).toBeGreaterThan(100);
  });

  it.each(["Bukan/Zona", "", "asia/jakarta", "GMT+7", " Asia/Jakarta"])(
    "menolak nama tak dikenal %j",
    (name) => {
      expect(isSupportedTimeZone(name)).toBe(false);
      expect(() => parseTimeZone(name)).toThrow(ValidationError);
    },
  );

  it("parseTimeZone menolak tipe bukan string", () => {
    expect(() => parseTimeZone(undefined)).toThrow(ValidationError);
    expect(() => parseTimeZone(7)).toThrow(ValidationError);
    expect(parseTimeZone("Asia/Makassar")).toBe("Asia/Makassar");
  });

  it("normalizeDetectedTimeZone: valid lolos, tak dikenal/kosong jadi null", () => {
    expect(normalizeDetectedTimeZone("Asia/Jakarta")).toBe("Asia/Jakarta");
    expect(normalizeDetectedTimeZone("Bukan/Zona")).toBeNull();
    expect(normalizeDetectedTimeZone(undefined)).toBeNull();
    expect(normalizeDetectedTimeZone("")).toBeNull();
  });

  it("alias IANA yang ditulis persis dipetakan ke nama kanonik runtime", () => {
    // Node mendaftar Asia/Calcutta; browser lain mengirim Asia/Kolkata.
    const canonical = canonicalizeTimeZone("Asia/Kolkata");
    expect(canonical).not.toBeNull();
    expect(isSupportedTimeZone(canonical as string)).toBe(true);
    expect(parseTimeZone("Asia/Kolkata")).toBe(canonical);
    // variasi huruf dan nama ambigu tanpa "/" tetap ditolak
    expect(canonicalizeTimeZone("ASIA/KOLKATA")).toBeNull();
    expect(canonicalizeTimeZone("EST")).toBeNull();
  });

  it("buildTimeZoneOptionGroups menyisipkan zona tersimpan yang tak ada di daftar runtime", () => {
    const groups = buildTimeZoneOptionGroups(SUMMER, "Asia/Kolkata");
    const all = groups.flatMap((g) => g.options.map((o) => o.value));
    expect(all).toContain("Asia/Kolkata");
  });

  it("formatUtcOffset: DST, setengah jam, dan UTC", () => {
    expect(formatUtcOffset("Asia/Jakarta", SUMMER)).toBe("UTC+7");
    expect(formatUtcOffset("America/New_York", SUMMER)).toBe("UTC-4");
    expect(formatUtcOffset("America/New_York", WINTER)).toBe("UTC-5");
    expect(formatUtcOffset("Asia/Kolkata", SUMMER)).toBe("UTC+5:30");
    expect(formatUtcOffset("UTC", SUMMER)).toBe("UTC+0");
  });

  it("formatTimeZoneLabel mengikuti format rancangan", () => {
    expect(formatTimeZoneLabel("Asia/Jakarta", SUMMER)).toBe(
      "Asia/Jakarta (WIB, UTC+7)",
    );
    expect(formatTimeZoneLabel("UTC", SUMMER)).toBe("UTC (UTC+0)");
    expect(formatTimeZoneLabel("Asia/Kolkata", SUMMER)).toMatch(
      /^Asia\/Kolkata \((.+, )?UTC\+5:30\)$/,
    );
  });

  it("opsi dikelompokkan: Indonesia paling atas, UTC terakhir, wilayah lain abjad", () => {
    const groups = buildTimeZoneOptionGroups(SUMMER);
    expect(groups[0]?.region).toBe("Indonesia");
    expect(groups[0]?.options.map((o) => o.value)).toEqual([
      "Asia/Jakarta",
      "Asia/Makassar",
      "Asia/Jayapura",
    ]);
    expect(groups[groups.length - 1]?.region).toBe("UTC");
    const middle = groups.slice(1, -1).map((g) => g.region);
    expect(middle).toEqual([...middle].sort((a, b) => a.localeCompare(b)));
    // Jakarta tidak muncul ganda di kelompok Asia
    const asia = groups.find((g) => g.region === "Asia");
    expect(asia?.options.some((o) => o.value === "Asia/Jakarta")).toBe(false);
    const total = groups.reduce((n, g) => n + g.options.length, 0);
    expect(total).toBe(getSupportedTimeZones().length);
  });
});
