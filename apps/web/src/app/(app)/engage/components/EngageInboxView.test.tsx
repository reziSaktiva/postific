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
  fetchPostGroupsPage: vi.fn(),
  fetchCommentsPage: vi.fn(),
  changeInboxItemStatusAction: vi.fn(),
  replyToCommentAction: vi.fn(),
  refreshInboxAction: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  changeInboxItemStatusAction: mocks.changeInboxItemStatusAction,
  replyToCommentAction: mocks.replyToCommentAction,
  refreshInboxAction: mocks.refreshInboxAction,
}));
vi.mock("../engage-client", () => ({
  fetchPostGroupsPage: mocks.fetchPostGroupsPage,
  fetchCommentsPage: mocks.fetchCommentsPage,
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

import type { InboxPostGroupDto } from "../engage-dto";
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
  counts: { unread: number; handled: number; replied?: number },
): InboxPostGroupDto {
  return {
    postId,
    connectedAccountId: "a1",
    platform: "instagram",
    connectedAccountIds: ["a1"],
    totalCount: counts.unread + counts.handled,
    unrepliedCount: counts.unread,
    handledCount: counts.handled,
    repliedCount: counts.replied ?? 0,
    latestReceivedAt: hoursAgo(1),
    oldestReceivedAt: hoursAgo(8),
    statuses: [],
    postSnapshot: postId
      ? { caption, platformPostUrl: "https://ig.example/p", thumbnail: null }
      : null,
  } as unknown as InboxPostGroupDto;
}

const GROUPS = [
  group("p1", "Kopi susu gula aren", { unread: 1, handled: 2, replied: 1 }),
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

const COUNTS = { postCount: 2, unrepliedCount: 2 };
const CAPTIONS: Record<string, string> = {
  p1: "Kopi susu gula aren",
  p2: "Latte art 60 detik",
};

function renderView(
  props: Partial<React.ComponentProps<typeof EngageInboxView>> = {},
) {
  return render(
    <UserTimeZoneProvider timeZone="Asia/Jakarta">
      <TooltipProvider>
        <EngageInboxView
          initialGroups={GROUPS}
          initialNextCursor={null}
          initialCounts={COUNTS}
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

/** Jawaban `fetchCommentsPage` bawaan: komentar per posting, atau semua (List) dengan hitungan. */
function commentsPage(
  request: { postId?: string },
  cursor: string | null = null,
) {
  void cursor;
  const items =
    request.postId === undefined
      ? Object.values(COMMENTS).flat()
      : (COMMENTS[request.postId] ?? []);
  return {
    items,
    nextCursor: null,
    counts:
      request.postId === undefined
        ? {
            total: items.length,
            unread: items.filter((i) => i.status === "unread").length,
          }
        : null,
    postCaptions: CAPTIONS,
  };
}

// Baris komentar; footer daftar juga membawa `data-status` (status daftar).
const COMMENT_ROWS = "[data-status]:not([data-slot])";

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
  mocks.fetchCommentsPage.mockImplementation(async (request, cursor) =>
    commentsPage(request, cursor),
  );
  mocks.fetchPostGroupsPage.mockResolvedValue({
    groups: GROUPS,
    nextCursor: null,
    counts: COUNTS,
  });
  mocks.changeInboxItemStatusAction.mockResolvedValue({});
  mocks.replyToCommentAction.mockResolvedValue({ data: { id: "r1" } });
  mocks.refreshInboxAction.mockResolvedValue({ newCommentsCount: 0 });
});
afterEach(cleanup);

describe("EngageInboxView per posting (T-219)", () => {
  it(
    "memilih posting pertama dan memuat komentarnya dengan ringkasan dibalas/total",
    { timeout: 15_000 },
    async () => {
      renderView();

      expect(await screen.findByText("@maya")).toBeTruthy();
      expect(mocks.fetchCommentsPage).toHaveBeenCalledWith(
        expect.objectContaining({ postId: "p1", dateRange: "12m" }),
        null,
      );
      expect(screen.getByText("1 dibalas")).toBeTruthy();
      expect(screen.getByText(/3 total komentar/)).toBeTruthy();
      expect(
        screen.getByText(/1 belum dibalas · 2 dari 3 ditangani/),
      ).toBeTruthy();
      // Kelompok "Tanpa posting" ada di dasar daftar.
      expect(
        screen.getByText("Tanpa posting", { selector: "div" }),
      ).toBeTruthy();
    },
  );

  it("mengurutkan belum dibalas dulu dan menampilkan label status Indonesia", async () => {
    renderView();
    await screen.findByText("@maya");
    const statuses = [...document.querySelectorAll(COMMENT_ROWS)].map((el) =>
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
    expect(mocks.fetchCommentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ postId: "none" }),
      null,
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
    expect(mocks.fetchCommentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ postId: "p2" }),
      null,
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
    expect(mocks.fetchPostGroupsPage).not.toHaveBeenCalled();
    expect(mocks.fetchCommentsPage).toHaveBeenCalledTimes(1);
  });

  it("mengubah Sort By memicu query server-side dengan sort baru dan rentang bawaan", async () => {
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "Terbaru" })),
    );
    expect(mocks.fetchPostGroupsPage).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPostGroupsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: "newest",
        dateRange: "12m",
        withCounts: true,
      }),
      null,
    );
  });

  it("mengubah Date Range memuat ulang daftar dan komentar dengan rentang itu", async () => {
    renderView();
    await screen.findByText("@maya");
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "7 hari terakhir" })),
    );
    expect(mocks.fetchPostGroupsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ dateRange: "7d" }),
      null,
    );
    await waitFor(() =>
      expect(mocks.fetchCommentsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ postId: "p1", dateRange: "7d" }),
        null,
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
    expect(mocks.fetchPostGroupsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "unreplied_first", dateRange: "12m" }),
      null,
    );
  });

  it("Refresh sukses memperbarui daftar dan menampilkan toast jumlah komentar", async () => {
    mocks.refreshInboxAction.mockResolvedValue({ newCommentsCount: 3 });
    renderView();
    await screen.findByText("@maya");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Refresh/ })),
    );
    expect(mocks.fetchPostGroupsPage).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("3 komentar baru");
  });

  it("Refresh server sukses tetapi daftar gagal dimuat: toast error, tanpa toast komentar baru, Alert Coba Lagi di daftar", async () => {
    mocks.fetchPostGroupsPage.mockRejectedValue(new Error("Daftar gagal."));
    renderView();
    await screen.findByText("@maya");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Refresh/ })),
    );
    expect(mocks.toast.error).toHaveBeenCalledWith("Daftar gagal.");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByText("Gagal memuat posting lainnya")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba Lagi" })).toBeTruthy();
    expect(screen.queryByText("Belum ada interaksi")).toBeNull();
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

    mocks.fetchPostGroupsPage.mockResolvedValue({
      groups: [],
      nextCursor: null,
      counts: { postCount: 0, unrepliedCount: 0 },
    });
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: "Tampilkan posting tanpa komentar",
        }),
      ),
    );
    expect(mocks.fetchPostGroupsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeEmpty: true }),
      null,
    );
  });

  it("filter aktif tanpa hasil: pesan filter dan Reset filters memulihkan bawaan", async () => {
    renderView({ initialGroups: [] });
    mocks.fetchPostGroupsPage.mockResolvedValue({
      groups: [],
      nextCursor: null,
      counts: { postCount: 0, unrepliedCount: 0 },
    });
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
    expect(mocks.fetchPostGroupsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "unreplied_first", dateRange: "12m" }),
      null,
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
    mocks.fetchPostGroupsPage.mockImplementation(
      async (request: { sort?: string }) => ({
        groups: request.sort === "newest" ? [GROUPS[1]] : GROUPS,
        nextCursor: null,
        counts: COUNTS,
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
    const callsBefore = mocks.fetchPostGroupsPage.mock.calls.length;

    // Refresh selesai di server setelah filter berubah: tidak memuat ulang
    // daftar dengan filter lama, jadi tidak menimpa hasil filter baru.
    await act(async () => finishRefresh({ newCommentsCount: 0 }));
    expect(mocks.fetchPostGroupsPage.mock.calls).toHaveLength(callsBefore);
    expect(screen.queryAllByText("Kopi susu gula aren")).toHaveLength(0);
    expect(screen.getAllByText("Latte art 60 detik").length).toBeGreaterThan(0);
    // Tidak ada toast "tidak ada komentar baru" yang menyesatkan.
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
      expect(mocks.fetchCommentsPage).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("radio", { name: "List" }));
      await screen.findByText("@bayu");
      const [flatRequest, cursor] = mocks.fetchCommentsPage.mock.calls.at(-1)!;
      expect(flatRequest).not.toHaveProperty("postId");
      expect(flatRequest).toEqual(
        expect.objectContaining({
          dateRange: "12m",
          withCounts: true,
          includePostCaptions: true,
        }),
      );
      expect(cursor).toBeNull();
    });

    it("menampilkan komentar lintas posting dengan hitungan sebenarnya dan baris konteks", async () => {
      await openList();
      // c1, c2, c3, c4, c5 = 5 komentar; unread: c1 dan c5 (hitungan dari count query).
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
        const [last, cursor] = mocks.fetchCommentsPage.mock.calls.at(-1)!;
        expect(last).toEqual(expect.objectContaining({ dateRange: "7d" }));
        expect(last).not.toHaveProperty("postId");
        expect(cursor).toBeNull();
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
      // Hitungan ikut berubah di tempat: c1 tidak lagi belum dibalas.
      expect(screen.getByText("1 belum dibalas")).toBeTruthy();
    });

    it("Reply membuka komposer inline di bawah komentar itu dan mengirim balasan, komentar tetap di tempatnya", async () => {
      await openList();
      const orderBefore = [...document.querySelectorAll(COMMENT_ROWS)].map(
        (el) => el.textContent?.match(/@\w+/)?.[0],
      );
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
      const orderAfter = [...document.querySelectorAll(COMMENT_ROWS)].map(
        (el) => el.textContent?.match(/@\w+/)?.[0],
      );
      expect(orderAfter).toEqual(orderBefore);
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
        expect(mocks.fetchCommentsPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ postId: "p2" }),
          null,
        ),
      );
      // p2 sudah ada di halaman termuat: tidak perlu mengambil kelompoknya.
      expect(mocks.fetchPostGroupsPage).not.toHaveBeenCalled();
    });

    it("posting yang belum ada di halaman termuat diambil sendiri lalu dibuka", async () => {
      const far = group("p9", "Posting jauh di bawah", {
        unread: 3,
        handled: 0,
      });
      mocks.fetchCommentsPage.mockImplementation(async (request, cursor) =>
        request.postId === undefined
          ? {
              ...commentsPage(request, cursor),
              items: [comment("c9", "@jauh", "unread", "p9", 2)],
              postCaptions: { p9: "Posting jauh di bawah" },
            }
          : request.postId === "p9"
            ? {
                ...commentsPage(request, cursor),
                items: [comment("c9", "@jauh", "unread", "p9", 2)],
              }
            : commentsPage(request, cursor),
      );
      renderView();
      await screen.findByText("@maya");
      fireEvent.click(screen.getByRole("radio", { name: "List" }));
      await screen.findByText("@jauh");

      mocks.fetchPostGroupsPage.mockResolvedValue({
        groups: [far],
        nextCursor: null,
        counts: null,
      });
      await act(async () =>
        fireEvent.click(
          within(rowOf("@jauh")).getByRole("button", {
            name: /Pada posting: Posting jauh/,
          }),
        ),
      );

      expect(mocks.fetchPostGroupsPage).toHaveBeenCalledWith(
        expect.objectContaining({ postId: "p9", includeEmpty: false }),
        null,
      );
      expect(await screen.findByLabelText("Balasan")).toBeTruthy();
      await waitFor(() =>
        expect(mocks.fetchCommentsPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ postId: "p9" }),
          null,
        ),
      );
      expect(screen.getByText(/3 total komentar/)).toBeTruthy();
    });

    it("kosong di List: tanpa filter Belum ada interaksi; filter aktif menawarkan Reset filters", async () => {
      renderView();
      await screen.findByText("@maya");
      mocks.fetchCommentsPage.mockImplementation(async (request, cursor) =>
        request.postId === undefined && request.dateRange === "7d"
          ? {
              items: [],
              nextCursor: null,
              counts: { total: 0, unread: 0 },
              postCaptions: {},
            }
          : commentsPage(request, cursor),
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
      mocks.fetchCommentsPage.mockClear();

      fireEvent.click(
        screen.getByRole("button", { name: /Filter dan urutan/ }),
      );
      await act(async () =>
        fireEvent.click(screen.getByRole("radio", { name: "7 hari terakhir" })),
      );
      await waitFor(() => expect(mocks.fetchCommentsPage).toHaveBeenCalled());
      for (const [request] of mocks.fetchCommentsPage.mock.calls) {
        expect(request.postId).toBeUndefined();
      }

      mocks.fetchCommentsPage.mockClear();
      fireEvent.keyDown(document.body, { key: "Escape" });
      fireEvent.click(screen.getByRole("radio", { name: "By post" }));
      await waitFor(() =>
        expect(mocks.fetchCommentsPage).toHaveBeenCalledWith(
          expect.objectContaining({ postId: "p1", dateRange: "7d" }),
          null,
        ),
      );
      expect(await screen.findByText("@maya")).toBeTruthy();
    });
  });
});

