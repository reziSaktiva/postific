import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { StartPageRecord } from "@/domains/start-page";

// Server Actions menyeret Prisma/next-cache; tes render tidak memanggilnya.
vi.mock("../actions", () => ({
  getStartPageAction: vi.fn(),
  createStartPageAction: vi.fn(),
  updateStartPageProfileAction: vi.fn(),
  setStartPagePublishedAction: vi.fn(),
  addStartPageLinkAction: vi.fn(),
  updateStartPageLinkAction: vi.fn(),
  deleteStartPageLinkAction: vi.fn(),
  reorderStartPageLinksAction: vi.fn(),
}));

import { StartPageEditor } from "./StartPageEditor";

function link(
  id: string,
  label: string,
  clickCount: number,
  isActive = true,
): StartPageRecord["links"][number] {
  return {
    id,
    label,
    url: `https://${id}.test/`,
    position: 0,
    isActive,
    clickCount,
  };
}

function makePage(overrides: Partial<StartPageRecord> = {}): StartPageRecord {
  return {
    id: "p1",
    workspaceId: "w1",
    slug: "kopi-selasar",
    title: "Kopi Selasar",
    bio: "Kedai kopi",
    avatarUrl: null,
    theme: "default",
    isPublished: true,
    viewCount: 1842,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    links: [
      link("a", "Promo Minggu Ini", 128),
      link("b", "Menu & Harga", 64),
      link("c", "Order via WhatsApp", 12, false),
    ],
    ...overrides,
  } as unknown as StartPageRecord;
}

function render(
  page: StartPageRecord | null,
  appOrigin: string | null = "https://postific.test",
) {
  return renderToStaticMarkup(
    <StartPageEditor initialPage={page} appOrigin={appOrigin} />,
  );
}

describe("StartPageEditor — state belum ada halaman", () => {
  it("shows the create form (title + slug) and nothing else", () => {
    const html = render(null);
    expect(html).toContain("Buat Halaman");
    expect(html).toContain("Judul Halaman");
    expect(html).toContain("Slug (URL Halaman)");
    expect(html).not.toContain("Link List");
    expect(html).not.toContain("Preview");
  });
});

