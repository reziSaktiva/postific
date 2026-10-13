import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

import { ThemeModeToggle } from "./ThemeModeToggle";

// T-016.3 — scope preferences hanya "Tema Tampilan" — tidak ada setting lain
// di baseline (information-architecture.md § 7 User Settings).
//
// T-099.1: `ToggleButtonGroup` Astryx (type="single") -> `ToggleGroup`
// shadcn (type="single" juga tersedia di primitive Radix-nya). Ikon
// FaSun/FaMoon (react-icons) diganti Sun01Icon/Moon01Icon (hugeicons).
//
// RS-D03 (KI-036): page ini sebelumnya `"use client"` di top-level sehingga
// seluruh page jadi Client Component. Tidak ada hook/event handler yang
// dipakai langsung di sini — satu-satunya bagian interaktif (ToggleGroup +
// `useThemeMode`) dipindah ke leaf Client Component `ThemeModeToggle`
// supaya page tetap Server Component (AGENTS.md rule 5, `rendering-strategy.md`).
export default function Page() {
  return (
    /* eslint-disable-next-line no-restricted-syntax -- T-099.1: file ini
       sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
       VStack Astryx. */
    <div className="flex max-w-2xl flex-col gap-6">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Preferences
      </h2>

      <Card>
        <CardContent>
          {/* eslint-disable-next-line no-restricted-syntax -- T-099.1, sama seperti di atas */}
          <div className="flex items-center justify-between gap-4">
            {/* eslint-disable-next-line no-restricted-syntax -- T-099.1, sama seperti di atas */}
            <div className="flex flex-col gap-1">
              <Text variant="small">Tema Tampilan</Text>
              <Text variant="muted">
                Pilih tampilan Light atau Dark untuk akun Anda.
              </Text>
            </div>

            <ThemeModeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
