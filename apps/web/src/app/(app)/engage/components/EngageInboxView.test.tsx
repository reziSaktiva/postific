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

const rowOf = (handle: string) =>
  screen.getByText(handle).closest("[data-status]") as HTMLElement;

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  Object.values(mocks).forEach((m) => "mockReset" in m && m.mockReset());
  mocks.toast.error.mockReset();
  mocks.listInboxAction.mockImplementation(
    async (filter: { postId?: string | null }) => ({
      data: COMMENTS[filter.postId ?? "none"] ?? [],
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

  it("kosong tanpa filter: ajakan Buka Publish; dengan filter aktif: Reset filters", async () => {
    renderView({ initialGroups: [] });
    expect(screen.getByText("Belum ada interaksi")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buka Publish" })).toBeTruthy();
  });

  it("memuat awal gagal menampilkan state refresh gagal, bukan kosong palsu", () => {
    renderView({ initialGroups: [], initialLoadFailed: true });
    expect(
      screen.getByText("Komentar terbaru belum dapat diambil"),
    ).toBeTruthy();
  });
});