describe("StartPageEditor — struktur terkunci (T-072)", () => {
  const html = render(makePage());

  it("renders Profil, Link List, Preview and Share cards", () => {
    for (const title of ["Profil Halaman", "Link List", "Preview", "Share"]) {
      expect(html).toContain(title);
    }
  });

  it("Link List is header-less rows (no Table, no column header) inside a bordered wrapper", () => {
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<thead");
    expect(html).not.toContain('data-slot="item"');
    expect(html.match(/data-testid="sp-link-row"/g)).toHaveLength(3);
    expect(html).toContain("rounded-xl border border-border");
  });

  it("each row has drag handle, label/url, meta, status and edit/delete", () => {
    expect(html).toContain("Urutkan link Promo Minggu Ini");
    expect(html).toContain("Edit link Promo Minggu Ini");
    expect(html).toContain("Hapus link Promo Minggu Ini");
    expect(html).toContain("https://a.test/");
    expect(html.match(/>Aktif</g)).toHaveLength(2);
    expect(html).toContain(">Nonaktif<");
  });

  it("Preview reuses the Option B structure and hides inactive links", () => {
    const preview = html.slice(html.indexOf("Pratinjau halaman publik"));
    expect(preview).toContain("Promo Minggu Ini");
    expect(preview).toContain("Menu &amp; Harga");
    expect(preview).not.toContain("Order via WhatsApp");
    expect(preview).toContain("Powered by");
    expect(preview).toContain('data-sp-theme="default"');
  });

  it("Share shows the public URL and the Published state with Unpublish", () => {
    expect(html).toContain('value="https://postific.test/u/kopi-selasar"');
    expect(html).toContain(">Published<");
    expect(html).toContain(">Unpublish<");
  });

  it("falls back to the bare path when no app origin is known", () => {
    expect(render(makePage(), null)).toContain('value="/u/kopi-selasar"');
  });

  it("shows Publish for an unpublished page", () => {
    const draft = render(makePage({ isPublished: false }));
    expect(draft).toContain(">Unpublished<");
    expect(draft).toContain(">Publish<");
  });

  it("profile photo is a file input, not a URL field", () => {
    expect(html).toContain("Foto Profil");
    expect(html).toContain('type="file"');
    expect(html).toContain("JPG/PNG, maks 2MB");
    expect(html).not.toContain("URL Avatar");
    expect(html).not.toContain(">Hapus foto<");
  });

  it("offers remove when a photo is already stored", () => {
    expect(render(makePage({ avatarUrl: "https://cdn.test/a.png" }))).toContain(
      ">Hapus foto<",
    );
  });

  it("theme selector is a single ToggleGroup with 3 dotted items", () => {
    expect(html).toContain('data-slot="toggle-group"');
    expect(html.match(/data-slot="toggle-group-item"/g)).toHaveLength(3);
    expect(html.match(/data-sp-dot=/g)).toHaveLength(3);
    for (const label of ["Default", "Dark", "Aksen"]) {
      expect(html).toContain(label);
    }
  });

  it("uses no inline style except Radix/ui internals and no raw hex", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe("StartPageEditor — preset tema di Preview (T-073)", () => {
  it.each(["default", "dark", "accent"] as const)(
    "applies %s to the preview wrapper",
    (theme) => {
      const html = render(makePage({ theme }));
      expect(html).toContain(`data-sp-theme="${theme}"`);
      expect(html).toContain(
        `Preset tema: ${{ default: "Default", dark: "Dark", accent: "Aksen" }[theme]}`,
      );
    },
  );
});

describe("StartPageEditor — analytics (T-074)", () => {
  it("normal: full numbers < 10.000 for visits and clicks", () => {
    const html = render(makePage());
    expect(html).toContain("Total kunjungan sejak dipublish");
    expect(html).toContain(">1.842<");
    expect(html).toContain("1.842 kunjungan");
    expect(html).toContain("128 klik");
    expect(html).not.toContain("Belum ada kunjungan");
    expect(html).not.toContain("Klik dihitung setelah halaman dipublish");
  });

  it("zero data: 0 + hint, links 0 klik, note under the list", () => {
    const html = render(
      makePage({
        viewCount: 0,
        links: [link("a", "Promo", 0), link("b", "Menu", 0)],
      }),
    );
    expect(html).toContain(">0<");
    expect(html).toContain("0 kunjungan");
    expect(html).toContain("Belum ada kunjungan. Bagikan URL halaman Anda.");
    expect(html).toContain("0 klik");
    expect(html).toContain(
      "Klik dihitung setelah halaman dipublish dan dikunjungi.",
    );
  });

  it("big numbers: compact visually (aria-hidden), full value for screen readers + title", () => {
    const html = render(
      makePage({
        viewCount: 2_431_870,
        links: [
          link("a", "Promo", 12_480),
          link("b", "Menu", 1_204_000),
          link("c", "Wa", 987),
        ],
      }),
    );
    const plain = html.replace(/ /g, " ");
    expect(plain).toContain('<span aria-hidden="true">2,4 jt</span>');
    expect(plain).toContain('<span class="sr-only">2.431.870 kunjungan</span>');
    expect(plain).toContain('title="2.431.870 kunjungan"');
    expect(plain).toContain('<span aria-hidden="true">12,5 rb klik</span>');
    expect(plain).toContain('<span class="sr-only">12.480 klik</span>');
    expect(plain).toContain('<span aria-hidden="true">1,2 jt klik</span>');
    expect(plain).toContain('<span aria-hidden="true">987 klik</span>');
  });

  it("inactive links still show their historical clicks", () => {
    expect(render(makePage())).toContain("12 klik");
  });
});

describe("StartPageEditor — halaman tanpa link", () => {
  it("shows the empty list hint and still renders Preview", () => {
    const html = render(makePage({ links: [], viewCount: 5 }));
    expect(html).toContain("Belum ada link");
    expect(html).not.toContain('data-testid="sp-link-row"');
    expect(html).toContain("Powered by");
  });
});
