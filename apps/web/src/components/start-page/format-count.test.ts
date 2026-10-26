import { describe, expect, it } from "vitest";

import { formatCountDisplay, formatCountFull } from "./format-count";

/** ICU memakai NBSP antara angka dan satuan ringkas ("12,5 rb"). */
const plain = (text: string) => text.replace(/\u00a0/g, " ");

describe("formatCountDisplay (T-074)", () => {
  it("writes numbers below 10.000 in full (id-ID)", () => {
    expect(formatCountDisplay(0)).toBe("0");
    expect(formatCountDisplay(987)).toBe("987");
    expect(formatCountDisplay(1842)).toBe("1.842");
    expect(formatCountDisplay(9999)).toBe("9.999");
  });

  it("switches to compact id-ID from 10.000", () => {
    expect(plain(formatCountDisplay(10_000))).toBe("10 rb");
    expect(plain(formatCountDisplay(12_480))).toBe("12,5 rb");
    expect(plain(formatCountDisplay(1_204_000))).toBe("1,2 jt");
    expect(plain(formatCountDisplay(2_431_870))).toBe("2,4 jt");
    expect(plain(formatCountDisplay(2_500_000_000))).toBe("2,5 M");
  });
});

describe("formatCountFull", () => {
  it("always writes the full id-ID number (for screen readers)", () => {
    expect(formatCountFull(0)).toBe("0");
    expect(formatCountFull(12_480)).toBe("12.480");
    expect(formatCountFull(2_431_870)).toBe("2.431.870");
  });
});