/**
 * Infinite scroll Engage (T-303, ADR-166): 20 per halaman lewat Route Handler,
 * tanpa batas 100 posting / 200 komentar / 1 000 komentar per posting.
 */
describe("infinite scroll Engage (T-303)", () => {
  interface FakeObserver {
    callback: IntersectionObserverCallback;
    disconnected: boolean;
  }
  let observers: FakeObserver[] = [];

  beforeEach(() => {
    observers = [];
    class StubObserver {
      private readonly record: FakeObserver;
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, disconnected: false };
        observers.push(this.record);
      }
      observe() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      disconnect() {
        this.record.disconnected = true;
      }
    }
    vi.stubGlobal("IntersectionObserver", StubObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Menggulir ke dasar daftar: semua sentinel yang masih terpasang terlihat. */
  async function scrollToEnd() {
    await act(async () => {
      for (const observer of observers.filter((o) => !o.disconnected)) {
        observer.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
    });
  }

  const flatComments = (
    from: number,
    to: number,
    status = "replied" as const,
  ) =>
    Array.from({ length: to - from }, (_, i) =>
      comment(`x${from + i}`, `@u${from + i}`, status, "p1", from + i + 1),
    );

  /** `fetchCommentsPage` List dengan 45 komentar, halaman 20 lewat cursor "page-N". */
  function flatPages(total = 45) {
    return async (
      request: { postId?: string },
      cursor: string | null,
    ): Promise<unknown> => {
      if (request.postId !== undefined) return commentsPage(request, cursor);
      const start = cursor ? Number(cursor.replace("page-", "")) : 0;
      const end = Math.min(start + 20, total);
      return {
        items: flatComments(start, end),
        nextCursor: end < total ? `page-${end}` : null,
        counts: cursor ? null : { total, unread: 0 },
        postCaptions: CAPTIONS,
      };
    };
  }

  async function openFlat(total = 45) {
    mocks.fetchCommentsPage.mockImplementation(flatPages(total));
    renderView();
    await screen.findByText("@u0", {}, { timeout: 3000 }).catch(() => null);
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    await screen.findByText("@u0");
  }

  it("List memuat 20 dulu, halaman berikutnya saat daftar digulir, lalu garis akhir; hitungan tetap total sebenarnya", async () => {
    await openFlat(45);
    expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(20);
    // Hitungan dari count query (45), bukan 20 komentar termuat.
    expect(screen.getByText(/45 komentar/)).toBeTruthy();
    expect(screen.queryByText("Sudah sampai komentar terlama.")).toBeNull();

    await scrollToEnd();
    await waitFor(() =>
      expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(40),
    );
    expect(mocks.fetchCommentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ includePostCaptions: true }),
      "page-20",
    );

    await scrollToEnd();
    await waitFor(() =>
      expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(45),
    );
    expect(screen.getByText("Sudah sampai komentar terlama.")).toBeTruthy();
    expect(screen.getByText(/45 komentar/)).toBeTruthy();
  });

  it("halaman gagal: Alert Coba Lagi di bawah, komentar termuat tetap, Coba Lagi memuat halaman yang sama", async () => {
    await openFlat(45);
    const pages = flatPages(45);
    mocks.fetchCommentsPage.mockRejectedValueOnce(new Error("offline"));
    await scrollToEnd();

    expect(
      await screen.findByText("Gagal memuat komentar lainnya"),
    ).toBeTruthy();
    expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(20);

    mocks.fetchCommentsPage.mockImplementation(pages);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Coba Lagi" })),
    );
    await waitFor(() =>
      expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(40),
    );
    expect(mocks.fetchCommentsPage).toHaveBeenLastCalledWith(
      expect.anything(),
      "page-20",
    );
    expect(screen.queryByText("Gagal memuat komentar lainnya")).toBeNull();
  });

  it("filter berubah mengosongkan daftar seketika dan memuat halaman pertama filter baru; halaman lama yang terlambat dibuang", async () => {
    await openFlat(45);
    let releaseOld: (v: unknown) => void = () => {};
    mocks.fetchCommentsPage.mockImplementationOnce(
      () => new Promise((resolve) => (releaseOld = resolve)),
    );
    await scrollToEnd(); // halaman 2 filter lama menggantung

    mocks.fetchCommentsPage.mockImplementation(
      async (request: { postId?: string; dateRange?: string }) => ({
        items: [comment("n1", "@baru", "unread", "p1", 1)],
        nextCursor: null,
        counts: { total: 1, unread: 1 },
        postCaptions: CAPTIONS,
        ...(request.postId === undefined ? {} : {}),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Filter dan urutan/ }));
    await act(async () =>
      fireEvent.click(screen.getByRole("radio", { name: "7 hari terakhir" })),
    );
    expect(await screen.findByText("@baru")).toBeTruthy();
    expect(screen.queryByText("@u0")).toBeNull();

    await act(async () =>
      releaseOld({
        items: flatComments(20, 40),
        nextCursor: null,
        counts: null,
        postCaptions: {},
      }),
    );
    expect(screen.queryByText("@u20")).toBeNull();
    expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(1);
  });

  it("Refresh membawa komentar baru tanpa menggandakan yang sudah ada", async () => {
    await openFlat(45);
    mocks.fetchCommentsPage.mockImplementation(async (request, cursor) => {
      const page = (await flatPages(45)(request, cursor)) as {
        items: EngagementInboxItemRecord[];
      };
      return cursor === null && request.postId === undefined
        ? {
            ...page,
            items: [
              comment("x-new", "@newcomer", "unread", "p1", 0),
              ...page.items.slice(0, 19),
            ],
          }
        : page;
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Refresh/ })),
    );
    await screen.findByText("@newcomer");
    const handles = [...document.querySelectorAll(COMMENT_ROWS)].map(
      (el) => el.textContent?.match(/@\w+/)?.[0],
    );
    expect(new Set(handles).size).toBe(handles.length);
  });

  it("komentar satu posting memuat halaman berikutnya dari panel kanan dan menutup dengan garis akhir", async () => {
    mocks.fetchCommentsPage.mockImplementation(
      async (request: { postId?: string }, cursor: string | null) => {
        if (request.postId !== "p1") return commentsPage(request, cursor);
        const start = cursor ? Number(cursor.replace("page-", "")) : 0;
        const end = Math.min(start + 20, 25);
        return {
          items: flatComments(start, end),
          nextCursor: end < 25 ? `page-${end}` : null,
          counts: null,
          postCaptions: {},
        };
      },
    );
    renderView();
    await screen.findByText("@u0");
    expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(20);
    // Ringkasan dari hitungan kelompok (3 komentar), bukan dari 20 termuat.
    expect(screen.getByText(/3 total komentar/)).toBeTruthy();

    await scrollToEnd();
    await waitFor(() =>
      expect(document.querySelectorAll(COMMENT_ROWS)).toHaveLength(25),
    );
    expect(screen.getByText("Sudah sampai komentar terlama.")).toBeTruthy();
  });

  it("daftar posting memuat halaman berikutnya; jumlah posting dari count query", async () => {
    const more = group("p3", "Posting ketiga", { unread: 0, handled: 1 });
    mocks.fetchPostGroupsPage.mockResolvedValue({
      groups: [more],
      nextCursor: null,
      counts: null,
    });
    renderView({
      initialNextCursor: "g-2",
      initialCounts: { postCount: 41, unrepliedCount: 12 },
    });
    await screen.findByText("@maya");
    // Jumlah sebenarnya (41) walau baru 2 posting termuat.
    expect(screen.getByText("(41)")).toBeTruthy();
    expect(screen.queryByText("Posting ketiga")).toBeNull();

    await scrollToEnd();

    expect(await screen.findAllByText("Posting ketiga")).not.toHaveLength(0);
    expect(mocks.fetchPostGroupsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeEmpty: false }),
      "g-2",
    );
    expect(screen.getByText("Sudah sampai posting terlama.")).toBeTruthy();
  });

  it("posting yang sama datang lagi di halaman berikutnya tidak muncul dua kali", async () => {
    mocks.fetchPostGroupsPage.mockResolvedValue({
      groups: [
        GROUPS[0],
        group("p3", "Posting ketiga", { unread: 0, handled: 1 }),
      ],
      nextCursor: null,
      counts: null,
    });
    renderView({ initialNextCursor: "g-2" });
    await screen.findByText("@maya");
    await scrollToEnd();
    await screen.findAllByText("Posting ketiga");
    expect(screen.getAllByText("Kopi susu gula aren")).toHaveLength(2); // kartu + pratinjau
  });
});
