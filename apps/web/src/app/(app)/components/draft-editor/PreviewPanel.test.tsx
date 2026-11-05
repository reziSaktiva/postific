// @vitest-environment jsdom
/**
 * Bukti T-204.1, T-204.2, T-204.3, T-204.5 lewat batas publik `PreviewPanel`
 * (S-005): masukan state form masuk, yang diperiksa hanya apa yang terlihat
 * pemakai (role, label, teks). Komponen kartu dan `buildPostPreview` tidak
 * diimpor langsung, jadi tes tetap hijau saat struktur internal berubah.
 */
import { ContentFormat, SocialPlatform } from "@postific/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PreviewPanel } from "./PreviewPanel";

afterEach(cleanup);

type PanelProps = Parameters<typeof PreviewPanel>[0];

const IMAGE = {
  id: "m1",
  url: "https://cdn.example.test/kopi.jpg",
  type: "image",
  filename: "kopi.jpg",
};
const VIDEO = {
  id: "m2",
  url: "https://cdn.example.test/seduh.mp4",
  type: "video",
  filename: "seduh.mp4",
};

function account(platform: SocialPlatform, handle: string, id = "acc") {
  return { id, platform, handle, status: "active" };
}

function renderPanel(
  overrides: Partial<PanelProps> & {
    account: PanelProps["selectedAccounts"][number];
  },
) {
  const { account: acc, ...rest } = overrides;
  return render(
    <PreviewPanel
      selectedAccounts={[acc]}
      formatByAccount={{}}
      caption=""
      mediaItems={[]}
      {...rest}
    />,
  );
}

const panel = () => screen.getByRole("complementary", { name: "Pratinjau" });

describe("Pratinjau TikTok (T-204.1)", () => {
  const tiktok = account(SocialPlatform.TikTok, "@kopiselasar");

  it("kartu TikTok memuat nama akun dan caption, dengan label platform di header panel", () => {
    renderPanel({
      account: tiktok,
      caption: "Seduh pagi #kopi",
      mediaItems: [VIDEO],
    });
    const card = within(panel()).getByLabelText("Pratinjau TikTok");
    // Nama akun tampil di footer kartu dan di baris suara asli.
    expect(within(card).getAllByText(/@kopiselasar/).length).toBeGreaterThan(0);
    expect(within(card).getByText("Seduh pagi #kopi")).toBeTruthy();
    expect(within(panel()).getByText("TikTok · Post")).toBeTruthy();
  });

  it("memakai media video yang dipilih dan tidak menampilkan pesan kosong", () => {
    const { container } = renderPanel({ account: tiktok, mediaItems: [VIDEO] });
    const card = within(panel()).getByLabelText("Pratinjau TikTok");
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      VIDEO.url,
    );
    expect(within(card).queryByText("TikTok membutuhkan media")).toBeNull();
  });

  it("tanpa media kartu meminta media, lalu berganti ke media begitu ada", () => {
    const { rerender } = renderPanel({ account: tiktok });
    expect(screen.getByText("TikTok membutuhkan media")).toBeTruthy();

    rerender(
      <PreviewPanel
        selectedAccounts={[tiktok]}
        formatByAccount={{}}
        caption=""
        mediaItems={[VIDEO]}
      />,
    );
    expect(screen.queryByText("TikTok membutuhkan media")).toBeNull();
  });

  it("format Reel tetap kartu TikTok (bukan kartu vertikal Facebook/Instagram)", () => {
    renderPanel({
      account: tiktok,
      formatByAccount: { acc: ContentFormat.Reel },
      mediaItems: [VIDEO],
    });
    expect(within(panel()).getByLabelText("Pratinjau TikTok")).toBeTruthy();
    expect(within(panel()).getByText("TikTok · Reel")).toBeTruthy();
  });
});

