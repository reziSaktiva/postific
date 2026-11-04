// @vitest-environment jsdom
import { ContentFormat, SocialPlatform } from "@postific/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/user-time-zone-context", () => ({
  useUserTimeZone: () => "Asia/Jakarta",
}));

import { ConfirmationSummary } from "./ConfirmationSummary";

afterEach(cleanup);

const ACCOUNTS = [
  {
    id: "ig",
    platform: SocialPlatform.Instagram,
    handle: "@kopi",
    status: "active",
  },
  {
    id: "pin",
    platform: SocialPlatform.Pinterest,
    handle: "kopi-board",
    status: "active",
  },
];

function renderSummary(
  overrides: Partial<Parameters<typeof ConfirmationSummary>[0]> = {},
) {
  return render(
    <ConfirmationSummary
      pendingAction="schedule"
      notice={null}
      caption="Promo kopi susu"
      selectedAccounts={ACCOUNTS}
      formatByAccount={{ ig: ContentFormat.Reel }}
      scheduleDate="2026-11-04"
      scheduleTime="10:00"
      {...overrides}
    />,
  );
}

describe("ConfirmationSummary", () => {
  it("Schedule: caption, akun dengan format, dan waktu berzona", () => {
    renderSummary();
    const summary = screen.getByLabelText("Ringkasan konfirmasi");
    expect(within(summary).getByText("Promo kopi susu")).toBeTruthy();
    expect(within(summary).getByText("Instagram @kopi")).toBeTruthy();
    // Format terpilih Reel; akun tanpa pilihan memakai format bawaan platform.
    expect(within(summary).getByText("Reel")).toBeTruthy();
    expect(within(summary).getByText("Pin")).toBeTruthy();
    expect(
      within(summary).getByText("Rab, 4 Nov 2026 · 10:00 WIB"),
    ).toBeTruthy();
  });

  it("Publish Now: waktu Sekarang dan catatan tayang langsung", () => {
    renderSummary({ pendingAction: "publish-now" });
    expect(screen.getByText("Sekarang")).toBeTruthy();
    expect(screen.getByText(/tayang langsung ke semua akun/)).toBeTruthy();
    expect(screen.queryByText(/Rab, 4 Nov/)).toBeNull();
  });

  it("caption kosong ditandai dan galat aksi ditampilkan", () => {
    renderSummary({
      caption: "",
      notice: { status: "error", title: "Gagal menjadwalkan" },
    });
    expect(screen.getByText("(kosong)")).toBeTruthy();
    expect(screen.getByText("Gagal menjadwalkan")).toBeTruthy();
  });
});
