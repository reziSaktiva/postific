"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { START_PAGE_THEME_META } from "@/components/start-page/start-page-theme";
import {
  START_PAGE_THEMES,
  isStartPageTheme,
  type StartPageTheme,
} from "@/domains/start-page";
import { cn } from "@/lib/utils";

/**
 * Titik warna item selector (`.sp-dot`, T-073): lingkaran kecil berisi
 * cuplikan latar+aksen preset, memakai scope token yang sama dengan
 * preset-nya (default = tema aplikasi, dark = scope `.dark`, accent =
 * inversi primary).
 */
const DOT_SCOPE: Record<StartPageTheme, string> = {
  default: "bg-background",
  dark: "dark bg-background",
  accent: "bg-primary",
};
const DOT_CORE: Record<StartPageTheme, string> = {
  default: "bg-primary",
  dark: "bg-primary",
  accent: "bg-primary-foreground",
};

function ThemeDot({ theme }: { theme: StartPageTheme }) {
  return (
    <span
      aria-hidden="true"
      data-sp-dot={theme}
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-foreground/30",
        DOT_SCOPE[theme],
      )}
    >
      <span className={cn("size-1 rounded-full", DOT_CORE[theme])} />
    </span>
  );
}

/**
 * Selector preset tema Page Editor — LOCKED PATTERN T-073 (King Rezi
 * 2026-10-26, pola B): `ToggleGroup type="single"` + `ToggleGroupItem`,
 * tiga item bertitik warna. Radix single boleh "menghapus pilihan"
 * (value kosong) — diabaikan supaya selalu ada satu tema terpilih.
 */
export function ThemeToggleGroup({
  value,
  onValueChange,
  labelledBy,
  disabled,
}: {
  value: StartPageTheme;
  onValueChange: (theme: StartPageTheme) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={value}
      disabled={disabled}
      aria-labelledby={labelledBy}
      onValueChange={(next) => {
        if (isStartPageTheme(next)) onValueChange(next);
      }}
    >
      {START_PAGE_THEMES.map((theme) => (
        <ToggleGroupItem key={theme} value={theme}>
          <ThemeDot theme={theme} />
          {START_PAGE_THEME_META[theme].label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
