// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { SocialPlatform } from "@postific/shared";
import { afterEach, describe, expect, it } from "vitest";

import { getLogoBox, meetsMinimumSize } from "./platform-logos";
import { PLATFORM_ICON } from "./platform-icons";

afterEach(cleanup);

function renderIcon(platform: SocialPlatform, size: number) {
  const { Icon } = PLATFORM_ICON[platform];
  return render(<Icon size={size} color="#123456" aria-hidden />).container;
}

describe("logo resmi platform (T-209.3)", () => {
  it("kotak logo mempertahankan rasio asli di dalam kotak persegi", () => {
    expect(getLogoBox(20, 1)).toEqual({ width: 20, height: 20 });
    expect(getLogoBox(20, 2)).toEqual({ width: 20, height: 10 });
    expect(getLogoBox(20, 0.5)).toEqual({ width: 10, height: 20 });
  });

  it("minimum merek: Facebook lebar 16px, LinkedIn tinggi 21px", () => {
    const facebook = { light: "x", aspect: 1, minWidth: 16 };
    expect(meetsMinimumSize(15, facebook)).toBe(false);
    expect(meetsMinimumSize(16, facebook)).toBe(true);
    const linkedin = { light: "x", aspect: 160 / 137, minHeight: 21 };
    expect(meetsMinimumSize(24, linkedin)).toBe(false);
    expect(meetsMinimumSize(26, linkedin)).toBe(true);
  });

  it("Facebook memakai logo resmi di 16px dan glif lama di bawah minimum", () => {
    const big = renderIcon(SocialPlatform.Facebook, 16);
    expect(big.querySelector("img")?.getAttribute("src")).toContain(
      "/brand/platforms/facebook.png",
    );
    cleanup();
    const small = renderIcon(SocialPlatform.Facebook, 9);
    expect(small.querySelector("img")).toBeNull();
    expect(small.querySelector("svg")).not.toBeNull();
  });

  it("LinkedIn jatuh ke glif lama di semua ukuran pemakaian saat ini (di bawah 21px tinggi)", () => {
    for (const size of [9, 12, 16, 18]) {
      const el = renderIcon(SocialPlatform.LinkedIn, size);
      expect(el.querySelector("img")).toBeNull();
      expect(el.querySelector("svg")).not.toBeNull();
      cleanup();
    }
  });

  it("Instagram dan Threads merender varian terang dan gelap, bergantian lewat kelas dark", () => {
    for (const [platform, file] of [
      [SocialPlatform.Instagram, "instagram"],
      [SocialPlatform.Threads, "threads"],
    ] as const) {
      const el = renderIcon(platform, 14);
      const imgs = [...el.querySelectorAll("img")];
      expect(imgs).toHaveLength(2);
      expect(imgs[0]!.getAttribute("src")).toContain(`${file}-black.svg`);
      expect(imgs[0]!.className).toContain("dark:hidden");
      expect(imgs[1]!.getAttribute("src")).toContain(`${file}-white.svg`);
      expect(imgs[1]!.className).toContain("dark:block");
      // Logo resmi tidak diwarnai ulang: `color` tidak masuk ke gambar.
      expect(el.innerHTML).not.toContain("#123456");
      cleanup();
    }
  });

  it("YouTube memakai logo resmi berwarna di kedua mode", () => {
    const el = renderIcon(SocialPlatform.YouTube, 14);
    expect(el.querySelectorAll("img")).toHaveLength(1);
    expect(el.querySelector("img")?.getAttribute("src")).toContain(
      "youtube.png",
    );
  });

  it("X, Pinterest, dan TikTok tetap glif lama sampai aset resmi ada", () => {
    for (const platform of [
      SocialPlatform.Twitter,
      SocialPlatform.Pinterest,
      SocialPlatform.TikTok,
    ]) {
      const el = renderIcon(platform, 24);
      expect(el.querySelector("img")).toBeNull();
      expect(el.querySelector("svg")).not.toBeNull();
      cleanup();
    }
  });

  it("logo dihiasi aria-hidden dan tanpa teks alternatif (dekoratif)", () => {
    const img = renderIcon(SocialPlatform.Facebook, 16).querySelector("img");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
    expect(img?.getAttribute("alt")).toBe("");
  });
});
