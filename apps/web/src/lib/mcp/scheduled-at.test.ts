import { describe, expect, it } from "vitest";

import { parseScheduledAt } from "./scheduled-at";
import { McpToolInputError } from "./tool-input";

const parse = (value: unknown, zone = "Asia/Jakarta") =>
  parseScheduledAt(value, zone, "posts[1]");

describe("parseScheduledAt", () => {
  it("reads a time without offset as wall-clock time in the user zone", () => {
    expect(parse("2026-11-10T09:00:00").toISOString()).toBe(
      "2026-11-10T02:00:00.000Z",
    );
    expect(parse("2026-11-10T09:00:00", "America/New_York").toISOString()).toBe(
      "2026-11-10T14:00:00.000Z",
    );
    expect(parse("2026-07-10T09:00", "America/New_York").toISOString()).toBe(
      "2026-07-10T13:00:00.000Z",
    );
  });

  it("accepts a space separator and ignores fractional seconds", () => {
    expect(parse("2026-11-10 09:00:30.750").toISOString()).toBe(
      "2026-11-10T02:00:30.000Z",
    );
  });

  it("uses an explicit offset as given, whatever the user zone is", () => {
    expect(
      parse("2026-11-10T09:00:00+07:00", "America/New_York").toISOString(),
    ).toBe("2026-11-10T02:00:00.000Z");
    expect(parse("2026-11-10T09:00:00-0500").toISOString()).toBe(
      "2026-11-10T14:00:00.000Z",
    );
    expect(parse("2026-11-10T09:00:00Z").toISOString()).toBe(
      "2026-11-10T09:00:00.000Z",
    );
    expect(parse("2026-11-10T09:00:00+05:30").toISOString()).toBe(
      "2026-11-10T03:30:00.000Z",
    );
  });

  it("rejects non-strings, free text, and date-only values, naming the item", () => {
    for (const bad of [undefined, 12, "besok pagi", "2026-11-10", ""]) {
      expect(() => parse(bad)).toThrow(McpToolInputError);
      expect(() => parse(bad)).toThrow(/posts\[1\]: scheduledAt/);
    }
  });

  it("rejects dates that do not exist instead of rolling them over", () => {
    expect(() => parse("2026-02-30T09:00:00")).toThrow(
      /bukan tanggal atau jam yang valid/,
    );
    expect(() => parse("2026-13-01T09:00:00")).toThrow(
      /bukan tanggal atau jam yang valid/,
    );
    expect(() => parse("2026-11-10T24:00:00")).toThrow(
      /bukan tanggal atau jam yang valid/,
    );
    expect(() => parse("2026-11-10T09:60:00")).toThrow(
      /bukan tanggal atau jam yang valid/,
    );
  });

  it("rejects absurd offsets", () => {
    expect(() => parse("2026-11-10T09:00:00+23:00")).toThrow(/offset/);
    expect(() => parse("2026-11-10T09:00:00+07:99")).toThrow(/offset/);
  });

  it("follows zonedLocalToUtc at DST edges: a gap hour shifts forward in New_York and backward in Berlin, a doubled hour takes the first (New_York) or second (Berlin) occurrence", () => {
    expect(parse("2026-03-08T02:30:00", "America/New_York").toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
    expect(parse("2026-11-01T01:30:00", "America/New_York").toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(parse("2026-03-29T02:30:00", "Europe/Berlin").toISOString()).toBe(
      "2026-03-29T00:30:00.000Z",
    );
    expect(parse("2026-10-25T02:30:00", "Europe/Berlin").toISOString()).toBe(
      "2026-10-25T01:30:00.000Z",
    );
  });

  it("is unambiguous at those hours when the client sends an explicit offset", () => {
    expect(
      parse("2026-11-01T01:30:00-05:00", "America/New_York").toISOString(),
    ).toBe("2026-11-01T06:30:00.000Z");
    expect(
      parse("2026-10-25T02:30:00+01:00", "Europe/Berlin").toISOString(),
    ).toBe("2026-10-25T01:30:00.000Z");
  });
});
