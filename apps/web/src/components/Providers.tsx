"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_THEME_MODE,
  PREFERS_DARK_MEDIA_QUERY,
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  isExplicitThemeCookieValue,
  type ThemeMode,
} from "@/lib/theme/theme-cookie";

// T-098/T-099: `TooltipProvider` shadcn (dipasang sekali di root, per
// instruksi CLI shadcn saat `tooltip` di-install) — dibutuhkan oleh
// `Tooltip` yang dipakai WorkspaceSideNav/ChannelsSection/NotificationBell
// (T-098) dan ConnectPlatformMenu/tombol disabled Danger Zone (T-099)
// setelah migrasi dari `IconButton tooltip=...` Astryx.
import { TooltipProvider } from "@/components/ui/tooltip";
// T-160: `Toaster` sonner TIDAK dipasang di sini lagi. Sonner menyuntik
// `<style>` lewat JS saat runtime tanpa nonce, sehingga CSP nonce `/u/*`
// akan melanggar. Toaster dipasang di layout `(app)` lewat
// `app/(app)/components/AppToaster.tsx` (satu-satunya pemakai `toast()`).

type ThemeModeContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
};

// `initialMode` berasal dari cookie yang dibaca RSC di root layout, jadi
// server dan client merender mode yang sama — tidak ada hydration mismatch
// dan tidak ada flash tema salah saat reload (ADR-055).
const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within Providers");
  }
  return context;
}

function persistThemeMode(mode: ThemeMode) {
  document.cookie = `${THEME_COOKIE_NAME}=${mode}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

function hasThemeCookie(): boolean {
  const entry = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${THEME_COOKIE_NAME}=`));
  return isExplicitThemeCookieValue(entry?.slice(THEME_COOKIE_NAME.length + 1));
}

// `useLayoutEffect` melempar warning React kalau dipanggil saat SSR — di
// server dipakai `useEffect` biasa (no-op di server, sama seperti semua
// effect lain) supaya tidak ada warning, sementara di client tetap
// `useLayoutEffect` (perlu SEBELUM paint, bukan setelahnya, lihat komentar
// di bawah).
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Providers({
  children,
  initialMode = DEFAULT_THEME_MODE,
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  // `initialMode` (dari cookie, dibaca RSC) dipakai APA ADANYA di sini
  // (bukan resolve preferensi OS langsung di initializer) — server dan
  // render client pertama harus identik persis, kalau tidak `mode` yang
  // dikonsumsi banyak tempat (ikon toggle di WorkspaceSideNav, label di
  // Preferences, `Toaster`) akan hydration-mismatch dan sempat "salah
  // sebentar" sebelum dikoreksi (temuan review Ridwan, T-039). Koreksi ke
  // preferensi OS (kalau belum ada cookie) dilakukan di `useLayoutEffect`
  // di bawah — SEBELUM browser paint pertama, jadi tidak pernah benar-benar
  // terlihat, beda dengan `useEffect` biasa yang baru jalan SETELAH paint.
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  // T-039 (amendemen ADR-055): kalau belum ada cookie `theme` (user belum
  // pernah pilih eksplisit), koreksi `mode` ke preferensi OS sebelum paint
  // pertama. Konsisten dengan `<script>` inline sinkron di
  // `app/layout.tsx` yang sudah menerapkan class `dark` ke `<html>`
  // langsung by DOM manipulation (di luar React) untuk kasus yang sama —
  // ubah keduanya bersamaan kalau logic ini berubah. Sengaja jalan sekali
  // saja di mount (bukan mendengarkan perubahan OS live) — begitu user
  // toggle eksplisit, cookie ditulis dan efek ini tidak relevan lagi
  // (`hasThemeCookie()` sudah true di render berikutnya).
  useIsomorphicLayoutEffect(() => {
    if (hasThemeCookie()) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const systemMode: ThemeMode = window.matchMedia(PREFERS_DARK_MEDIA_QUERY)
      .matches
      ? "dark"
      : "light";
    setMode((current) => (current === systemMode ? current : systemMode));
  }, []);

  // shadcn/ui pakai strategi class `dark` di elemen root (`@custom-variant
  // dark (&:is(.dark *))`, globals.css) — bukan lagi provider `Theme`
  // Astryx. `<html>` sudah dapat class yang benar di render pertama dari
  // RootLayout (Server Component, baca cookie yang sama) + script inline
  // sinkron (untuk kasus belum ada cookie, ikut sistem), jadi
  // baris ini hanya menjaga class tetap sinkron — saat koreksi OS di atas
  // (mount pertama) maupun saat `toggleMode()` dipanggil di client tanpa
  // reload (ADR-097 poin 9, mengamendemen ADR-055 — mekanisme toggle tetap
  // ada, `ThemeModeContext`/`useThemeMode` custom ini tidak berubah).
  // `useLayoutEffect` (bukan `useEffect`) supaya sinkron sebelum paint,
  // konsisten dengan effect koreksi OS di atas.
  useIsomorphicLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  const themeModeValue = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      // Cookie HANYA ditulis di sini (pilihan eksplisit user), bukan lewat
      // effect otomatis tiap `mode` berubah — supaya default hasil deteksi
      // sistem (`resolveInitialMode`) tidak langsung "mengunci" jadi
      // preferensi eksplisit sebelum user benar-benar menekan toggle.
      toggleMode: () =>
        setMode((current) => {
          const next = current === "light" ? "dark" : "light";
          persistThemeMode(next);
          return next;
        }),
    }),
    [mode],
  );

  return (
    <ThemeModeContext.Provider value={themeModeValue}>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeModeContext.Provider>
  );
}
