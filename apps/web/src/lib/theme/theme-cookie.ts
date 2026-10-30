export type ThemeMode = "light" | "dark";

export const THEME_COOKIE_NAME = "theme";

// Satu tahun. Preferensi tema tidak sensitif, jadi cookie sengaja bukan
// httpOnly — client yang menulisnya saat toggle, RSC yang membacanya
// sebelum render pertama (ADR-055).
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_THEME_MODE: ThemeMode = "light";

// Satu-satunya sumber string media query `prefers-color-scheme` — dipakai
// baik oleh `matchMedia()` di Providers.tsx maupun diinterpolasi ke dalam
// `SYSTEM_DARK_CLASS_SCRIPT` di bawah, supaya kedua tempat deteksi OS
// dark-mode tidak bisa diam-diam divergen.
export const PREFERS_DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

// Isi `<script>` inline sinkron di `<head>` app/layout.tsx (T-177): menambah
// class `dark` ke `<html>` sebelum body dilukis kalau OS gelap. Satu tempat
// dengan `PREFERS_DARK_MEDIA_QUERY`; ubah bersamaan dengan koreksi OS di
// `useLayoutEffect` Providers.tsx.
export const SYSTEM_DARK_CLASS_SCRIPT = `(function(){try{if(window.matchMedia(${JSON.stringify(PREFERS_DARK_MEDIA_QUERY)}).matches){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export function parseThemeMode(value: string | undefined | null): ThemeMode {
  return value === "dark" || value === "light" ? value : DEFAULT_THEME_MODE;
}

// Dipakai untuk menentukan "user sudah pernah pilih eksplisit" (gate OS-
// preference detection di layout.tsx & Providers.tsx) — beda dari sekadar
// truthiness cookie, supaya nilai cookie yang corrupt/tidak valid tetap
// dianggap "belum pernah pilih" alih-alih diam-diam mengunci ke fallback
// `parseThemeMode` tanpa jalur koreksi ke preferensi OS.
export function isExplicitThemeCookieValue(
  value: string | undefined | null,
): value is ThemeMode {
  return value === "dark" || value === "light";
}
