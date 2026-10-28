import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { START_PAGE_THEMES } from "@/domains/start-page";

import {
  START_PAGE_THEME_META,
  START_PAGE_THEME_STYLE,
  getStartPageThemeStyle,
} from "./start-page-theme";

type Tokens = Record<string, string>;

const globalsCss = readFileSync(
  path.resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

/** Token hex dari satu blok selector di `globals.css` (`:root` / `.dark`). */
function readTokens(selector: string): Tokens {
  const start = globalsCss.indexOf(`${selector} {`);
  const end = globalsCss.indexOf("}", start);
  const tokens: Tokens = {};
  for (const m of globalsCss
    .slice(start, end)
    .matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT = readTokens(":root");
const DARK = readTokens(".dark");
const AA = 4.5;

describe("start-page theme presets (T-073)", () => {
  it("defines a style and meta for every allowlisted preset", () => {
    for (const theme of START_PAGE_THEMES) {
      expect(START_PAGE_THEME_STYLE[theme]).toBeDefined();
      expect(START_PAGE_THEME_META[theme].label).not.toBe("");
    }
  });

  it("default adds no override; dark scopes the .dark tokens; accent inverts primary", () => {
    expect(START_PAGE_THEME_STYLE.default.wrapper).toBe("");
    expect(START_PAGE_THEME_STYLE.dark.wrapper.split(" ")).toContain("dark");
    expect(START_PAGE_THEME_STYLE.accent.wrapper).toContain("bg-primary");
    expect(START_PAGE_THEME_STYLE.accent.avatar).toContain(
      "bg-primary-foreground",
    );
  });

  it("falls back to default for unknown/garbage values", () => {
    expect(getStartPageThemeStyle("neon")).toBe(START_PAGE_THEME_STYLE.default);
    expect(getStartPageThemeStyle(undefined)).toBe(
      START_PAGE_THEME_STYLE.default,
    );
  });

  it("uses only token utilities (no raw color/size values)", () => {
    for (const theme of START_PAGE_THEMES) {
      const all = Object.values(START_PAGE_THEME_STYLE[theme]).join(" ");
      expect(all).not.toMatch(/#[0-9a-f]{3,6}|\[|px\b/i);
    }
  });
});

describe("start-page theme contrast (dihitung dari token globals.css)", () => {
  const appModes: Array<[string, Tokens]> = [
    ["app light", LIGHT],
    ["app dark", DARK],
  ];

  it.each(appModes)("accent: title/bio/avatar >= 4.5:1 (%s)", (_n, app) => {
    // judul & bio = primary-foreground di atas latar primary
    expect(contrast(app["primary-foreground"], app.primary)).toBeGreaterThan(
      AA,
    );
    // avatar dibalik: teks primary di atas latar primary-foreground
    expect(contrast(app.primary, app["primary-foreground"])).toBeGreaterThan(
      AA,
    );
    // kartu tetap netral
    expect(contrast(app["card-foreground"], app.card)).toBeGreaterThan(AA);
  });

  it.each(appModes)(
    "dark preset: scope .dark terbaca di atas app apa pun (%s)",
    () => {
      expect(contrast(DARK.foreground, DARK.background)).toBeGreaterThan(AA);
      expect(
        contrast(DARK["muted-foreground"], DARK.background),
      ).toBeGreaterThan(AA);
      expect(contrast(DARK["card-foreground"], DARK.card)).toBeGreaterThan(AA);
      expect(contrast(DARK["muted-foreground"], DARK.card)).toBeGreaterThan(AA);
    },
  );

  it("default: judul >= 4.5:1; bio (muted-foreground) tercatat di bawah AA pada light", () => {
    expect(contrast(LIGHT.foreground, LIGHT.background)).toBeGreaterThan(AA);
    expect(contrast(DARK.foreground, DARK.background)).toBeGreaterThan(AA);
    expect(contrast(DARK["muted-foreground"], DARK.background)).toBeGreaterThan(
      AA,
    );
    // Token `muted-foreground` mode light (bio/badge) ~3,4-3,8:1: di bawah AA
    // untuk teks kecil. Itu token bersama aplikasi (sama dengan rancangan
    // `--color-text-secondary`), BUKAN override preset — dikunci >= 3 supaya
    // regresi lebih buruk tertangkap; perbaikan butuh keputusan token desain.
    expect(
      contrast(LIGHT["muted-foreground"], LIGHT.background),
    ).toBeGreaterThan(3);
    expect(contrast(LIGHT["muted-foreground"], LIGHT.card)).toBeGreaterThan(3);
  });
});
