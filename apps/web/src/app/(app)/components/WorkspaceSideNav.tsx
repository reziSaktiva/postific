"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  Calendar03Icon,
  Home01Icon,
  LinkSquare01Icon,
  Message01Icon,
  Moon02Icon,
  PlusSignIcon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useCloseMobileSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils/get-initials";

import type { NotificationRecord } from "@/domains/notification";
import type { SidebarChannelAccount } from "@/domains/workspace";
import { authClient } from "@/lib/better-auth/client";

import { useThemeMode } from "@/components/Providers";

import { useDraftEditor } from "./draft-editor/Context";
import { NotificationBell } from "./notification-panel/NotificationBell";
import { ChannelsSection } from "./sidebar-channels/ChannelsSection";

// T-105.3 (KI-066): ikon `hugeicons` asli menggantikan placeholder SVG
// hand-built di mockup Claude Design (`components/navigation.html`, dicatat
// di T-105.0 sebagai gap yang perlu diverifikasi/diganti saat implementasi
// kode). Dipilih berdasarkan makna tiap section, bukan tebakan sembarang —
// dicek dulu lewat daftar icon `@hugeicons/core-free-icons` yang benar-benar
// ter-install:
// - Home: rumah sederhana.
// - Publish: kalender (jadwal konten — publish/queue/drafts/history semua
//   berbasis tanggal).
// - Engage: gelembung pesan (inbox komentar/DM).
// - Analyze: grafik analitik.
// - Start Page: ikon link (Start Page = halaman link-in-bio, domains/start-page).
const NAV_ITEMS = [
  { label: "Home", path: "/", icon: Home01Icon },
  { label: "Publish", path: "/publish", icon: Calendar03Icon },
  { label: "Engage", path: "/engage", icon: Message01Icon },
  { label: "Analyze", path: "/analyze", icon: Analytics01Icon },
  { label: "Start Page", path: "/start-page", icon: LinkSquare01Icon },
] as const;

