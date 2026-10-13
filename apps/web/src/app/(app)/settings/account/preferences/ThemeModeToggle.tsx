"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useThemeMode } from "@/components/Providers";

// T-016.3 — reuse useThemeMode() (sudah tersambung ke cookie `theme`
// server-side via Providers.tsx, ADR-055). Tidak membuat state/cookie baru.
//
// RS-D03 (KI-036): leaf Client Component — satu-satunya bagian page
// Preferences yang butuh interactivity (hook + event handler). Dipisah dari
// `page.tsx` supaya page tetap Server Component (AGENTS.md rule 5/RS-D03,
// `rendering-strategy.md`), bukan seluruh page jadi Client Component hanya
// karena satu toggle.
export function ThemeModeToggle() {
  const { mode, toggleMode } = useThemeMode();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={mode}
      onValueChange={(value) => {
        if (value && value !== mode) {
          toggleMode();
        }
      }}
      aria-label="Tema Tampilan"
    >
      <ToggleGroupItem value="light" aria-label="Light">
        <HugeiconsIcon icon={Sun01Icon} strokeWidth={2} />
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark">
        <HugeiconsIcon icon={Moon01Icon} strokeWidth={2} />
        Dark
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
