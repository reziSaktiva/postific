import { asUserId } from "@postific/shared";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { NotificationService } from "@/domains/notification";
import { PublishingService } from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { auth } from "@/lib/better-auth/auth";
import { notificationRepository } from "@/lib/repositories/notification";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { AppShell } from "./components/AppShell";
import { AppSideNav } from "./components/AppSideNav";
import { DraftEditorProvider } from "./components/draft-editor/Context";
import { DraftEditorMount } from "./components/draft-editor/Mount";
import { MobileTopBar } from "./components/MobileTopBar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  // T-105.3 follow-up (Ridwan review, KI-066) — preferensi collapse/expand
  // sidebar workspace dibaca dari cookie `sidebar_state` (nama & format
  // sama seperti yang ditulis `SidebarProvider` bawaan registry di
  // `components/ui/sidebar.tsx`, pola resmi shadcn `sidebar-07`) supaya
  // tidak reset ke expanded tiap full page reload. Diteruskan sebagai
  // `defaultOpen` ke `AppShell` (Client Component) untuk inisialisasi
  // `useState` render pertama — bukan dibaca ulang di client via
  // `document.cookie` supaya tidak ada flash expanded->collapsed.
  const sidebarStateCookie = (await cookies()).get("sidebar_state")?.value;
  const defaultSidebarOpen = sidebarStateCookie !== "false";

  const { workspaceId } = await getWorkspaceContext();

  // Composition root untuk cross-domain publishing -> workspace (T-012.2,
  // AGENTS.md #7) — satu-satunya tempat `PublishingService` konkret di-wire
  // ke `WorkspaceService` lewat `ScheduledCountsPort`.
  const workspaceService = new WorkspaceService(
    workspaceRepository,
    new PublishingService(publishingRepository),
  );
  // Bell notifikasi sidebar footer (T-036.4) — data awal via Server
  // Component (read), bukan Server Action (ADR-095, pola sama channels di
  // bawah). Realtime insert baru ditangani client-side oleh `NotificationBell`
  // (`useNotificationRealtime`, T-036.2).
  const notificationService = new NotificationService(notificationRepository);

  // 4 query di bawah hanya bergantung pada `workspaceId`/`session.user.id`
  // yang sudah diketahui (bukan hasil satu sama lain) — dijalankan paralel
  // lewat Promise.all, bukan sequential, supaya tidak menumpuk 4 round-trip
  // DB berurutan di render path yang blocking ini (Ridwan review, KI-066).
  const [workspace, channels, notifications, unreadCount] = await Promise.all([
    // Defensif: proxy.ts (ADR-076) seharusnya sudah menjamin workspace
    // context valid sebelum request mencapai sini, tapi tetap di-gate di
    // sini kalau diakses tanpa melalui proxy (mis. route belum ke-cover
    // matcher) — dicek setelah Promise.all resolve, bukan sebelum, supaya
    // tidak menghalangi 3 query lain berjalan paralel.
    workspaceService.getWorkspaceById(workspaceId),
    // Sidebar "Channels" — service mengembalikan SidebarChannelAccount[]
    // siap-render (T-012, ADR-058), termasuk scheduledCount real (T-012.2)
    // dan urutan personal tersimpan per user (T-012.1).
    workspaceService.listSidebarChannels(
      workspaceId,
      asUserId(session.user.id),
    ),
    notificationService.list(asUserId(session.user.id)),
    // Query `count` terpisah dari `list` (yang dibatasi 50 baris) supaya
    // badge unread di bell tidak under-count begitu user punya >50
    // notifikasi belum dibaca.
    notificationService.countUnread(asUserId(session.user.id)),
  ]);
  if (!workspace) {
    redirect("/onboarding");
  }

  // Provider + modal duduk di level workspace (bukan lagi di `publish/`)
  // supaya CTA "+ New Post" di sidebar bisa membuka Draft Editor dari section
  // manapun — ADR-053, T-011.2.
  //
  // T-096.3 (histori): pengganti `AppShell` Astryx (`variant="elevated"`),
  // awalnya layout custom Tailwind (BUKAN primitive `Sidebar` shadcn) karena
  // isi slot sideNav (`AppSideNav` -> `WorkspaceSideNav`/`SettingsSideNav`)
  // saat itu masih Astryx murni. Warna shell (`bg-background` di kolom
  // sideNav, `bg-sidebar` di kartu konten membulat) tetap sama sejak saat
  // itu — lihat design-tokens.md § Engineering Mapping T-095.5.
  //
  // T-105.3 (KI-066, ADR-097): sidebar workspace/settings sekarang benar-benar
  // dikomposisi dari primitive `Sidebar` shadcn (gap di atas ditutup) —
  // `SidebarProvider` dipasang lewat wrapper client `AppShell` (butuh
  // `usePathname()` untuk memaksa sidebar tetap expanded di route
  // `/settings`, lihat komentar di `components/AppShell.tsx`), menggantikan
  // `<div className="flex h-dvh flex-col">` + `<aside className="hidden
  // md:flex">` manual. `<Sidebar>` (dirender di dalam `AppSideNav`) mengurus
  // posisi fixed + lebar sendiri, jadi tidak perlu lagi wrapper `<aside>`
  // eksplisit di sini. Drawer mobile (dulu T-098.4, Sheet custom di
  // `MobileTopBar` yang merender ulang `AppSideNav`) sekarang ditangani
  // `SidebarProvider` sendiri (auto-swap ke Sheet di bawah breakpoint `md`,
  // keputusan #5 T-105.1) — `MobileTopBar` cuma trigger + judul, `AppSideNav`
  // hanya dirender SEKALI. Breakpoint `md` (768px) tetap mengikuti rancangan
  // Claude Design (foundations/layout.html § "Shell — Mobile").
  //
  // T-105.3 follow-up (Ridwan review, KI-066): `defaultSidebarOpen` di atas
  // (dibaca dari cookie `sidebar_state` yang sudah ditulis `SidebarProvider`
  // bawaan registry tiap kali di-toggle, tapi sebelumnya tidak pernah dibaca
  // ulang) diteruskan ke `AppShell` supaya preferensi collapse/expand
  // persisten lintas full page reload — bukan reset ke expanded tiap mount.
  return (
    <DraftEditorProvider workspaceId={workspaceId}>
      <AppShell
        className="h-dvh bg-background text-foreground"
        defaultOpen={defaultSidebarOpen}
      >
        <AppSideNav
          workspaceName={workspace.name}
          userName={session.user.name}
          userEmail={session.user.email}
          channels={channels}
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
          userId={session.user.id}
        />
        {/* eslint-disable-next-line no-restricted-syntax -- T-105.3: file ini
            sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097 poin 4),
            bukan lagi AppShell Astryx — <div> layout langsung, bukan
            VStack/HStack. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MobileTopBar workspaceName={workspace.name} />
          {/* KI-066 follow-up (mismatch #4): Claude Design `.main` pakai
              `--color-background-body` (token BODY), bukan token SIDEBAR —
              `bg-background` di globals.css sudah match hex-nya persis.
              Deviasi sadar dari riwayat ADR-084 (swap warna, era Astryx,
              di-revert ADR-086) — kedua ADR itu memakai token/selector
              Astryx yang sudah tidak ada lagi pasca migrasi shadcn (T-102);
              ini instruksi terbaru King Rezi + Claude Design SYNCED saat
              ini, bukan regresi. */}
          <main className="relative min-w-0 flex-1 overflow-y-auto rounded-tl-3xl bg-background p-4">
            {children}
          </main>
        </div>
      </AppShell>
      <DraftEditorMount />
    </DraftEditorProvider>
  );
}
