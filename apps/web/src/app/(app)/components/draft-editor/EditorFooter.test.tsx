// @vitest-environment jsdom
import { useState } from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/user-time-zone-context", () => ({
  useUserTimeZone: () => "Asia/Jakarta",
}));

import { ContentStatus } from "@postific/shared";

import { EditorFooter } from "./EditorFooter";

// 14:20 WIB, Selasa 3 Nov 2026 (jam rancangan). Hanya Date yang dipalsukan;
// timer tetap nyata supaya popover dan userEvent berjalan normal.
const NOW = new Date("2026-11-03T07:20:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({
  isReadyToSchedule = true,
  isReadyToPublishNow = true,
  initialDate,
  initialTime,
  scheduleTimeMessage = null,
  selectedAccountCount = 2,
  warningCount = 0,
  status = ContentStatus.Draft,
  isNarrow = false,
  handlers = {},
}: {
  isReadyToSchedule?: boolean;
  isReadyToPublishNow?: boolean;
  initialDate?: string;
  initialTime?: string;
  scheduleTimeMessage?: string | null;
  selectedAccountCount?: number;
  warningCount?: number;
  status?: ContentStatus;
  isNarrow?: boolean;
  handlers?: Partial<{
    onSaveDraft: () => void;
    onSubmitForReview: () => void;
    onRequestPublishNow: () => void;
    onRequestSchedule: () => void;
  }>;
}) {
  const [date, setDate] = useState<string | undefined>(initialDate);
  const [time, setTime] = useState<string | undefined>(initialTime);
  return (
    <EditorFooter
      isNarrow={isNarrow}
      isLoadingDraft={false}
      status={status}
      pendingAction={null}
      isSavingDraft={false}
      isSubmittingReview={false}
      isScheduling={false}
      isPublishingNow={false}
      isLoadingAccounts={false}
      isReadyToSchedule={isReadyToSchedule}
      isReadyToPublishNow={isReadyToPublishNow}
      selectedAccountCount={selectedAccountCount}
      warningCount={warningCount}
      scheduleDate={date}
      scheduleTime={time}
      scheduleTimeMessage={scheduleTimeMessage}
      onScheduleDateChange={setDate}
      onScheduleTimeChange={setTime}
      onCancelPending={vi.fn()}
      onConfirmSchedule={vi.fn()}
      onConfirmPublishNow={vi.fn()}
      onSaveDraft={handlers.onSaveDraft ?? vi.fn()}
      onSubmitForReview={handlers.onSubmitForReview ?? vi.fn()}
      onRequestPublishNow={handlers.onRequestPublishNow ?? vi.fn()}
      onRequestSchedule={handlers.onRequestSchedule ?? vi.fn()}
    />
  );
}

const button = (name: RegExp | string) => screen.getByRole("button", { name });

describe("EditorFooter: tombol dan label jadwal", () => {
  it("tanpa jadwal tombol berbunyi Atur jadwal dan Schedule nonaktif", () => {
    render(<Harness isReadyToSchedule={false} />);
    expect(button(/^Jadwal: Atur jadwal$/)).toBeTruthy();
    expect(button("Schedule")).toHaveProperty("disabled", true);
    expect(button("Publish Now")).toHaveProperty("disabled", false);
    expect(button("Save as Draft")).toHaveProperty("disabled", false);
  });

  it("jadwal terisi tampil di tombol seperti rancangan", () => {
    render(<Harness initialDate="2026-11-04" initialTime="10:00" />);
    expect(button("Jadwal: Rab, 4 Nov · 10:00 WIB")).toBeTruthy();
    expect(button("Schedule")).toHaveProperty("disabled", false);
  });

  it("pesan validasi jadwal tampil di footer", () => {
    render(
      <Harness
        initialDate="2020-01-01"
        initialTime="10:00"
        isReadyToSchedule={false}
        scheduleTimeMessage="Waktu yang dipilih sudah lewat."
      />,
    );
    expect(screen.getByText("Waktu yang dipilih sudah lewat.")).toBeTruthy();
    expect(button("Schedule")).toHaveProperty("disabled", true);
    // T-250: pesan jadwal destructive memakai ikon peringatan.
    const alert = screen.getByTestId("schedule-message");
    expect(alert.className).toContain("text-destructive");
    expect(alert.querySelector("svg")).not.toBeNull();
  });

  it("teks bantuan menampilkan jumlah akun dan peringatan", () => {
    render(<Harness selectedAccountCount={3} warningCount={2} />);
    expect(screen.getByText("3 akun · 2 peringatan")).toBeTruthy();
  });

  it("tombol memanggil handler masing-masing", async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();
    const onRequestPublishNow = vi.fn();
    const onRequestSchedule = vi.fn();
    render(
      <Harness
        handlers={{ onSaveDraft, onRequestPublishNow, onRequestSchedule }}
      />,
    );
    await user.click(button("Save as Draft"));
    await user.click(button("Publish Now"));
    await user.click(button("Schedule"));
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onRequestPublishNow).toHaveBeenCalledTimes(1);
    expect(onRequestSchedule).toHaveBeenCalledTimes(1);
  });
});

