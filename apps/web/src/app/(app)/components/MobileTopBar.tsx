"use client";

import { usePathname } from "next/navigation";

import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarLeftIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * T-098.4 (KI-042) — top bar mobile di bawah breakpoint `md` (768px, sama
 * seperti KSP-02-F10, lihat foundations/layout.html § "Shell — Mobile" di
 * Claude Design).
 *
 * T-105.3 (KI-066, ADR-097): sebelumnya komponen ini merender Sheet + salinan
 * `AppSideNav` sendiri (state `isOpen` lokal, T-098.4) karena sidebar
 * workspace/settings masih `<nav>` custom tanpa mekanisme mobile bawaan.
 * Sekarang keduanya dikomposisi dari primitive `Sidebar` shadcn, yang PUNYA
 * mobile behavior sendiri (auto-swap ke `Sheet` di bawah breakpoint `md`
 * lewat `SidebarProvider` — keputusan #5 T-105.1, menggantikan Sheet custom
 * ini). `MobileTopBar` jadi HANYA trigger (tombol hamburger, ikon +
 * aria-label tetap sama persis seperti sebelumnya supaya tidak ada regresi
 * visual/aksesibilitas) yang memanggil `toggleSidebar()` dari context
 * bersama `useSidebar()`, bukan lagi mengelola Sheet-nya sendiri — dan
 * `AppSideNav` kini hanya dirender SEKALI oleh `(app)/layout.tsx` (bukan dua
 * instance terpisah untuk desktop vs mobile Sheet).
 */
export function MobileTopBar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const isSettings = pathname.startsWith("/settings");
  const title = isSettings ? "Settings" : workspaceName;

  return (
    // T-098.4: file baru, dikomposisi Tailwind shadcn (ADR-097) sejak awal,
    // bukan migrasi Astryx.
    // eslint-disable-next-line no-restricted-syntax
    <div className="flex h-13 shrink-0 items-center gap-2 border-b border-border px-3 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Buka menu"
        onClick={toggleSidebar}
      >
        <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
      </Button>
      <span className="flex-1 truncate font-heading text-sm font-semibold">
        {title}
      </span>
    </div>
  );
}
