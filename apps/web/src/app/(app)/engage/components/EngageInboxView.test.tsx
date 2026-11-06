// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EngagementInboxItemRecord } from "@/domains/engagement";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserTimeZoneProvider } from "@/lib/time/user-time-zone-context";

const mocks = vi.hoisted(() => ({
  listInboxAction: vi.fn(),
  listInboxByPostAction: vi.fn(),
  changeInboxItemStatusAction: vi.fn(),
  replyToCommentAction: vi.fn(),
  refreshInboxAction: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  listInboxAction: mocks.listInboxAction,
  listInboxByPostAction: mocks.listInboxByPostAction,
  changeInboxItemStatusAction: mocks.changeInboxItemStatusAction,
  replyToCommentAction: mocks.replyToCommentAction,
  refreshInboxAction: mocks.refreshInboxAction,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import type { InboxPostGroupDto } from "../actions";
import { EngageInboxView } from "./EngageInboxView";

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

function comment(
  id: string,
  authorHandle: string,
  status: EngagementInboxItemRecord["status"],
  postId: string | null,
  hours: number,
): EngagementInboxItemRecord {
  return {
    id,
    workspaceId: "w1",
    connectedAccountId: "a1",
    platform: "instagram",
    type: "comment",
    externalId: id,
    authorHandle,
    content: `isi ${id}`,
    status,
    postId,
    receivedAt: hoursAgo(hours),
    readAt: null,
    createdAt: hoursAgo(hours),
    updatedAt: hoursAgo(hours),
  } as unknown as EngagementInboxItemRecord;
}

function group(
  postId: string | null,
  caption: string,
  counts: { unread: number; handled: number },
): InboxPostGroupDto {
  return {
    postId,
    connectedAccountId: "a1",
    platform: "instagram",
    connectedAccountIds: ["a1"],
    totalCount: counts.unread + counts.handled,
    unrepliedCount: counts.unread,
    handledCount: counts.handled,
    latestReceivedAt: hoursAgo(1),
    statuses: [],
    postSnapshot: postId
      ? { caption, platformPostUrl: "https://ig.example/p", thumbnail: null }
      : null,
  } as unknown as InboxPostGroupDto;
}

const GROUPS = [
  group("p1", "Kopi susu gula aren", { unread: 1, handled: 2 }),
  {
    ...group("p2", "Latte art 60 detik", { unread: 0, handled: 1 }),
    connectedAccountId: "a2",
  } as unknown as InboxPostGroupDto,
  group(null, "", { unread: 1, handled: 0 }),
];

const COMMENTS: Record<string, EngagementInboxItemRecord[]> = {
  p1: [
    comment("c1", "@maya", "unread", "p1", 1),
    comment("c2", "@lara", "replied", "p1", 5),
    comment("c3", "@anwar", "resolved", "p1", 7),
  ],
  p2: [comment("c4", "@raras", "resolved", "p2", 3)],
  none: [comment("c5", "@bayu", "unread", null, 2)],
};

function renderView(
  props: Partial<React.ComponentProps<typeof EngageInboxView>> = {},
) {
  return render(
    <UserTimeZoneProvider timeZone="Asia/Jakarta">
      <TooltipProvider>
        <EngageInboxView
          initialGroups={GROUPS}
          initialTruncated={false}
          initialLoadFailed={false}
          accounts={
            [
              { id: "a1", handle: "@kopiselasar", platform: "instagram" },
              { id: "a2", handle: "@kopi.tiktok", platform: "instagram" },
            ] as never
          }
          {...props}
        />
      </TooltipProvider>
    </UserTimeZoneProvider>,
  );
}

const cardOf = (caption: string) =>
  screen.getAllByText(caption)[0].closest('[data-slot="card"]') as HTMLElement;

const rowOf = (handle: string) =>
  screen.getAllByText(handle)[0].closest("[data-status]") as HTMLElement;

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  Object.values(mocks).forEach((m) => "mockReset" in m && m.mockReset());
  mocks.toast.error.mockReset();
  mocks.listInboxAction.mockImplementation(
    async (filter: { postId?: string | null }) => ({
      data:
        filter.postId === undefined
          ? Object.values(COMMENTS).flat()
          : (COMMENTS[filter.postId ?? "none"] ?? []),
    }),
  );
  mocks.listInboxByPostAction.mockResolvedValue({ data: GROUPS });
  mocks.changeInboxItemStatusAction.mockResolvedValue({});
  mocks.replyToCommentAction.mockResolvedValue({ data: { id: "r1" } });
  mocks.refreshInboxAction.mockResolvedValue({ newCommentsCount: 0 });
});
afterEach(cleanup);

describe("EngageInboxView per posting (T-219)", () => {
  it("memilih posting pertama dan memuat komentarnya dengan ringkasan dibalas/total", async () => {
    renderView();

    expect(await screen.findByText("@maya")).toBeTruthy();
    expect(mocks.listInboxAction).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "p1", dateRange: "12m" }),
    );
    expect(screen.getByText("1 dibalas")).toBeTruthy();
    expect(screen.getByText(/3 total komentar/)).toBeTruthy();
    expect(
      screen.getByText(/1 belum dibalas · 2 dari 3 ditangani/),
    ).toBeTruthy();
    // Kelompok "Tanpa posting" ada di dasar daftar.
    expect(screen.getByText("Tanpa posting", { selector: "div" })).toBeTruthy();
  });

  it("mengurutkan belum dibalas dulu dan menampilkan label status Indonesia", async () => {
    renderView();
    await screen.findByText("@maya");
    const statuses = [...document.querySelectorAll("[data-status]")].map((el) =>
      el.getAttribute("data-status"),
    );
    expect(statuses).toEqual(["unread", "replied", "resolved"]);
    expect(within(rowOf("@maya")).getByText("Belum dibalas")).toBeTruthy();
    expect(within(rowOf("@anwar")).getByText("Selesai")).toBeTruthy();
  });

  it("Resolve mengubah status seketika (optimistis) lalu memanggil action", async () => {
    let finish: (v: object) => void = () => {};
    mocks.changeInboxItemStatusAction.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    renderView();
    await screen.findByText("@maya");

    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Resolve" }),
    );

    expect(within(rowOf("@maya")).getByText("Selesai")).toBeTruthy();
    expect(mocks.changeInboxItemStatusAction).toHaveBeenCalledWith(
      "c1",
      "resolved",
    );
    await act(async () => finish({}));
    expect(mocks.toast).toHaveBeenCalledWith("Komentar ditandai Selesai");
  });

  it("mengembalikan status dan menampilkan error bila server menolak", async () => {
    mocks.changeInboxItemStatusAction.mockResolvedValue({ error: "Gagal." });
    renderView();
    await screen.findByText("@maya");

    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Dismiss" }),
    );

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Gagal."),
    );
    expect(within(rowOf("@maya")).getByText("Belum dibalas")).toBeTruthy();
  });

  it("komentar Selesai bisa dibuka kembali", async () => {
    renderView();
    await screen.findByText("@anwar");
    fireEvent.click(
      within(rowOf("@anwar")).getByRole("button", { name: "Buka kembali" }),
    );
    expect(mocks.changeInboxItemStatusAction).toHaveBeenCalledWith(
      "c3",
      "unread",
    );
    expect(within(rowOf("@anwar")).getByText("Belum dibalas")).toBeTruthy();
  });

  it("Reply membuka komposer, Kirim memanggil action dan menandai Dibalas", async () => {
    renderView();
    await screen.findByText("@maya");
    const send = screen.getByRole("button", {
      name: "Kirim",
    }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Reply" }),
    );
    fireEvent.change(screen.getByLabelText("Balasan"), {
      target: { value: "Halo Maya" },
    });
    await act(async () => fireEvent.click(send));

    expect(mocks.replyToCommentAction).toHaveBeenCalledWith("c1", "Halo Maya");
    expect(within(rowOf("@maya")).getByText("Dibalas")).toBeTruthy();
    expect(mocks.toast).toHaveBeenCalledWith("Balasan terkirim");
    expect(
      screen.getByText("Balasan terkirim. Komentar ditandai Dibalas."),
    ).toBeTruthy();
  });

  it("kelompok Tanpa posting: komposer dan Reply nonaktif dengan pesan, Resolve tetap ada", async () => {
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(screen.getByRole("button", { name: "Tanpa posting" }));

    await screen.findByText("@bayu");
    expect(mocks.listInboxAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ postId: null }),
    );
    expect(
      screen.getAllByText(/tidak terkait posting, jadi tidak dapat dibalas/)
        .length,
    ).toBeGreaterThan(0);
    expect(
      (screen.getByLabelText("Balasan") as HTMLTextAreaElement).disabled,
    ).toBe(true);
    const row = rowOf("@bayu");
    expect(
      (within(row).getByRole("button", { name: "Reply" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(within(row).getByRole("button", { name: "Resolve" })).toBeTruthy();
  });

  it("memilih posting lain memuat komentarnya", async () => {
    renderView();
    await screen.findByText("@maya");

    fireEvent.click(screen.getByRole("button", { name: "@kopi.tiktok" }));

    expect(await screen.findByText("@raras")).toBeTruthy();
    expect(screen.queryByText("@maya")).toBeNull();
    expect(mocks.listInboxAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ postId: "p2" }),
    );
  });

  it("refresh gagal menampilkan Alert dan mempertahankan data lama", async () => {
    mocks.refreshInboxAction.mockResolvedValue({ error: "boom" });
    renderView();
    await screen.findByText("@maya");

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Refresh/ })),
    );

    expect(
      screen.getByText("Komentar terbaru belum dapat diambil"),
    ).toBeTruthy();
    expect(screen.getByText("@maya")).toBeTruthy();
  });

  it("render awal tidak meminta daftar posting lagi; komentar dimuat sekali", async () => {
    renderView();
    await screen.findByText("@maya");
    expect(mocks.listInboxByPostAction).not.toHaveBeenCalled();
    expect(mocks.listInboxAction).toHaveBeenCalledTimes(1);
  });

  it("mengubah Sort By memicu query server-side dengan sort baru dan rentang bawaan", async () => {
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "Terbaru" })),
    );
    expect(mocks.listInboxByPostAction).toHaveBeenCalledTimes(1);
    expect(mocks.listInboxByPostAction).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest", dateRange: "12m" }),
    );
  });

  it("mengubah Date Range memuat ulang daftar dan komentar dengan rentang itu", async () => {
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "7 hari terakhir" })),
    );
    expect(mocks.listInboxByPostAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ dateRange: "7d" }),
    );
    await waitFor(() =>
      expect(mocks.listInboxAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ postId: "p1", dateRange: "7d" }),
      ),
    );
  });

  it("Reset filters mengembalikan Sort dan Date Range ke bawaan", async () => {
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "Terlama" })),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Reset filters" })),
    );
    expect(mocks.listInboxByPostAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "unreplied_first", dateRange: "12m" }),
    );
  });

  it("Refresh sukses memperbarui daftar dan menampilkan toast jumlah komentar", async () => {
    mocks.refreshInboxAction.mockResolvedValue({ newCommentsCount: 3 });
    renderView();
    await screen.findByText("@maya");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Refresh/ })),
    );
    expect(mocks.listInboxByPostAction).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("3 komentar baru");
  });

  it("Refresh server sukses tetapi daftar gagal dimuat: hanya toast error, tanpa toast komentar baru", async () => {
    mocks.listInboxByPostAction.mockResolvedValue({ error: "Daftar gagal." });
    renderView();
    await screen.findByText("@maya");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Refresh/ })),
    );
    expect(mocks.toast.error).toHaveBeenCalledWith("Daftar gagal.");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByText("@maya")).toBeTruthy();
  });

  it("membalas komentar yang bukan Belum dibalas tidak mengklaim ditandai Dibalas", async () => {
    renderView();
    await screen.findByText("@anwar");
    fireEvent.click(
      within(rowOf("@anwar")).getByRole("button", { name: "Reply" }),
    );
    fireEvent.change(screen.getByLabelText("Balasan"), {
      target: { value: "Terima kasih" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Kirim" })),
    );
    expect(screen.getByText("Balasan terkirim.")).toBeTruthy();
    expect(screen.queryByText(/ditandai Dibalas/)).toBeNull();
    expect(within(rowOf("@anwar")).getByText("Selesai")).toBeTruthy();
  });

  it("kosong tanpa filter: ajakan Buka Publish dan akses ke posting tanpa komentar", async () => {
    renderView({ initialGroups: [] });
    expect(screen.getByText("Belum ada interaksi")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buka Publish" })).toBeTruthy();

    mocks.listInboxByPostAction.mockResolvedValue({ data: [] });
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: "Tampilkan posting tanpa komentar",
        }),
      ),
    );
    expect(mocks.listInboxByPostAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeEmpty: true }),
    );
  });

  it("filter aktif tanpa hasil: pesan filter dan Reset filters memulihkan bawaan", async () => {
    renderView({ initialGroups: [] });
    mocks.listInboxByPostAction.mockResolvedValue({ data: [] });
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "Terbaru" })),
    );
    expect(
      screen.getByText("Tidak ada interaksi untuk filter ini"),
    ).toBeTruthy();
    expect(screen.queryByText("Belum ada interaksi")).toBeNull();

    await act(async () =>
      fireEvent.click(
        screen.getAllByRole("button", { name: "Reset filters" })[0],
      ),
    );
    expect(mocks.listInboxByPostAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "unreplied_first", dateRange: "12m" }),
    );
    expect(screen.getByText("Belum ada interaksi")).toBeTruthy();
  });

  it("memuat awal gagal hanya menampilkan Alert, bukan Belum ada interaksi", () => {
    renderView({ initialGroups: [], initialLoadFailed: true });
    expect(
      screen.getByText("Komentar terbaru belum dapat diambil"),
    ).toBeTruthy();
    expect(screen.queryByText("Belum ada interaksi")).toBeNull();
    expect(
      screen.queryByText("Tidak ada interaksi untuk filter ini"),
    ).toBeNull();
  });

  it("toggle posting tanpa komentar nonaktif dengan alasan saat filter Status aktif", async () => {
    renderView();
    await screen.findByText("@maya");
    const toggle = () =>
      screen.getByRole("button", {
        name: /Tampilkan semua posting, termasuk yang belum punya komentar/,
      }) as HTMLButtonElement;
    expect(toggle().disabled).toBe(false);

    fireEvent.keyDown(screen.getByLabelText("Filter status komentar"), {
      key: "ArrowDown",
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("option", { name: "Selesai" })),
    );
    expect(toggle().disabled).toBe(true);
  });

  it("balasan yang gagal terkirim mempertahankan draf dan komposer", async () => {
    mocks.replyToCommentAction.mockResolvedValue({ error: "Gagal kirim." });
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Reply" }),
    );
    fireEvent.change(screen.getByLabelText("Balasan"), {
      target: { value: "Draf penting" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Kirim" })),
    );
    expect(mocks.toast.error).toHaveBeenCalledWith("Gagal kirim.");
    expect(
      (screen.getByLabelText("Balasan") as HTMLTextAreaElement).value,
    ).toBe("Draf penting");
    expect(within(rowOf("@maya")).getByText("Belum dibalas")).toBeTruthy();
  });

  it("Resolve yang gagal mengembalikan hitungan kartu dan tidak membuang draf", async () => {
    let fail: (v: object) => void = () => {};
    mocks.changeInboxItemStatusAction.mockReturnValue(
      new Promise((resolve) => (fail = resolve)),
    );
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Reply" }),
    );
    fireEvent.change(screen.getByLabelText("Balasan"), {
      target: { value: "Draf" },
    });

    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Dismiss" }),
    );
    // Optimistis: satu-satunya komentar belum dibalas posting ini ditangani.
    expect(
      within(cardOf("Kopi susu gula aren")).getByLabelText(
        "Semua komentar sudah ditangani",
      ),
    ).toBeTruthy();

    await act(async () => fail({ error: "Ditolak." }));
    expect(
      within(cardOf("Kopi susu gula aren")).getByLabelText("1 belum dibalas"),
    ).toBeTruthy();
    expect(within(rowOf("@maya")).getByText("Belum dibalas")).toBeTruthy();
    expect(
      (screen.getByLabelText("Balasan") as HTMLTextAreaElement).value,
    ).toBe("Draf");
  });

  it("Resolve yang berhasil pada komentar yang sedang dibalas menutup komposer", async () => {
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Reply" }),
    );
    fireEvent.change(screen.getByLabelText("Balasan"), {
      target: { value: "Draf" },
    });
    await act(async () =>
      fireEvent.click(
        within(rowOf("@maya")).getByRole("button", { name: "Resolve" }),
      ),
    );
    expect(
      (screen.getByLabelText("Balasan") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("rollback tidak menghitung ganda bila daftar posting diganti fetch lain saat menunggu", async () => {
    let fail: (v: object) => void = () => {};
    mocks.changeInboxItemStatusAction.mockReturnValue(
      new Promise((resolve) => (fail = resolve)),
    );
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(
      within(rowOf("@maya")).getByRole("button", { name: "Dismiss" }),
    );

    // Refresh membawa hitungan server (belum memuat perubahan): unread = 1.
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Refresh/ })),
    );
    expect(
      within(cardOf("Kopi susu gula aren")).getByLabelText("1 belum dibalas"),
    ).toBeTruthy();

    await act(async () => fail({ error: "Ditolak." }));
    expect(
      within(cardOf("Kopi susu gula aren")).getByLabelText("1 belum dibalas"),
    ).toBeTruthy();
    expect(screen.queryByLabelText("2 belum dibalas")).toBeNull();
  });

  it("Refresh yang selesai setelah filter berubah tidak menimpa daftar dengan filter lama", async () => {
    let finishRefresh: (v: object) => void = () => {};
    mocks.refreshInboxAction.mockReturnValue(
      new Promise((resolve) => (finishRefresh = resolve)),
    );
    mocks.listInboxByPostAction.mockImplementation(
      async (input: { sort?: string }) => ({
        data: input.sort === "newest" ? [GROUPS[1]] : GROUPS,
      }),
    );
    renderView();
    await screen.findByText("@maya");

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "Terbaru" })),
    );
    await waitFor(() =>
      expect(screen.queryAllByText("Kopi susu gula aren")).toHaveLength(0),
    );

    // Refresh memanggil ulang daftar dengan filter lama (bawaan); hasilnya dibuang.
    await act(async () => finishRefresh({ newCommentsCount: 0 }));
    expect(mocks.listInboxByPostAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "unreplied_first" }),
    );
    expect(screen.queryAllByText("Kopi susu gula aren")).toHaveLength(0);
    expect(screen.getAllByText("Latte art 60 detik").length).toBeGreaterThan(0);
    // Hasil Refresh dibuang: tidak ada toast "tidak ada komentar baru" yang menyesatkan.
    expect(mocks.toast).not.toHaveBeenCalledWith("Tidak ada komentar baru");
  });

  describe("tampilan List (T-224)", () => {
    async function openList() {
      renderView();
      await screen.findByText("@maya");
      fireEvent.click(screen.getByRole("radio", { name: "List" }));
      await screen.findByText("@bayu");
    }

    it("By post tetap bawaan dan List baru memuat daftar datar saat dibuka", async () => {
      renderView();
      await screen.findByText("@maya");
      expect(
        screen
          .getByRole("radio", { name: "By post" })
          .getAttribute("data-state"),
      ).toBe("on");
      expect(mocks.listInboxAction).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("radio", { name: "List" }));
      await screen.findByText("@bayu");
      const flatCall = mocks.listInboxAction.mock.calls.at(-1)?.[0];
      expect(flatCall).not.toHaveProperty("postId");
      expect(flatCall).toEqual(expect.objectContaining({ dateRange: "12m" }));
    });

    it("menampilkan komentar lintas posting dengan ringkasan dan baris konteks", async () => {
      await openList();
      // c1, c2, c3, c4, c5 = 5 komentar; unread: c1 dan c5.
      expect(screen.getByText("2 belum dibalas")).toBeTruthy();
      expect(screen.getByText(/5 komentar/)).toBeTruthy();
      expect(
        screen.getByText(/Urut: Belum dibalas dulu · 12 bulan terakhir/),
      ).toBeTruthy();
      expect(
        within(rowOf("@maya")).getByText("Pada posting: Kopi susu gula aren"),
      ).toBeTruthy();
      expect(within(rowOf("@bayu")).getByText("Tanpa posting")).toBeTruthy();
      expect(screen.queryByLabelText("Balasan")).toBeNull();
    });

    it("filter Date Range berlaku di List dan memuat ulang daftar datar", async () => {
      await openList();
      fireEvent.click(
        screen.getByRole("button", { name: /Filter dan urutan/ }),
      );
      await act(async () =>
        fireEvent.click(screen.getByRole("radio", { name: "7 hari terakhir" })),
      );
      await waitFor(() => {
        const last = mocks.listInboxAction.mock.calls.at(-1)?.[0];
        expect(last).toEqual(expect.objectContaining({ dateRange: "7d" }));
        expect(last).not.toHaveProperty("postId");
      });
    });

    it("Resolve di List mengubah status seketika dan memanggil action", async () => {
      await openList();
      fireEvent.click(
        within(rowOf("@maya")).getByRole("button", { name: "Resolve" }),
      );
      expect(within(rowOf("@maya")).getByText("Selesai")).toBeTruthy();
      expect(mocks.changeInboxItemStatusAction).toHaveBeenCalledWith(
        "c1",
        "resolved",
      );
    });

    it("Reply membuka komposer inline di bawah komentar itu dan mengirim balasan", async () => {
      await openList();
      fireEvent.click(
        within(rowOf("@maya")).getByRole("button", { name: "Reply" }),
      );
      const box = within(rowOf("@maya")).getByLabelText("Balasan");
      fireEvent.change(box, { target: { value: "Halo" } });
      await act(async () =>
        fireEvent.click(
          within(rowOf("@maya")).getByRole("button", { name: "Kirim" }),
        ),
      );
      expect(mocks.replyToCommentAction).toHaveBeenCalledWith("c1", "Halo");
      expect(within(rowOf("@maya")).getByText("Dibalas")).toBeTruthy();
    });

    it("Reply nonaktif untuk komentar Tanpa posting, Resolve tetap ada", async () => {
      await openList();
      const row = rowOf("@bayu");
      expect(
        (
          within(row).getByRole("button", {
            name: "Reply",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(within(row).getByRole("button", { name: "Resolve" })).toBeTruthy();
    });

    it("baris konteks membuka posting itu di By post", async () => {
      await openList();
      fireEvent.click(
        within(rowOf("@raras")).getByRole("button", {
          name: /Pada posting: Latte art/,
        }),
      );
      expect(await screen.findByLabelText("Balasan")).toBeTruthy();
      expect(
        screen
          .getByRole("radio", { name: "By post" })
          .getAttribute("data-state"),
      ).toBe("on");
      await waitFor(() =>
        expect(mocks.listInboxAction).toHaveBeenLastCalledWith(
          expect.objectContaining({ postId: "p2" }),
        ),
      );
    });

    it("memberi tahu bila daftar terpotong di batas muat", async () => {
      mocks.listInboxAction.mockImplementation(async () => ({
        data: Array.from({ length: 200 }, (_, i) =>
          comment(`x${i}`, `@u${i}`, "replied", "p1", i + 1),
        ),
      }));
      renderView();
      await waitFor(() => expect(mocks.listInboxAction).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("radio", { name: "List" }));
      expect(
        await screen.findByText(/Menampilkan 200 komentar terbaru/),
      ).toBeTruthy();
    });

    it("kosong di List: tanpa filter Belum ada interaksi; filter aktif menawarkan Reset filters", async () => {
      renderView();
      await screen.findByText("@maya");
      mocks.listInboxAction.mockImplementation(
        async (f: { postId?: string | null; dateRange?: string }) => ({
          data:
            f.postId === undefined
              ? f.dateRange === "7d"
                ? []
                : Object.values(COMMENTS).flat()
              : (COMMENTS[f.postId ?? "none"] ?? []),
        }),
      );
      fireEvent.click(screen.getByRole("radio", { name: "List" }));
      await screen.findByText("@bayu");

      fireEvent.click(
        screen.getByRole("button", { name: /Filter dan urutan/ }),
      );
      await act(async () =>
        fireEvent.click(screen.getByRole("radio", { name: "7 hari terakhir" })),
      );
      expect(
        await screen.findByText("Tidak ada interaksi untuk filter ini"),
      ).toBeTruthy();
      expect(screen.queryByText("Belum ada interaksi")).toBeNull();

      await act(async () =>
        fireEvent.click(
          screen.getAllByRole("button", { name: "Reset filters" })[0],
        ),
      );
      expect(await screen.findByText("@bayu")).toBeTruthy();
    });

    it("di List tidak memuat komentar per posting; kembali ke By post memuat ulang", async () => {
      await openList();
      mocks.listInboxAction.mockClear();

      fireEvent.click(
        screen.getByRole("button", { name: /Filter dan urutan/ }),
      );
      await act(async () =>
        fireEvent.click(screen.getByRole("radio", { name: "7 hari terakhir" })),
      );
      await waitFor(() => expect(mocks.listInboxAction).toHaveBeenCalled());
      for (const [filter] of mocks.listInboxAction.mock.calls) {
        expect(filter.postId).toBeUndefined();
      }

      mocks.listInboxAction.mockClear();
      fireEvent.keyDown(document.body, { key: "Escape" });
      fireEvent.click(screen.getByRole("radio", { name: "By post" }));
      await waitFor(() =>
        expect(mocks.listInboxAction).toHaveBeenCalledWith(
          expect.objectContaining({ postId: "p1", dateRange: "7d" }),
        ),
      );
      expect(await screen.findByText("@maya")).toBeTruthy();
    });

    it("komentar dari posting di luar daftar tidak membuka posting lain dan ada catatan 100 posting", async () => {
      mocks.listInboxAction.mockImplementation(
        async (f: { postId?: string | null }) => ({
          data:
            f.postId === undefined
              ? [comment("c9", "@jauh", "unread", "p9", 2)]
              : (COMMENTS[f.postId ?? "none"] ?? []),
        }),
      );
      renderView({ initialTruncated: true });
      await screen.findByText("@maya");
      fireEvent.click(screen.getByRole("radio", { name: "List" }));
      await screen.findByText("@jauh");

      expect(
        screen.getByText(
          /Posting tidak ada di daftar \(hanya 100 posting terbaru\)/,
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(/Hanya 100 posting terbaru yang bisa dibuka/),
      ).toBeTruthy();
      expect(
        within(rowOf("@jauh")).queryByRole("button", { name: /Pada posting/ }),
      ).toBeNull();
    });
  });
});
