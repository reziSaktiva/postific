import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PublicStartPage } from "@/domains/start-page";

import { StartPageProfile } from "./StartPageProfile";

const basePage: PublicStartPage = {
  slug: "kopi-selasar",
  title: "Kopi Selasar",
  bio: "Kedai kopi & ruang nongkrong di Selasar",
  avatarUrl: null,
  theme: "default",
  links: [
    {
      id: "link-1",
      label: "Instagram @kopiselasar",
      url: "https://www.instagram.com/kopiselasar",
    },
    {
      id: "link-2",
      label: "Menu & Harga",
      url: "https://kopiselasar.example/menu",
    },
  ],
};

function render(overrides: Partial<PublicStartPage> = {}): string {
  return renderToStaticMarkup(
    <StartPageProfile page={{ ...basePage, ...overrides }} />,
  );
}

describe("StartPageProfile (Card Stack, T-071)", () => {
  it("renders title as the page heading, the bio, and the Postific badge", () => {
    const html = render();
    expect(html).toMatch(/<h1[^>]*>Kopi Selasar<\/h1>/);
    expect(html).toContain("Kedai kopi &amp; ruang nongkrong di Selasar");
    expect(html).toContain("Powered by");
    expect(html).toContain("Postific");
  });

  it("falls back to initials when there is no avatar", () => {
    const html = render({ avatarUrl: null });
    expect(html).toContain("KS");
    expect(html).not.toContain("<img");
  });

  it("omits the bio paragraph when bio is null", () => {
    const html = render({ bio: null });
    expect(html).not.toContain("Kedai kopi");
  });

  it("renders every link as its own Card wrapping an <a>", () => {
    const html = render();
    expect(html.match(/data-slot="card"/g)).toHaveLength(2);
    expect(html.match(/<a /g)).toHaveLength(2);
    // Bukan pola Item/ItemGroup (terkunci: Card mandiri per tautan).
    expect(html).not.toContain('data-slot="item"');
    expect(html).not.toContain('data-slot="item-group"');
  });

  it("points href to the tracked redirect path, never the destination URL", () => {
    const html = render();
    expect(html).toContain('href="/u/kopi-selasar/go/link-1"');
    expect(html).toContain('href="/u/kopi-selasar/go/link-2"');
    expect(html).not.toContain("instagram.com");
    expect(html).not.toContain("kopiselasar.example");
  });

  it("opens links in a new tab with the safe rel set", () => {
    const html = render();
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer nofollow ugc"/g)).toHaveLength(
      2,
    );
  });

  it("escapes markup in user-supplied text", () => {
    const html = render({
      title: "<script>alert(1)</script>",
      links: [{ id: "x", label: "<img src=x onerror=1>", url: "https://a.b" }],
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });

  it("renders no link list when there are no links", () => {
    const html = render({ links: [] });
    expect(html).not.toContain("<ul");
    expect(html).toContain("Powered by");
  });

  it("uses no inline style attributes", () => {
    expect(render()).not.toContain("style=");
  });

  describe("tema preset (T-073)", () => {
    it("default: wrapper tanpa scope override, ikut tema aplikasi", () => {
      const html = render({ theme: "default" });
      expect(html).toContain('data-sp-theme="default"');
      expect(html).toContain(
        '<main data-sp-theme="default" class="flex w-full flex-1 flex-col">',
      );
      expect(html).not.toContain("bg-primary-foreground");
    });

    it("dark: wrapper membawa scope class .dark + latar token", () => {
      const html = render({ theme: "dark" });
      expect(html).toContain('data-sp-theme="dark"');
      expect(html).toMatch(/<main[^>]*class="[^"]*\bdark\b[^"]*bg-background/);
    });

    it("accent: latar primary, judul/bio primary-foreground, avatar dibalik", () => {
      const html = render({ theme: "accent" });
      expect(html).toContain('data-sp-theme="accent"');
      expect(html).toMatch(/<main[^>]*class="[^"]*\bbg-primary\b/);
      expect(html).toMatch(/<h1[^>]*text-primary-foreground/);
      expect(html).toMatch(/<p[^>]*text-primary-foreground/);
      expect(html).toContain("bg-primary-foreground text-primary");
      // kartu tautan tetap netral
      expect(html.match(/data-slot="card"/g)).toHaveLength(2);
    });

    it("tema tak dikenal jatuh ke default (tidak melempar)", () => {
      const html = render({ theme: "neon" as PublicStartPage["theme"] });
      expect(html).toContain('data-sp-theme="default"');
    });

    it("tetap tanpa style inline dan struktur Card Stack di semua preset", () => {
      for (const theme of ["default", "dark", "accent"] as const) {
        const html = render({ theme });
        expect(html).not.toContain("style=");
        expect(html.match(/data-slot="card"/g)).toHaveLength(2);
        expect(html).toContain("Powered by");
      }
    });
  });

  describe("mode preview (Page Editor, T-072)", () => {
    it("memakai <section> (bukan <main>) dan tautan tanpa href/target", () => {
      const html = renderToStaticMarkup(
        <StartPageProfile page={basePage} preview />,
      );
      expect(html).toMatch(/^<section/);
      expect(html).not.toContain("<main");
      expect(html).not.toContain("href=");
      expect(html).not.toContain("target=");
      expect(html).not.toContain("buka di tab baru");
      expect(html.match(/data-slot="card"/g)).toHaveLength(2);
    });

    it("tetap menerapkan preset tema", () => {
      const html = renderToStaticMarkup(
        <StartPageProfile page={{ ...basePage, theme: "dark" }} preview />,
      );
      expect(html).toMatch(/^<section[^>]*\bdark\b/);
    });
  });
});
