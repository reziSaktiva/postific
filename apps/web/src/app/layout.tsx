import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree, Montserrat } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NONCE_HEADER } from "@/lib/security/public-csp";

import {
  SYSTEM_DARK_CLASS_SCRIPT,
  THEME_COOKIE_NAME,
  isExplicitThemeCookieValue,
  parseThemeMode,
} from "@/lib/theme/theme-cookie";
import { cn } from "@/lib/utils";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

// Stone theme (ADR-087) memakai Montserrat khusus heading (`h1`-`h6`) —
// gap yang dicatat T-095.5, ditutup di T-096.1. Body tetap Figtree.
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Postific",
  description: "Postific — social media management platform (MVP scaffold)",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialMode = parseThemeMode(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const hasExplicitTheme = isExplicitThemeCookieValue(
    cookieStore.get(THEME_COOKIE_NAME)?.value,
  );
  // Nonce CSP hanya ada di `/u/*` (proxy.ts, T-160); rute lain `undefined`.
  // Hanya dibaca saat skrip tema dirender (cookie `theme` belum ada).
  const nonce = hasExplicitTheme
    ? undefined
    : ((await headers()).get(NONCE_HEADER) ?? undefined);

  return (
    <html
      lang="en"
      // shadcn/ui dark mode = class `dark` di elemen root (T-096.2,
      // `@custom-variant dark (&:is(.dark *))` di globals.css). Diterapkan
      // langsung dari cookie yang sama dengan `initialMode` Providers supaya
      // server & client render mode yang identik sejak first paint — tidak
      // ada flash tema salah (ADR-055, dipertahankan lewat ADR-097 poin 9).
      // `suppressHydrationWarning` (T-039, amendemen ADR-055): kalau cookie
      // `theme` belum ada, script di bawah menambah class `dark` secara
      // langsung ke DOM sebelum hydration mengikuti `prefers-color-scheme`
      // — beda dari class yang dihitung di sini (selalu default "light"
      // saat cookie kosong, karena RSC tidak bisa baca preferensi OS).
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        figtree.variable,
        montserrat.variable,
        initialMode === "dark" && "dark",
      )}
    >
      <head>
        {hasExplicitTheme ? null : (
          // Cookie belum ada (user belum pernah pilih Light/Dark eksplisit)
          // — default ikut sistem operasi (T-039, amendemen ADR-055).
          // `<script>` inline biasa (bukan `next/script`) supaya berjalan
          // sinkron saat HTML di-parse, sebelum `<body>` dilukis (T-177,
          // KI-104). `next/script` `beforeInteractive` di App Router hanya
          // mengantre ke `self.__next_s` yang baru dieksekusi setelah chunk
          // framework dimuat, jadi halaman sempat dilukis terang lebih dulu.
          // `nonce` wajib di `/u/*` (CSP `strict-dynamic`, T-160).
          // Konsisten dengan `resolveInitialMode()` di
          // `components/Providers.tsx` — ubah keduanya bersamaan.
          // `suppressHydrationWarning`: browser menyembunyikan nilai `nonce`
          // di DOM (`nonce=""`), jadi React dev memperingatkan mismatch.
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: SYSTEM_DARK_CLASS_SCRIPT }}
          />
        )}
      </head>
      <body className="flex min-h-full flex-col">
        <Providers initialMode={initialMode}>{children}</Providers>
      </body>
    </html>
  );
}