export function WorkspaceSideNav({
  workspaceName,
  userName,
  userEmail,
  // Data untuk section "Channels" (T-012, ADR-058) — dirender via
  // ChannelsSection di bawah, antara nav items dan footer.
  channels,
  // T-036.4 — bell notifikasi self-contained (state + panel) di footer.
  initialNotifications,
  initialUnreadCount,
  userId,
}: {
  workspaceName: string;
  userName: string;
  userEmail: string;
  channels: SidebarChannelAccount[];
  initialNotifications: NotificationRecord[];
  initialUnreadCount: number;
  userId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggleMode } = useThemeMode();
  const { openNewPost } = useDraftEditor();
  // T-105.3: dulu di-terima sebagai prop `onNavigate` dari `MobileTopBar`
  // (yang merender Sheet + `AppSideNav` sendiri, T-098.4). Sejak migrasi ke
  // primitive `Sidebar` shadcn, drawer mobile ditangani `SidebarProvider`
  // sendiri (`isMobile`/`openMobile`/`setOpenMobile` dari context bersama,
  // decision #5 T-105.1) — `WorkspaceSideNav` sekarang HANYA dirender sekali
  // (bukan lagi dua instance terpisah untuk desktop vs mobile Sheet), jadi
  // "tutup drawer setelah klik nav" dipanggil langsung dari sini.
  const closeMobileSidebar = useCloseMobileSidebar();

  // T-016.5 / ADR-049 (NP-D10): Logout adalah Tier 2 Safety Check — wajib
  // dialog konfirmasi sebelum eksekusi, karena berpotensi menginterupsi
  // pekerjaan yang belum tersimpan meski aksinya sendiri reversibel.
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const themeToggleLabel =
    mode === "light" ? "Ganti ke Dark Mode" : "Ganti ke Light Mode";

  return (
    // Keputusan #1 (T-105.0/T-105.1, dikunci King Rezi): mode collapse =
    // icon-only rail (bukan offcanvas/sembunyi total).
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* `group-data-[collapsible=icon]:flex-col`: pada rail 48px, avatar
            workspace + trigger tidak muat berdampingan (masing-masing
            ~32px dalam ruang konten ~32px setelah padding header) — ditumpuk
            vertikal saat collapsed supaya keduanya tetap terlihat/berfungsi,
            bukan saling menimpa. Ditemukan lewat verifikasi visual nyata
            (bukan diasumsikan), lihat laporan T-105.3. */}
        {/* eslint-disable-next-line no-restricted-syntax -- T-098.1: file ini
            sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
            VStack/HStack Astryx. */}
        <div className="flex items-center justify-between gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <Link
            href="/"
            onClick={closeMobileSidebar}
            className="flex min-w-0 items-center gap-2 px-1 font-heading text-sm font-semibold"
          >
            {/* Deviasi disengaja dari `Avatar` default (`rounded-full`):
                Claude Design (`styles.css` § `.ws-avatar`) mengunci workspace
                switcher sebagai kotak `border-radius: var(--radius-inner)`
                (6px = `--radius-sm` di globals.css, match persis) — BUKAN
                lingkaran. Avatar lain (channel row, footer account) TETAP
                `rounded-full` sesuai `.channel-avatar`/`.avatar-round` di
                Claude Design, jadi override di sini saja (call-site), bukan
                di `avatar.tsx` default. `rounded-sm` di sini resolve ke 6px
                (`calc(var(--radius)*0.6)`, lihat globals.css), match persis
                nilai yang dikunci Claude Design. */}
            <Avatar size="sm" className="rounded-sm after:rounded-sm">
              <AvatarFallback className="rounded-sm">
                {getInitials(workspaceName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate group-data-[collapsible=icon]:hidden">
              {workspaceName}
            </span>
          </Link>
          {/* Keputusan #2 (T-105.0/T-105.1, dikunci King Rezi): trigger
              (replica `SidebarTrigger`) ditaruh di header sidebar dekat
              workspace switcher — BUKAN membuat header baru di main content
              (deviasi disengaja dari pola resmi shadcn `SidebarInset >
              header`). Tidak dirender `SidebarRail` (strip toggle tambahan
              di tepi sidebar) supaya tidak ada affordance toggle kedua yang
              belum dikunci King Rezi.
              KI-084: SEKARANG tetap ditampilkan di mobile juga (dulu `hidden
              md:flex`) — ini SATU-SATUNYA tombol close drawer mobile,
              menggantikan close button absolut terpisah yang sebelumnya
              menabrak tombol "New Post" di bawahnya. `toggleSidebar()` yang
              sama persis dipakai untuk buka (desktop) & tutup (mobile, lewat
              `setOpenMobile` toggle di `useSidebar`), jadi icon dan posisi
              taat konsisten tanpa kode tambahan. `aria-label` di-override
              (default `SidebarTrigger` di `sidebar.tsx` adalah "Toggle
              Sidebar", bahasa Inggris dan tidak menyebut status buka/tutup)
              supaya konsisten dengan label Indonesia tombol close
              `SettingsSideNav` ("Tutup menu") dan elemen sidebar lain
              ("Buka menu", "Notifikasi"). */}
          <SidebarTrigger className="shrink-0" aria-label="Buka/tutup menu" />
        </div>

        {/* ADR-053: CTA pinned di bawah Workspace Selector, di atas nav items. */}
        <Button
          className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          // openNewPost sekarang menerima preSelectedAccountId opsional
          // (T-012, ADR-058 addendum poin 9) — wrap supaya event onClick
          // tidak ikut tersalur sebagai argumen pertama.
          onClick={() => {
            closeMobileSidebar();
            openNewPost();
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          <span className="group-data-[collapsible=icon]:hidden">New Post</span>
        </Button>
      </SidebarHeader>

      {/* T-012 / ADR-058: `justify-between` mereplikasi `.nav{flex:1}` di
          Claude Design yang menghabiskan sisa ruang vertikal sebelum
          `.channels` — Channels selalu menempel tepat di atas footer. */}
      <SidebarContent className="justify-between">
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const isSelected =
                item.path === "/"
                  ? pathname === item.path
                  : pathname.startsWith(item.path);
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={isSelected}
                    tooltip={item.label}
                  >
                    <Link
                      href={item.path}
                      onClick={closeMobileSidebar}
                      aria-current={isSelected ? "page" : undefined}
                    >
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Keputusan #3 (T-105.0/T-105.1, dikunci King Rezi): section
            "Channels" disembunyikan TOTAL saat collapsed (pola sama
            `group-data-[collapsible=icon]:hidden` di contoh resmi shadcn
            `NavProjects`), bukan varian compact. `channels.length` dicek di
            luar `ChannelsSection` (bukan di dalamnya) supaya wrapper
            `SidebarGroup` (padding) tidak ikut dirender kosong saat tidak
            ada channel — `ChannelsSection` sendiri masih return `null` kalau
            dipanggil langsung dengan array kosong (perilaku lama, tidak
            diubah). */}
        {channels.length > 0 ? (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <ChannelsSection channels={channels} />
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      {/* KI-020: Design System mengelompokkan Theme+Avatar jadi satu klaster
          di kanan (Notifikasi terpisah di kiri), bukan spread rata 3 elemen.
          `group-data-[collapsible=icon]:flex-col` — 3 tombol icon tidak
          cukup lebar berdampingan di rail 48px, jadi ditumpuk vertikal saat
          collapsed (detail layout, bukan pola yang perlu dikunci terpisah). */}
      <SidebarFooter>
        {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 group-data-[collapsible=icon]:flex-col">
          <NotificationBell
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
            userId={userId}
          />
          {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={themeToggleLabel}
                  onClick={toggleMode}
                >
                  <HugeiconsIcon
                    icon={mode === "light" ? Moon02Icon : Sun03Icon}
                    strokeWidth={2}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{themeToggleLabel}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={userName || userEmail}
                >
                  <Avatar size="sm">
                    <AvatarFallback>
                      {getInitials(userName || userEmail)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    closeMobileSidebar();
                    router.push("/settings/account");
                  }}
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setIsLogoutDialogOpen(true)}
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarFooter>

      <AlertDialog
        open={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout dari akun ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Perubahan yang belum disimpan di halaman ini bisa hilang
              (ADR-049/NP-D10).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Batal</AlertDialogCancel>
            {/* Button biasa (bukan `AlertDialogAction`) — Radix `Action` selalu
                menutup dialog begitu diklik, sementara logout ini async dan
                dialog HARUS tetap terbuka kalau `handleLogout` gagal (supaya
                user bisa coba lagi/Batal). `open`/`onOpenChange` di atas sudah
                controlled, jadi cukup `setIsLogoutDialogOpen(false)` manual
                cuma di jalur sukses. */}
            <Button
              variant="destructive"
              disabled={isLoggingOut}
              onClick={async () => {
                try {
                  await handleLogout();
                  setIsLogoutDialogOpen(false);
                } catch {
                  // Dialog tetap terbuka supaya user bisa coba lagi atau Batal;
                  // isLoggingOut sudah direset di handleLogout's finally.
                }
              }}
            >
              {isLoggingOut ? <Spinner /> : null}
              Logout
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
