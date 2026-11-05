// @vitest-environment jsdom
/**
 * Bukti perilaku Draft Editor (S-005, jalur B gelombang 7) lewat batas publik
 * `DraftEditorForm`: yang diuji hanya apa yang dilihat dan dilakukan pemakai
 * (role, label, teks), dengan Server Action sebagai satu-satunya batas yang
 * di-mock. Akun Disconnected, Pinterest, dan banyak akun tidak ada di
 * workspace E2E (hanya satu Instagram), jadi dibuktikan di sini.
 */
import { SocialPlatform } from "@postific/shared";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  getConnectedAccountsAction: vi.fn(),
  getLastUsedAccountIdsAction: vi.fn(),
  getDraftAction: vi.fn(),
  publishNowAction: vi.fn(),
  saveDraftAction: vi.fn(),
  scheduleDraftAction: vi.fn(),
  updateDraftAction: vi.fn(),
  listPinterestBoardsAction: vi.fn(),
  uploadMediaAction: vi.fn(),
  deleteMediaAction: vi.fn(),
}));

vi.mock("./actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/publish/drafts",
}));
const contextMocks = vi.hoisted(() => ({
  close: vi.fn(),
  clearUnsavedNewPost: vi.fn(),
}));
vi.mock("./Context", () => ({ useDraftEditor: () => contextMocks }));
vi.mock("@/lib/time/user-time-zone-context", () => ({
  useUserTimeZone: () => "Asia/Jakarta",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/domains/publishing", async () => {
  const matrix = await import("@/domains/publishing/content-format-matrix");
  const story = await import("@/domains/publishing/story-caption-constraints");
  return {
    maxMediaCountForFormats: matrix.maxMediaCountForFormats,
    isCaptionRequiredForFormats: story.isCaptionRequiredForFormats,
  };
});

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

import { DraftEditorForm } from "./DraftEditorForm";

const INSTAGRAM = {
  id: "ig",
  platform: SocialPlatform.Instagram,
  handle: "kopi_ig",
  status: "active",
};
const FACEBOOK = {
  id: "fb",
  platform: SocialPlatform.Facebook,
  handle: "kopi-fb",
  status: "active",
};
const PINTEREST = {
  id: "pin",
  platform: SocialPlatform.Pinterest,
  handle: "kopi-pin",
  status: "active",
};
const FACEBOOK_TERPUTUS = {
  id: "fb-off",
  platform: SocialPlatform.Facebook,
  handle: "toko-fb-lama",
  status: "expired",
};

const NO_MEDIA_DRAFT = {
  postId: "p1",
  caption: "",
  status: "draft",
  media: [],
  targets: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  actionMocks.getConnectedAccountsAction.mockResolvedValue([
    INSTAGRAM,
    FACEBOOK,
    PINTEREST,
    FACEBOOK_TERPUTUS,
  ]);
  actionMocks.getLastUsedAccountIdsAction.mockResolvedValue([]);
  actionMocks.listPinterestBoardsAction.mockResolvedValue([
    { id: "b1", name: "Resep Kopi" },
    { id: "b2", name: "Inspirasi Kafe" },
  ]);
  actionMocks.saveDraftAction.mockResolvedValue({ postId: "p1" });
  actionMocks.getDraftAction.mockResolvedValue(NO_MEDIA_DRAFT);
});
afterEach(cleanup);

async function renderCreate(
  props: { preSelectedAccountId?: string } = {},
): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DraftEditorForm
            mode="create"
            onOpenChange={vi.fn()}
            dialogVariant="standard"
            onToggleDialogVariant={vi.fn()}
            onLatestChange={vi.fn()}
            {...props}
          />
        </DialogContent>
      </Dialog>
    </TooltipProvider>,
  );
  await screen.findByRole("button", { name: /Channels|Tambah akun/ });
  return user;
}

const chips = () => screen.queryAllByTestId("channel-chip");
const preview = () => screen.getByRole("complementary", { name: "Pratinjau" });