describe("Pratinjau Pinterest (T-204.2)", () => {
  const pinterest = account(SocialPlatform.Pinterest, "kopi-pin");
  const boards = {
    acc: {
      status: "success" as const,
      boards: [
        { id: "b1", name: "Resep Kopi" },
        { id: "b2", name: "Inspirasi Kafe" },
      ],
    },
  };

  it("menampilkan judul, host link, board terpilih, nama akun, dan caption", () => {
    renderPanel({
      account: pinterest,
      caption: "Resep rumahan",
      mediaItems: [IMAGE],
      pinTitle: "  Kopi Susu Gula Aren  ",
      pinLink: "https://kopiselasar.id/resep/kopi-susu?utm=x",
      boardIdByAccount: { acc: "b2" },
      pinterestBoardsByAccount: boards,
    });
    const card = within(panel()).getByLabelText("Pratinjau Pinterest Pin");
    expect(within(card).getByText("Kopi Susu Gula Aren")).toBeTruthy();
    expect(within(card).getByText("kopiselasar.id")).toBeTruthy();
    expect(within(card).getByText("Board: Inspirasi Kafe")).toBeTruthy();
    expect(within(card).getByText("kopi-pin")).toBeTruthy();
    expect(within(card).getByText("Resep rumahan")).toBeTruthy();
    expect(within(card).getByRole("img", { name: "kopi.jpg" })).toBeTruthy();
    expect(within(panel()).getByText("Pinterest · Pin")).toBeTruthy();
  });

  it("board dipilih ulang: kartu memakai nama board yang baru", () => {
    const { rerender } = renderPanel({
      account: pinterest,
      boardIdByAccount: { acc: "b1" },
      pinterestBoardsByAccount: boards,
    });
    expect(screen.getByText("Board: Resep Kopi")).toBeTruthy();

    rerender(
      <PreviewPanel
        selectedAccounts={[pinterest]}
        formatByAccount={{}}
        caption=""
        mediaItems={[]}
        boardIdByAccount={{ acc: "b2" }}
        pinterestBoardsByAccount={boards}
      />,
    );
    expect(screen.getByText("Board: Inspirasi Kafe")).toBeTruthy();
    expect(screen.queryByText("Board: Resep Kopi")).toBeNull();
  });

  it("board belum dipilih, daftar masih dimuat, atau gagal dimuat: baris board tidak tampil", () => {
    const states = [
      { boardIdByAccount: {}, pinterestBoardsByAccount: boards },
      {
        boardIdByAccount: { acc: "b1" },
        pinterestBoardsByAccount: { acc: { status: "loading" as const } },
      },
      {
        boardIdByAccount: { acc: "b1" },
        pinterestBoardsByAccount: {
          acc: { status: "error" as const, message: "gagal" },
        },
      },
    ];
    for (const state of states) {
      const { unmount } = renderPanel({ account: pinterest, ...state });
      expect(screen.queryByText(/^Board:/)).toBeNull();
      unmount();
    }
  });

  it("link bukan URL http(s) tidak mengubah isi kartu dibanding tanpa link", () => {
    const cardText = () =>
      within(panel()).getByLabelText("Pratinjau Pinterest Pin").textContent;
    const { unmount: unmountBaseline } = renderPanel({ account: pinterest });
    const baseline = cardText();
    unmountBaseline();
    for (const pinLink of [
      "kopi.id/resep",
      "ftp://berkas.example.test/resep",
      "   ",
    ]) {
      const { unmount } = renderPanel({ account: pinterest, pinLink });
      expect(cardText()).toBe(baseline);
      unmount();
    }
  });

  it("tanpa media kartu meminta media dan tetap menampilkan nama akun", () => {
    renderPanel({ account: pinterest });
    const card = within(panel()).getByLabelText("Pratinjau Pinterest Pin");
    expect(within(card).getByText("Pinterest membutuhkan media")).toBeTruthy();
    expect(within(card).getByText("kopi-pin")).toBeTruthy();
  });

  it("tanpa data blok jaringan (prop opsional dihilangkan) pin tetap tampil tanpa error", () => {
    render(
      <PreviewPanel
        selectedAccounts={[pinterest]}
        formatByAccount={{}}
        caption="x"
        mediaItems={[IMAGE]}
      />,
    );
    const card = within(panel()).getByLabelText("Pratinjau Pinterest Pin");
    expect(within(card).queryByText(/^Board:/)).toBeNull();
  });

  it("dua akun Pinterest memakai board masing-masing, bukan board akun lain", () => {
    const pin2 = account(SocialPlatform.Pinterest, "kopi-pin-dua", "acc2");
    render(
      <PreviewPanel
        selectedAccounts={[pinterest, pin2]}
        selectedAccountIds={["acc2", "acc"]}
        formatByAccount={{}}
        caption=""
        mediaItems={[]}
        boardIdByAccount={{ acc: "b1", acc2: "b9" }}
        pinterestBoardsByAccount={{
          ...boards,
          acc2: {
            status: "success",
            boards: [{ id: "b9", name: "Menu Baru" }],
          },
        }}
      />,
    );
    // Akun pertama menurut urutan pilihan adalah acc2.
    expect(screen.getByText("Board: Menu Baru")).toBeTruthy();
    expect(screen.queryByText("Board: Resep Kopi")).toBeNull();
  });
});

describe("Kartu generik (T-204.3)", () => {
  it.each([
    [SocialPlatform.Twitter, "X (Twitter)"],
    [SocialPlatform.LinkedIn, "LinkedIn"],
    [SocialPlatform.YouTube, "YouTube"],
    [SocialPlatform.Threads, "Threads"],
  ])(
    "%s memakai kartu umum bernama platform, akun, dan caption",
    (platform, label) => {
      renderPanel({
        account: account(platform, "Kopi Selasar"),
        caption: "Halo dunia #kopi",
        mediaItems: [IMAGE],
      });
      const card = within(panel()).getByLabelText(`Pratinjau umum ${label}`);
      expect(within(card).getByText("Kopi Selasar")).toBeTruthy();
      expect(within(card).getByText(`${label} · Baru saja`)).toBeTruthy();
      expect(within(card).getByText("Halo dunia")).toBeTruthy();
      expect(within(card).getByText("#kopi")).toBeTruthy();
      expect(within(card).getByRole("img", { name: "kopi.jpg" })).toBeTruthy();
    },
  );

  it("tanpa media tidak ada gambar; ada media lebih dari satu menampilkan penanda 1/N", () => {
    const x = account(SocialPlatform.Twitter, "Kopi");
    const { unmount } = renderPanel({ account: x, caption: "Teks saja" });
    expect(within(panel()).queryByRole("img")).toBeNull();
    unmount();

    renderPanel({
      account: x,
      mediaItems: [IMAGE, { ...IMAGE, id: "m3", filename: "dua.jpg" }],
    });
    expect(within(panel()).getByText("1/2")).toBeTruthy();
  });
});
