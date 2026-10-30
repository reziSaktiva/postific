"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, SidebarLeftIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useCloseMobileSidebar,
} from "@/components/ui/sidebar";

// Sidebar Settings tunggal, pola Buffer (ADR-077, T-039.5) — dirender lewat
// slot sideNav di (app)/layout.tsx oleh AppSideNav (../../components/AppSideNav.tsx)
// saat pathname di bawah /settings, MENGGANTIKAN TOTAL WorkspaceSideNav
// (bukan sidebar kedua yang berdampingan seperti pola lama ADR-076/
// T-039.1-3). Header back-navigation (ikon back + label "Settings", link ke
// "/") — pure link, bukan submit/reload.
//
// Direstrukturisasi jadi 2 grup berlabel (Organization/Account) sesuai IA
// (information-architecture.md) — dulu satu List flat tanpa grouping saat
// Account masih route top-level terpisah (/account/*).
const NAV_GROUPS = [
  {
    title: "Organization",
    items: [
      { label: "General", href: "/settings", exact: true },
      {
        label: "Connected Accounts",
        href: "/settings/connected-accounts",
        exact: false,
      },
      { label: "Members", href: "/settings/members", exact: false },
      { label: "Roles & Permissions", href: "/settings/roles", exact: false },
      { label: "Billing", href: "/settings/billing", exact: false },
    ],
  },
  {
    title: "Account",
    items: [
      {
        label: "Workspaces",
        href: "/settings/account/workspaces",
        exact: false,
      },
      { label: "Profile", href: "/settings/account", exact: true },
      {
        label: "Notifications",
        href: "/settings/account/notifications",
        exact: false,
      },
      {
        label: "Preferences",
        href: "/settings/account/preferences",
        exact: false,
      },
      {
        label: "Klien AI",
        href: "/settings/account/ai-clients",
        exact: false,
      },
    ],
  },
] as const;

export function SettingsSideNav() {
  const pathname = usePathname();
  // T-105.3 (KI-066): drawer mobile ditangani `SidebarProvider` (decision #5
  // T-105.1) — tutup drawer setelah klik nav item, sama seperti
  // `WorkspaceSideNav`. Tidak perlu prop `onNavigate` lagi (dulu diteruskan
  // dari `MobileTopBar` yang merender Sheet-nya sendiri, T-098.4).
  const closeMobileSidebar = useCloseMobileSidebar();

  return (
    // Keputusan #4 (T-105.0/T-105.1, dikunci King Rezi): SettingsSideNav
    // SENGAJA DIKECUALIKAN dari fitur collapse/expand — tetap fixed-width,
    // tidak dapat trigger. `collapsible="icon"` tetap dipasang di sini
    // (bukan "none") supaya perilaku mobile Sheet bawaan (keputusan #5)
    // tetap berfungsi di route ini — pemaksaan "selalu expanded" di desktop
    // dilakukan di `AppShell.tsx` (mengontrol `open` SidebarProvider secara
    // eksplisit saat pathname `/settings`), BUKAN di sini, supaya tidak ada
    // flash collapsed-lalu-dipaksa-expand. Tidak ada `SidebarTrigger` yang
    // dirender di header di bawah — konsisten dengan "tidak dapat trigger".
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* eslint-disable-next-line no-restricted-syntax -- file ini sudah
            dimigrasi ke komposisi Tailwind shadcn (ADR-097). */}
        <div className="flex items-center justify-between gap-1">
          {/* KI-024: spec Claude Design (`.settings-sidebar-header`,
              styles.css baris ~316-319) memisahkan back-button (kotak ikon
              28px, klik-able SENDIRI) dari judul "Settings" (teks statis,
              font `--text-body-size`) — dulu digabung jadi satu `<Link>`
              utuh (pola `SideNavHeading` lama, font `--text-large-size`).
              Dipecah jadi 2 elemen: `Button asChild` 28px (`size-7`,
              override `icon-xs`) untuk navigasi balik, dan `<span>` statis
              non-klik-able untuk judul (tetap `text-sm`, setara
              `--text-body-size` — sudah lebih kecil dari default `text-base`
              yang merepresentasikan `--text-large-size`). */}
          {/* eslint-disable-next-line no-restricted-syntax -- file ini sudah
              dimigrasi ke komposisi Tailwind shadcn (ADR-097). */}
          <div className="flex min-w-0 items-center gap-2 px-1">
            <Button
              asChild
              variant="ghost"
              size="icon-xs"
              className="size-7 shrink-0"
              aria-label="Kembali ke Home"
            >
              <Link href="/" onClick={closeMobileSidebar}>
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  className="size-4"
                />
              </Link>
            </Button>
            <span className="truncate font-heading text-sm font-semibold">
              Settings
            </span>
          </div>

          {/* KI-084: Settings sidebar sengaja TANPA `SidebarTrigger` di
              desktop (Keputusan #4 T-105.0/T-105.1 — fixed-width, tidak bisa
              collapse). Di mobile tetap butuh affordance tutup drawer —
              icon sama (`SidebarLeftIcon`) dengan trigger buka & trigger
              Workspace sidebar, ditaruh di header row (bukan absolute)
              supaya tidak menabrak konten di bawahnya. */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 md:hidden"
            aria-label="Tutup menu"
            onClick={closeMobileSidebar}
          >
            <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isSelected = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={isSelected}>
                      <Link
                        href={item.href}
                        onClick={closeMobileSidebar}
                        aria-current={isSelected ? "page" : undefined}
                      >
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