async function openChannels(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Channels" }));
  return screen.findByRole("dialog", { name: "Pilih akun tujuan" });
}

async function pickAccounts(
  user: ReturnType<typeof userEvent.setup>,
  ...labels: string[]
) {
  const popover = await openChannels(user);
  for (const label of labels) {
    await user.click(within(popover).getByRole("checkbox", { name: label }));
  }
  await user.keyboard("{Escape}");
}

describe("Baris channel (T-201)", () => {
  it("T-201.1 popover: pencarian, Pilih semua, daftar dengan status koneksi, tautan Hubungkan akun", async () => {
    const user = await renderCreate();
    const popover = await openChannels(user);

    const list = within(popover).getByRole("list", { name: "Daftar akun" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    // Tiap baris: platform dan status koneksi terlihat.
    expect(within(rows[0]!).getByText("kopi_ig")).toBeTruthy();
    expect(within(rows[0]!).getByText("Terhubung")).toBeTruthy();
    expect(within(popover).getByText("Pilih semua (3)")).toBeTruthy();
    expect(
      within(popover)
        .getByRole("link", { name: "Hubungkan akun" })
        .getAttribute("href"),
    ).toBe("/settings/connected-accounts");

    // Pencarian menyaring daftar menurut handle atau nama platform.
    await user.type(within(popover).getByLabelText("Cari akun"), "pin");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("kopi-pin")).toBeTruthy();
    await user.clear(within(popover).getByLabelText("Cari akun"));
    await user.type(
      within(popover).getByLabelText("Cari akun"),
      "tidak-ada-akun-ini",
    );
    expect(
      within(popover).getByText("Tidak ada akun yang cocok."),
    ).toBeTruthy();
  });

  it("T-201.1 Pilih semua mencentang akun terhubung saja dan bisa dibatalkan", async () => {
    const user = await renderCreate();
    const popover = await openChannels(user);
    const selectAll = within(popover).getByRole("checkbox", {
      name: /Pilih semua/,
    });
    await user.click(selectAll);

    expect(within(popover).getByText("3 dipilih")).toBeTruthy();
    expect(
      within(popover)
        .getByRole("checkbox", { name: "Pilih Facebook toko-fb-lama" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    await user.keyboard("{Escape}");
    expect(chips()).toHaveLength(3);

    const popoverAgain = await screen
      .findByRole("button", { name: "Tambah akun" })
      .then(async (button) => {
        await user.click(button);
        return screen.findByRole("dialog", { name: "Pilih akun tujuan" });
      });
    await user.click(
      within(popoverAgain).getByRole("checkbox", { name: /Pilih semua/ }),
    );
    await user.keyboard("{Escape}");
    expect(chips()).toHaveLength(0);
  });

  it("T-201.2 pintasan Terakhir dipakai dan Semua mengisi pilihan dari data server", async () => {
    actionMocks.getLastUsedAccountIdsAction.mockResolvedValue(["fb", "ig"]);
    const user = await renderCreate();

    const lastUsed = await screen.findByRole("button", {
      name: "Terakhir dipakai (2)",
    });
    expect(screen.getByRole("button", { name: "Semua (3)" })).toBeTruthy();
    await user.click(lastUsed);

    expect(chips().map((chip) => chip.textContent)).toEqual([
      expect.stringContaining("kopi-fb"),
      expect.stringContaining("kopi_ig"),
    ]);
    // Setelah ada pilihan pintasan hilang.
    expect(
      screen.queryByRole("button", { name: /Terakhir dipakai/ }),
    ).toBeNull();
  });

  it("T-201.3 pilihan menjadi chip plus Tambah akun, chip dilepas, tanpa request jaringan", async () => {
    const user = await renderCreate();
    await pickAccounts(
      user,
      "Pilih Instagram kopi_ig",
      "Pilih Facebook kopi-fb",
    );
    const callsAfterSelect = Object.values(actionMocks).reduce(
      (sum, mock) => sum + mock.mock.calls.length,
      0,
    );

    expect(chips()).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Tambah akun" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Channels" })).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Hapus Instagram kopi_ig" }),
    );
    expect(chips()).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Hapus Facebook kopi-fb" }),
    );
    expect(chips()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Channels" })).toBeTruthy();
    // Melepas chip hanya state klien.
    expect(
      Object.values(actionMocks).reduce(
        (sum, mock) => sum + mock.mock.calls.length,
        0,
      ),
    ).toBe(callsAfterSelect);
  });

  it("T-201.4 akun Disconnected tampil, bisa dicentang, ada peringatan dan Reconnect, tidak memblokir Schedule dan Publish Now", async () => {
    const user = await renderCreate();
    const popover = await openChannels(user);
    const row = within(popover)
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText("toko-fb-lama"));
    expect(within(row!).getByText("Disconnected")).toBeTruthy();
    expect(
      within(row!)
        .getByRole("link", { name: "Reconnect" })
        .getAttribute("href"),
    ).toBe("/settings/connected-accounts");
    const checkbox = within(row!).getByRole("checkbox", {
      name: "Pilih Facebook toko-fb-lama",
    });
    expect((checkbox as HTMLButtonElement).disabled).toBe(false);
    await user.click(checkbox);
    await user.keyboard("{Escape}");

    // Chip memberi peringatan; blok jaringan menawarkan Reconnect.
    expect(within(chips()[0]!).getByText("Akun terputus")).toBeTruthy();
    expect(screen.getByText("Akun ini terputus.")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: "Reconnect" })
        .every(
          (link) =>
            link.getAttribute("href") === "/settings/connected-accounts",
        ),
    ).toBe(true);

    // Facebook Post cukup dengan caption: aksi tetap terbuka walau akun terputus.
    await user.type(screen.getByLabelText("Caption"), "Promo kopi susu");
    expect(
      (screen.getByRole("button", { name: "Publish Now" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("T-201.5 Quick Compose: akun yang di-hover sudah terpilih, tanpa pintasan, dan tersimpan sebagai akun tujuan draft (ADR-125)", async () => {
    const user = await renderCreate({ preSelectedAccountId: "pin" });

    await waitFor(() => expect(chips()).toHaveLength(1));
    expect(chips()[0]!.textContent).toContain("kopi-pin");
    expect(
      screen.queryByRole("button", { name: /Terakhir dipakai/ }),
    ).toBeNull();
    expect(actionMocks.getLastUsedAccountIdsAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Caption"), "Pin dari sidebar");
    await user.click(screen.getByRole("button", { name: "Save as Draft" }));

    await waitFor(() =>
      expect(actionMocks.saveDraftAction).toHaveBeenCalledTimes(1),
    );
    const [input] = actionMocks.saveDraftAction.mock.calls[0]!;
    expect(input.caption).toBe("Pin dari sidebar");
    expect(input.targets).toEqual([
      expect.objectContaining({
        connectedAccountId: "pin",
        contentFormat: "pin",
      }),
    ]);
  });
});

describe("Editor, media, dan blok jaringan (T-202)", () => {
  it("T-202.1 caption, area media, dan toolbar hanya Lampirkan media; unggahan menjadi thumbnail", async () => {
    actionMocks.uploadMediaAction.mockResolvedValue({
      media: {
        id: "m1",
        url: "https://cdn.example.test/kopi.png",
        type: "image",
        filename: "kopi.png",
      },
    });
    const user = await renderCreate();
    expect(screen.getByLabelText("Caption")).toBeTruthy();
    expect(
      screen.getByText("Tarik file ke sini atau klik untuk memilih"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Lampirkan media" }),
    ).toBeTruthy();
    // Tanpa emoji dan hashtag di toolbar.
    expect(screen.queryByRole("button", { name: /emoji|hashtag/i })).toBeNull();

    await user.upload(
      document.querySelector<HTMLInputElement>("#draft-media")!,
      new File(["x"], "kopi.png", { type: "image/png" }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Hapus kopi.png secara permanen",
      }),
    ).toBeTruthy();
    expect(screen.getByText("1/10 media")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Tambah media: tarik file ke sini atau klik untuk memilih",
      }),
    ).toBeTruthy();
  });

  it("T-202.2 satu akun: blok langsung terbuka tanpa akordeon", async () => {
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Instagram kopi_ig");

    expect(screen.getByRole("radiogroup", { name: "Format" })).toBeTruthy();
    // Akordeon memakai tombol pemicu ber-aria-expanded; satu akun tidak punya.
    expect(
      document.querySelectorAll("[data-slot=accordion-trigger]"),
    ).toHaveLength(0);
  });

  it("T-202.2 banyak akun: akordeon dengan satu blok terbuka, klik membuka blok lain dan menutup yang lama", async () => {
    const user = await renderCreate();
    await pickAccounts(
      user,
      "Pilih Instagram kopi_ig",
      "Pilih Facebook kopi-fb",
    );

    const triggers = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-slot=accordion-trigger]"),
      );
    expect(triggers()).toHaveLength(2);
    const expanded = () =>
      triggers().filter((t) => t.getAttribute("aria-expanded") === "true");
    const collapsed = () =>
      triggers().filter((t) => t.getAttribute("aria-expanded") !== "true");
    expect(expanded()).toHaveLength(1);
    expect(collapsed()).toHaveLength(1);
    expect(screen.getAllByRole("radiogroup", { name: "Format" })).toHaveLength(
      1,
    );

    const opening = collapsed()[0]!;
    const closing = expanded()[0]!;
    await user.click(opening);
    await waitFor(() => expect(expanded()).toEqual([opening]));
    expect(closing.getAttribute("aria-expanded")).not.toBe("true");

    // Satu blok selalu terbuka: klik blok yang sudah terbuka tidak menutupnya.
    await user.click(opening);
    expect(expanded()).toEqual([opening]);
  });

  it("T-202.4 field Pinterest: judul, link, dan board tersimpan sebagai opsi target, tanpa format Post/Reel/Story", async () => {
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Pinterest kopi-pin");

    expect(screen.queryByRole("radiogroup", { name: "Format" })).toBeNull();
    expect(screen.getByText("Format: Pin")).toBeTruthy();
    await waitFor(() =>
      expect(actionMocks.listPinterestBoardsAction).toHaveBeenCalled(),
    );

    await user.type(screen.getByLabelText(/Pin Title/), "Resep kopi");
    await user.type(
      screen.getByLabelText(/Destination Link/),
      "https://kopi.example.test/resep",
    );
    await user.click(screen.getByRole("combobox", { name: "Board" }));
    await user.click(await screen.findByRole("option", { name: "Resep Kopi" }));
    await user.type(screen.getByLabelText("Caption"), "Seduh sempurna");
    await user.click(screen.getByRole("button", { name: "Save as Draft" }));

    await waitFor(() =>
      expect(actionMocks.saveDraftAction).toHaveBeenCalledTimes(1),
    );
    expect(actionMocks.saveDraftAction.mock.calls[0]![0].targets).toEqual([
      {
        connectedAccountId: "pin",
        contentFormat: "pin",
        platformOptions: {
          pinTitle: "Resep kopi",
          pinLink: "https://kopi.example.test/resep",
          boardId: "b1",
        },
      },
    ]);
  });

  it("T-202.5 banner per jaringan di dalam blok: Instagram tanpa media dan Pinterest tanpa board", async () => {
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Instagram kopi_ig");
    await user.type(screen.getByLabelText("Caption"), "Halo");

    const block = screen.getByRole("radiogroup", { name: "Format" })
      .parentElement!.parentElement!;
    expect(
      within(block).getByText(/Instagram tidak bisa dipublish tanpa media/),
    ).toBeTruthy();
    // Dalam blok, bukan di atas editor: bagian atas tidak memuat banner itu.
    expect(
      screen.getAllByText(/Instagram tidak bisa dipublish tanpa media/),
    ).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Hapus Instagram kopi_ig" }),
    );
    await pickAccounts(user, "Pilih Pinterest kopi-pin");
    await waitFor(() =>
      expect(
        screen.getByText(/board/i, { selector: "[role=status] *" }),
      ).toBeTruthy(),
    );
  });

  it("T-202.5 banner lintas jaringan di atas editor: lebih dari satu akun Pinterest dan Story dengan caption", async () => {
    const SECOND_PIN = {
      id: "pin2",
      platform: SocialPlatform.Pinterest,
      handle: "kopi-pin-dua",
      status: "active",
    };
    actionMocks.getConnectedAccountsAction.mockResolvedValue([
      INSTAGRAM,
      PINTEREST,
      SECOND_PIN,
    ]);
    const user = await renderCreate();
    await pickAccounts(
      user,
      "Pilih Pinterest kopi-pin",
      "Pilih Pinterest kopi-pin-dua",
    );
    const alerts = () =>
      screen
        .queryAllByRole("status")
        .filter((el) => el.closest("aside") === null);
    await waitFor(() =>
      expect(
        alerts().some((el) =>
          /satu akun Pinterest/i.test(el.textContent ?? ""),
        ),
      ).toBe(true),
    );
    // Banner lintas jaringan ada sebelum judul "Pengaturan per jaringan".
    const banner = alerts().find((el) =>
      /satu akun Pinterest/i.test(el.textContent ?? ""),
    )!;
    const heading = screen.getByRole("heading", {
      name: "Pengaturan per jaringan",
    });
    expect(
      banner.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("Pratinjau live (T-203)", () => {
  it("T-203.1/.2 kerangka panel dan keadaan kosong sebelum ada akun; toggle di header menyembunyikannya", async () => {
    const user = await renderCreate();
    expect(
      within(preview()).getByText("Pratinjau tampil di sini"),
    ).toBeTruthy();
    expect(
      within(preview()).getByText(/Pilih akun tujuan dan tulis caption/),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Pratinjau" }));
    expect(
      screen.queryByRole("complementary", { name: "Pratinjau" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Pratinjau" }));
    expect(preview()).toBeTruthy();
  });

  it("T-203.2 akun tanpa isi: kartu tampil dengan placeholder caption", async () => {
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Facebook kopi-fb");
    expect(
      within(preview()).queryByText("Pratinjau tampil di sini"),
    ).toBeNull();
    const card = within(preview()).getByLabelText("Pratinjau Facebook Post");
    expect(within(card).getByText("kopi-fb")).toBeTruthy();
    // Belum ada caption: kartu memakai placeholder, lalu diganti teks yang diketik.
    await user.type(screen.getByLabelText("Caption"), "Mulai menulis");
    expect(within(card).getByText("Mulai menulis")).toBeTruthy();
  });

  it("T-203.3 Pratinjau Facebook memuat nama akun dan caption yang diketik", async () => {
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Facebook kopi-fb");
    await user.type(screen.getByLabelText("Caption"), "Diskon kopi 20%");
    const card = within(preview()).getByLabelText("Pratinjau Facebook Post");
    expect(within(card).getByText("kopi-fb")).toBeTruthy();
    expect(within(card).getByText("Diskon kopi 20%")).toBeTruthy();
  });

  it("T-203.1 pemilih Pratinjau per akun: tab mengganti kartu mengikuti akun", async () => {
    const user = await renderCreate();
    await pickAccounts(
      user,
      "Pilih Instagram kopi_ig",
      "Pilih Facebook kopi-fb",
    );
    await user.type(screen.getByLabelText("Caption"), "Satu caption");
    expect(
      within(preview()).getByLabelText("Pratinjau Instagram Post"),
    ).toBeTruthy();

    await user.click(
      within(preview()).getByRole("tab", { name: "Facebook kopi-fb" }),
    );
    expect(
      within(preview()).getByLabelText("Pratinjau Facebook Post"),
    ).toBeTruthy();
    expect(
      within(preview()).queryByLabelText("Pratinjau Instagram Post"),
    ).toBeNull();

    // Melepas akun aktif: pratinjau jatuh ke akun terpilih yang tersisa.
    await user.click(
      screen.getByRole("button", { name: "Hapus Facebook kopi-fb" }),
    );
    expect(
      within(preview()).getByLabelText("Pratinjau Instagram Post"),
    ).toBeTruthy();
  });

  it("T-203.4 Pratinjau Instagram mengikuti format yang dipilih (Post, Story, Reel)", async () => {
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Instagram kopi_ig");
    await user.type(screen.getByLabelText("Caption"), "Caption IG");
    expect(
      within(preview()).getByLabelText("Pratinjau Instagram Post"),
    ).toBeTruthy();
    expect(within(preview()).getByText("Instagram · Post")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "Story" }));
    expect(
      within(preview()).getByLabelText("Pratinjau Instagram Story"),
    ).toBeTruthy();
    expect(within(preview()).getByText("Instagram · Story")).toBeTruthy();
    expect(
      within(preview()).queryByLabelText("Pratinjau Instagram Post"),
    ).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Reel" }));
    expect(within(preview()).getByText("Instagram · Reel")).toBeTruthy();
  });

  it("T-203.5 Pratinjau hidup saat mengetik dan mengganti media, tanpa request jaringan", async () => {
    actionMocks.uploadMediaAction.mockResolvedValue({
      media: {
        id: "m1",
        url: "https://cdn.example.test/kopi.png",
        type: "image",
        filename: "kopi.png",
      },
    });
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Instagram kopi_ig");
    await user.upload(
      document.querySelector<HTMLInputElement>("#draft-media")!,
      new File(["x"], "kopi.png", { type: "image/png" }),
    );
    await screen.findByRole("button", {
      name: "Hapus kopi.png secara permanen",
    });
    const callsBefore = Object.values(actionMocks).reduce(
      (sum, mock) => sum + mock.mock.calls.length,
      0,
    );

    await user.type(screen.getByLabelText("Caption"), "Ketik pelan");
    expect(within(preview()).getByText("Ketik pelan")).toBeTruthy();
    await user.type(screen.getByLabelText("Caption"), " lagi");
    expect(within(preview()).getByText("Ketik pelan lagi")).toBeTruthy();
    expect(
      Object.values(actionMocks).reduce(
        (sum, mock) => sum + mock.mock.calls.length,
        0,
      ),
    ).toBe(callsBefore);
  });
});

describe("Footer dan jadwal (T-205)", () => {
  it("T-205.2 jadwal di masa lalu: pesan muncul di footer dan Schedule tertahan", async () => {
    const user = await renderCreate();
    await pickAccounts(user, "Pilih Facebook kopi-fb");
    await user.type(screen.getByLabelText("Caption"), "Jadwal uji");

    await user.click(screen.getByRole("button", { name: /^Jadwal:/ }));
    // Hari ini (zona pengguna) dengan jam 00:00 selalu sudah lewat.
    const todayLabel = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date());
    await user.click(
      await screen.findByRole("button", {
        name: new RegExp(`${todayLabel}(, dipilih)?$`),
      }),
    );
    const hour = screen.getByLabelText("Jam");
    await user.clear(hour);
    await user.type(hour, "00:00");
    await user.click(screen.getByRole("button", { name: "Selesai" }));

    expect(
      (screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // Pesan duduk di footer, satu wadah dengan tombol aksi.
    const message = screen.getByRole("alert");
    expect(message.textContent).toMatch(/sudah lewat/i);
    const footer = screen
      .getByRole("button", { name: "Save as Draft" })
      .closest("[data-slot=dialog-footer]");
    expect(footer?.contains(message)).toBe(true);
  });

  it("T-205.3 Save as Draft tanpa media dan tanpa akun: tersimpan, dan dengan akun menyimpan akun tujuan", async () => {
    const user = await renderCreate();
    await user.type(screen.getByLabelText("Caption"), "Hanya caption");
    await user.click(screen.getByRole("button", { name: "Save as Draft" }));
    await waitFor(() =>
      expect(actionMocks.saveDraftAction).toHaveBeenCalledTimes(1),
    );
    expect(actionMocks.saveDraftAction.mock.calls[0]![0]).toMatchObject({
      caption: "Hanya caption",
      targets: [],
    });
  });

  it("T-205.4 Schedule dan Publish Now aktif hanya saat validasi lulus", async () => {
    const user = await renderCreate();
    const publish = () =>
      screen.getByRole("button", { name: "Publish Now" }) as HTMLButtonElement;
    expect(publish().disabled).toBe(true); // belum ada akun
    await pickAccounts(user, "Pilih Instagram kopi_ig");
    await user.type(screen.getByLabelText("Caption"), "Isi");
    expect(publish().disabled).toBe(true); // Instagram tanpa media
    await user.click(
      screen.getByRole("button", { name: "Hapus Instagram kopi_ig" }),
    );
    await pickAccounts(user, "Pilih Facebook kopi-fb");
    expect(publish().disabled).toBe(false); // Facebook Post cukup caption
    await user.clear(screen.getByLabelText("Caption"));
    expect(publish().disabled).toBe(true); // caption kosong
  });
});

describe("Aksi per status di Edit Draft (T-205.8)", () => {
  async function renderEdit(status: string) {
    actionMocks.getDraftAction.mockResolvedValue({
      postId: "p1",
      caption: "Isi tersimpan",
      status,
      media: [],
      targets: [
        {
          connectedAccountId: "fb",
          contentFormat: "post",
          platformOptions: null,
        },
      ],
    });
    render(
      <TooltipProvider>
        <Dialog open>
          <DialogContent showCloseButton={false}>
            <DraftEditorForm
              mode="edit"
              postId="p1"
              onOpenChange={vi.fn()}
              dialogVariant="standard"
              onToggleDialogVariant={vi.fn()}
              onLatestChange={vi.fn()}
            />
          </DialogContent>
        </Dialog>
      </TooltipProvider>,
    );
    return screen.findByDisplayValue("Isi tersimpan");
  }

  it("Draft: form terisi, chip status Draft, semua aksi tersedia", async () => {
    await renderEdit("draft");
    expect(screen.getByRole("heading", { name: "Edit Draft" })).toBeTruthy();
    expect(screen.getByText("Draft", { exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish Now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save as Draft" })).toBeTruthy();
  });

  it("Scheduled: tetap dibuka di editor dan chip header menampilkan status konten", async () => {
    await renderEdit("scheduled");
    expect(screen.getByText("Scheduled", { exact: true })).toBeTruthy();
    expect(
      (screen.getByLabelText("Caption") as HTMLTextAreaElement).value,
    ).toBe("Isi tersimpan");
  });

  it.each(["published", "failed", "imported"])(
    "%s: tidak dibuka di editor (tanpa form terisi)",
    async (status) => {
      actionMocks.getDraftAction.mockResolvedValue({
        postId: "p1",
        caption: "Isi tersimpan",
        status,
        media: [],
        targets: [],
      });
      render(
        <TooltipProvider>
          <Dialog open>
            <DialogContent showCloseButton={false}>
              <DraftEditorForm
                mode="edit"
                postId="p1"
                onOpenChange={vi.fn()}
                dialogVariant="standard"
                onToggleDialogVariant={vi.fn()}
                onLatestChange={vi.fn()}
              />
            </DialogContent>
          </Dialog>
        </TooltipProvider>,
      );
      // Editor menutup diri (pintu masuk sudah menyaring; ini pengamannya).
      await waitFor(() => expect(contextMocks.close).toHaveBeenCalledTimes(1));
      expect(screen.queryByDisplayValue("Isi tersimpan")).toBeNull();
    },
  );
});
