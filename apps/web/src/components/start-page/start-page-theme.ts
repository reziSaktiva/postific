import { parseStartPageTheme, type StartPageTheme } from "@/domains/start-page";

/**
 * Pemetaan preset tema Start Page (T-073, LOCKED 2026-10-26) ke class
 * Tailwind token-backed. Preset = SCOPE token, bukan token baru:
 * - `default` : tanpa override, ikut tema aplikasi (identik Opsi B T-071).
 * - `dark`    : scope class `.dark` (token Dark Mode yang sudah ada di
 *               `globals.css`) + latar/teks dari token di scope itu.
 * - `accent`  : netral tanpa hue, inversi `primary`/`primary-foreground`:
 *               latar = primary, judul/bio = primary-foreground, avatar
 *               dibalik. Kartu tautan tetap permukaan netral (`bg-card`).
 * Kontras diuji di `start-page-theme.test.ts`.
 */
export interface StartPageThemeStyle {
  /** Class untuk wrapper terluar halaman (scope token + latar). */
  wrapper: string;
  title: string;
  bio: string;
  avatar: string;
}

const BASE_TITLE = "text-foreground";
const BASE_BIO = "text-muted-foreground";
const BASE_AVATAR = "bg-primary text-primary-foreground";

export const START_PAGE_THEME_STYLE: Record<
  StartPageTheme,
  StartPageThemeStyle
> = {
  default: {
    wrapper: "",
    title: BASE_TITLE,
    bio: BASE_BIO,
    avatar: BASE_AVATAR,
  },
  dark: {
    wrapper: "dark bg-background text-foreground",
    title: BASE_TITLE,
    bio: BASE_BIO,
    avatar: BASE_AVATAR,
  },
  accent: {
    wrapper: "bg-primary text-primary-foreground",
    title: "text-primary-foreground",
    bio: "text-primary-foreground",
    avatar: "bg-primary-foreground text-primary",
  },
};

export function getStartPageThemeStyle(theme: unknown): StartPageThemeStyle {
  return START_PAGE_THEME_STYLE[parseStartPageTheme(theme)];
}

/** Label dan deskripsi preset untuk selector di Page Editor. */
export const START_PAGE_THEME_META: Record<
  StartPageTheme,
  { label: string; description: string }
> = {
  default: {
    label: "Default",
    description:
      "Default: ikut tema aplikasi, tanpa penyesuaian. Preview di samping langsung mengikuti pilihan.",
  },
  dark: {
    label: "Dark",
    description:
      "Dark: latar gelap memakai token Dark Mode yang sudah ada. Preview di samping langsung mengikuti pilihan.",
  },
  accent: {
    label: "Aksen",
    description:
      "Aksen: netral tanpa hue. Latar memakai warna primary, judul dan avatar dibalik; kartu link tetap netral. Preview di samping langsung mengikuti pilihan.",
  },
};
