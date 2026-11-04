import { describe, expect, it } from "vitest";

import {
  PIN_LINK_HINT,
  getPinLinkHint,
  resolveActiveAccountId,
  summarizeBlockIssues,
} from "./network-blocks-state";

describe("resolveActiveAccountId", () => {
  it("memakai blok pilihan pemakai selama masih terpilih", () => {
    expect(resolveActiveAccountId(["b", "a", "c"], "c")).toBe("c");
  });

  it("jatuh ke akun pertama menurut urutan render, bukan urutan lain", () => {
    // "b" dipilih lebih dulu dan dirender paling atas.
    expect(resolveActiveAccountId(["b", "a"], undefined)).toBe("b");
  });

  it("jatuh ke akun pertama bila blok pilihan sudah tidak terpilih", () => {
    expect(resolveActiveAccountId(["b", "a"], "x")).toBe("b");
  });

  it("undefined bila tidak ada akun terpilih", () => {
    expect(resolveActiveAccountId([], "a")).toBeUndefined();
  });
});

describe("getPinLinkHint", () => {
  it("tanpa petunjuk untuk link kosong (opsional) atau URL http(s) valid", () => {
    expect(getPinLinkHint("")).toBeNull();
    expect(getPinLinkHint("   ")).toBeNull();
    expect(getPinLinkHint("https://contoh.com/a")).toBeNull();
    expect(getPinLinkHint(" http://contoh.com ")).toBeNull();
  });

  it("memberi petunjuk untuk link tanpa skema atau skema lain", () => {
    expect(getPinLinkHint("contoh.com")).toBe(PIN_LINK_HINT);
    expect(getPinLinkHint("ftp://contoh.com")).toBe(PIN_LINK_HINT);
    expect(getPinLinkHint("javascript:alert(1)")).toBe(PIN_LINK_HINT);
  });
});

describe("summarizeBlockIssues", () => {
  it("undefined tanpa pelanggaran", () => {
    expect(summarizeBlockIssues(undefined)).toBeUndefined();
    expect(summarizeBlockIssues([])).toBeUndefined();
  });

  it("pesan apa adanya untuk satu pelanggaran", () => {
    expect(
      summarizeBlockIssues([
        { code: "media-required", message: "Butuh media" },
      ]),
    ).toBe("Butuh media");
  });

  it("menambahkan jumlah sisa bila lebih dari satu", () => {
    expect(
      summarizeBlockIssues([
        { code: "media-required", message: "Butuh media" },
        { code: "reel-requires-video", message: "Reel butuh video" },
      ]),
    ).toBe("Butuh media (+1 lagi)");
  });
});
