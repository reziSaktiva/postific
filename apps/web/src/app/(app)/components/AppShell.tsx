"use client";

import { useState } from "react";

import { usePathname } from "next/navigation";

import { SidebarProvider } from "@/components/ui/sidebar";

/**
 * T-105.3 (KI-066, ADR-097) — wrapper `"use client"` tunggal untuk primitive
 * `SidebarProvider` shadcn, dipisah dari `(app)/layout.tsx` (Server
 * Component) semata-mata karena butuh `usePathname()`.
 *
 * `open` dikontrol eksplisit (bukan uncontrolled default `SidebarProvider`)
 * supaya sidebar SELALU expanded saat route `/settings` — keputusan #4
 * (T-105.1): `SettingsSideNav` sengaja dikecualikan dari fitur
 * collapse/expand, tetap fixed-width, tidak dapat trigger. `Sidebar` primitive
 * di `SettingsSideNav` tetap dipasang `collapsible="icon"` (bukan "none")
 * supaya mobile Sheet bawaan (keputusan #5, tidak opsional) tetap berfungsi
 * di route ini juga — `collapsible="none"` pada primitive melewati logic
 * `isMobile` sepenuhnya (lihat `components/ui/sidebar.tsx`), jadi tidak
 * kompatibel dengan keputusan #5. Kombinasinya: `open` dipaksa `true` di sini
 * begitu `isSettings`, sebelum render pertama (bukan `useEffect` di child,
 * supaya tidak ada flash collapsed-lalu-dipaksa-expand) — preferensi
 * collapse/expand terakhir user di workspace routes disimpan di state lokal
 * `open` dan tidak ikut ditimpa selama di `/settings`, cuma diabaikan
 * sementara.
 *
 * T-105.3 follow-up (Ridwan review, KI-066): `defaultOpen` diterima dari
 * `(app)/layout.tsx` (Server Component, dibaca dari cookie `sidebar_state` —
 * cookie yang sama yang sudah ditulis `SidebarProvider` bawaan registry
 * tiap kali di-toggle lewat `setOpen`, tapi sebelumnya tidak pernah dibaca
 * ulang untuk inisialisasi) supaya preferensi collapse/expand persisten
 * lintas full page reload, bukan selalu mulai dari expanded. State lokal
 * `open` di bawah HANYA `useState(true)` hardcoded sebelumnya — sekarang
 * `useState(defaultOpen)`, render pertama sudah sesuai preferensi tersimpan
 * (tidak ada flash expanded->collapsed).
 */
export function AppShell({
  children,
  className,
  defaultOpen = true,
}: {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const pathname = usePathname();
  const isSettings = pathname.startsWith("/settings");
  const [open, setOpen] = useState(defaultOpen);

  return (
    <SidebarProvider
      open={isSettings ? true : open}
      // T-105.3 follow-up (KI-066): `isSettings` cuma memaksa nilai *visual*
      // `open`, tapi `SidebarProvider`'s keyboard shortcut (Cmd/Ctrl+B) tetap
      // aktif tanpa peduli route dan membaca `open` yang sedang dipaksa true
      // itu untuk toggle — kalau `onOpenChange` tetap diteruskan apa adanya,
      // menekan shortcut di /settings diam-diam menimpa preferensi
      // collapse/expand tersimpan user di workspace routes. Diabaikan
      // sepenuhnya selama `isSettings` supaya state lokal tidak ikut korup.
      onOpenChange={(value) => {
        if (isSettings) return;
        setOpen(value);
      }}
      className={className}
    >
      {children}
    </SidebarProvider>
  );
}