describe("EditorFooter: popover Atur jadwal", () => {
  async function openPopover() {
    const user = userEvent.setup();
    const view = render(<Harness />);
    await user.click(button(/^Jadwal:/));
    const dialog = await screen.findByRole("dialog");
    return { user, dialog, view };
  }

  it("menampilkan penjelasan zona dan batas 30 hari", async () => {
    const { dialog } = await openPopover();
    expect(
      within(dialog).getByText("Waktu dibaca di zona waktu Anda: WIB (UTC+7)."),
    ).toBeTruthy();
    expect(within(dialog).queryByText(/Asia\/Jakarta/)).toBeNull();
    // Baris Jam hanya memuat singkatan zona setelah input.
    expect(within(dialog).getByText("WIB")).toBeTruthy();
    expect(
      within(dialog).getByText(
        "Jadwal maksimal 30 hari ke depan: tanggal setelah 3 Des 2026 dinonaktifkan. Hari ini Sel, 3 Nov, 14:20 WIB.",
      ),
    ).toBeTruthy();
  });

  it("hari lampau dan hari setelah batas 30 hari nonaktif; hari ini dan hari batas masih bisa dipilih", async () => {
    const { dialog } = await openPopover();
    const day = (label: string) =>
      within(dialog).getByRole("button", {
        name: new RegExp(`(^|, )${label}$`),
      }) as HTMLButtonElement;

    // Hari lampau (kemarin) nonaktif; hari ini dan besok aktif.
    expect(day("2 November 2026").disabled).toBe(true);
    expect(day("3 November 2026").disabled).toBe(false);
    expect(day("4 November 2026").disabled).toBe(false);
    // Batas: 3 Des 2026 (hari ini + 30) aktif, 4 Des 2026 nonaktif.
    expect(day("3 Desember 2026").disabled).toBe(false);
    expect(day("4 Desember 2026").disabled).toBe(true);
  });

  it("memilih tanggal mengisi label tombol dengan jam bawaan 10:00; jam bisa diubah", async () => {
    const { user, dialog } = await openPopover();
    await user.click(
      within(dialog).getByRole("button", { name: /Kamis, 5 November 2026$/ }),
    );
    expect(button("Jadwal: Kam, 5 Nov · 10:00 WIB")).toBeTruthy();

    const timeInput = within(dialog).getByLabelText("Jam");
    await user.clear(timeInput);
    await user.type(timeInput, "1530");
    expect(button("Jadwal: Kam, 5 Nov · 15:30 WIB")).toBeTruthy();
  });

  it("Hapus jadwal mengosongkan tanggal dan jam", async () => {
    const user = userEvent.setup();
    render(<Harness initialDate="2026-11-05" initialTime="09:00" />);
    await user.click(button(/^Jadwal:/));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Hapus jadwal" }),
    );
    expect(button("Jadwal: Atur jadwal")).toBeTruthy();
  });

  it("tidak ada Next Available di footer maupun popover (ADR-155)", async () => {
    const { dialog } = await openPopover();
    expect(screen.queryByText(/next available/i)).toBeNull();
    expect(within(dialog).queryByText(/next available/i)).toBeNull();
  });
});

describe("EditorFooter: Ajukan Review per status (T-296)", () => {
  const AWAITING = "Menunggu review · Tandai Ready di Publish > Approvals";

  it("Draft: Ajukan Review tampil dan memanggil handler; Schedule dan Publish Now tetap ada", async () => {
    const onSubmitForReview = vi.fn();
    render(
      <Harness status={ContentStatus.Draft} handlers={{ onSubmitForReview }} />,
    );
    await userEvent.click(button("Ajukan Review"));
    expect(onSubmitForReview).toHaveBeenCalledTimes(1);
    expect(button("Save as Draft")).toBeTruthy();
    expect(screen.queryByText(AWAITING)).toBeNull();
  });

  it("In Review: tanpa Ajukan Review, catatan menunggu review, Simpan, Schedule dan Publish Now aktif", () => {
    render(<Harness status={ContentStatus.InReview} />);
    expect(screen.queryByRole("button", { name: "Ajukan Review" })).toBeNull();
    expect(screen.getByText(AWAITING)).toBeTruthy();
    expect(button("Simpan")).toHaveProperty("disabled", false);
    expect(screen.queryByRole("button", { name: "Save as Draft" })).toBeNull();
    expect(button("Schedule")).toHaveProperty("disabled", false);
    expect(button("Publish Now")).toHaveProperty("disabled", false);
  });

  it("In Review di layar sempit: catatan disembunyikan seperti bantuan footer", () => {
    render(<Harness status={ContentStatus.InReview} isNarrow />);
    expect(screen.queryByText(AWAITING)).toBeNull();
    expect(button("Simpan")).toBeTruthy();
  });

  it("Ready to Schedule: tanpa Ajukan Review dan tanpa catatan, label Simpan", () => {
    render(<Harness status={ContentStatus.ReadyToSchedule} />);
    expect(screen.queryByRole("button", { name: "Ajukan Review" })).toBeNull();
    expect(screen.queryByText(AWAITING)).toBeNull();
    expect(button("Simpan")).toBeTruthy();
  });
});
