import { describe, expect, it } from "vitest";
import {
  canTransitionInboxStatus,
  inboxCountWindowStart,
} from "./inbox-status";

describe("inboxCountWindowStart", () => {
  it("mundur 12 bulan kalender dari now (UTC)", () => {
    expect(
      inboxCountWindowStart(new Date("2026-11-06T10:00:00.000Z")).toISOString(),
    ).toBe("2025-11-06T10:00:00.000Z");
  });

  it("menjepit 29 Februari ke akhir Februari tahun non-kabisat", () => {
    expect(
      inboxCountWindowStart(new Date("2028-02-29T00:00:00.000Z")).toISOString(),
    ).toBe("2027-02-28T00:00:00.000Z");
  });
});

describe("canTransitionInboxStatus", () => {
  it("resolved dan dismissed hanya bisa dibuka kembali ke unread", () => {
    expect(canTransitionInboxStatus("resolved", "unread")).toBe(true);
    expect(canTransitionInboxStatus("dismissed", "unread")).toBe(true);
    expect(canTransitionInboxStatus("resolved", "dismissed")).toBe(false);
  });

  it("status lama `done` (belum dimigrasi) ditolak tanpa melempar", () => {
    expect(canTransitionInboxStatus("done" as never, "unread")).toBe(false);
  });
});
