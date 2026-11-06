// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserTimeZoneProvider } from "@/lib/time/user-time-zone-context";

import { EngageToolbar, type EngageToolbarProps } from "./EngageToolbar";

const base: EngageToolbarProps = {
  accounts: [
    { id: "a1", handle: "@kopiselasar", platform: "instagram" },
  ] as never,
  accountFilter: "all",
  onAccountChange: vi.fn(),
  statusFilter: "all",
  onStatusChange: vi.fn(),
  platformFilter: "all",
  onPlatformChange: vi.fn(),
  sort: "unreplied_first",
  onSortChange: vi.fn(),
  dateRange: "12m",
  onDateRangeChange: vi.fn(),
  hasActiveFilter: false,
  onReset: vi.fn(),
};

function renderToolbar(props: Partial<EngageToolbarProps> = {}) {
  return render(
    <UserTimeZoneProvider timeZone="Asia/Jakarta">
      <EngageToolbar {...base} {...props} />
    </UserTimeZoneProvider>,
  );
}

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  vi.clearAllMocks();
});
afterEach(cleanup);

const openPanel = () =>
  fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));

describe("EngageToolbar (T-220)", () => {
  it("menampilkan label bawaan Akun dan Status", () => {
    renderToolbar();
    expect(
      screen.getByLabelText("Filter akun atau channel").textContent,
    ).toContain("Semua akun");
    expect(
      screen.getByLabelText("Filter status komentar").textContent,
    ).toContain("Status: Semua");
  });

  it("menampilkan handle akun dan label status terpilih", () => {
    renderToolbar({ accountFilter: "a1", statusFilter: "resolved" });
    expect(
      screen.getByLabelText("Filter akun atau channel").textContent,
    ).toContain("@kopiselasar");
    expect(
      screen.getByLabelText("Filter status komentar").textContent,
    ).toContain("Status: Selesai");
  });

  it("memilih status lewat dropdown memanggil onStatusChange", () => {
    renderToolbar();
    fireEvent.keyDown(screen.getByLabelText("Filter status komentar"), {
      key: "ArrowDown",
    });
    fireEvent.click(screen.getByRole("option", { name: "Diabaikan" }));
    expect(base.onStatusChange).toHaveBeenCalledWith("dismissed");
  });

  it("tombol panel tanpa penanda saat semua bawaan; Reset nonaktif", () => {
    renderToolbar();
    expect(
      screen.getByRole("button", { name: "Filter dan urutan" }),
    ).toBeTruthy();
    openPanel();
    expect(
      (
        screen.getByRole("button", {
          name: "Reset filters",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("menghitung filter panel yang menyimpang dari bawaan pada label tombol", () => {
    renderToolbar({
      sort: "newest",
      dateRange: "7d",
      platformFilter: "facebook",
      hasActiveFilter: true,
    });
    expect(
      screen.getByRole("button", { name: "Filter dan urutan (3 aktif)" }),
    ).toBeTruthy();
  });

  it("panel memuat Sort By, Date Range, Platform dan meneruskan pilihan", () => {
    renderToolbar();
    openPanel();
    expect(screen.getByText("Sort By")).toBeTruthy();
    expect(screen.getByText("Date Range")).toBeTruthy();
    expect(screen.getByText("Platform")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Terbaru" }));
    expect(base.onSortChange).toHaveBeenCalledWith("newest");
    fireEvent.click(screen.getByRole("radio", { name: "30 hari terakhir" }));
    expect(base.onDateRangeChange).toHaveBeenCalledWith("30d");
  });

  it("Reset filters aktif bila ada filter dan memanggil onReset", () => {
    renderToolbar({ hasActiveFilter: true });
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(base.onReset).toHaveBeenCalled();
  });

  it("menaruh slot toggle tampilan sebelum filter Akun (sisi kiri)", () => {
    renderToolbar({ viewToggleSlot: <span>slot-toggle</span> });
    const slot = screen.getByText("slot-toggle");
    const account = screen.getByLabelText("Filter akun atau channel");
    expect(
      slot.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
