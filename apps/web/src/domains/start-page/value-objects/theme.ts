/**
 * Tema Start Page (T-073). Preset TERBATAS yang diturunkan dari token
 * produk — BUKAN CSS bebas dari pengguna. Kolom `start_page_pages.theme`
 * adalah `text`, jadi allowlist ditegakkan di sini (domain), bukan di DB.
 *
 * SATU tempat untuk mengganti daftar preset: `START_PAGE_THEMES` di bawah.
 * Daftar sementara; daftar final dirancang Neymar (paralel). Mengganti
 * daftar cukup di sini — baris DB berisi nilai lama otomatis jatuh ke
 * `DEFAULT_START_PAGE_THEME` lewat `parseStartPageTheme`.
 */
export const START_PAGE_THEMES = ["default", "dark", "accent"] as const;

export type StartPageTheme = (typeof START_PAGE_THEMES)[number];

export const DEFAULT_START_PAGE_THEME: StartPageTheme = "default";

export function isStartPageTheme(value: unknown): value is StartPageTheme {
  return (
    typeof value === "string" &&
    (START_PAGE_THEMES as readonly string[]).includes(value)
  );
}

/**
 * Parse longgar untuk BACA (render publik, baris DB lama): nilai di luar
 * allowlist/bukan string jatuh ke `"default"`, tidak melempar. Untuk TULIS
 * (input pengguna) pakai `isStartPageTheme` lalu tolak — jangan diam-diam
 * mengganti pilihan pengguna.
 */
export function parseStartPageTheme(value: unknown): StartPageTheme {
  return isStartPageTheme(value) ? value : DEFAULT_START_PAGE_THEME;
}
