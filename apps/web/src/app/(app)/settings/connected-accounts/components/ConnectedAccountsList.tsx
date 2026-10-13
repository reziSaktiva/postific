"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon } from "@hugeicons/core-free-icons";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/text";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";

import { SocialPlatform } from "@postific/shared";

import {
  getConnectionStatusLabel,
  resolveConnectionDisplayStatus,
  type ConnectedAccountRecord,
  type ConnectionDisplayStatus,
  type ConnectResult,
} from "@/domains/workspace";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";
import { formatConnectedDate } from "@/lib/utils/format-date";
import { cn, getInitials } from "@/lib/utils";

import { PLATFORM_ICON } from "../../../components/platform-icons";
import {
  SETTINGS_BREADCRUMB_GROUP,
  SettingsPageHead,
} from "../../components/SettingsPageHead";
import {
  disconnectAccountAction,
  initiateReconnectAccountAction,
  syncNowAction,
} from "../actions";
import { ConnectPlatformMenu } from "./ConnectPlatformMenu";
import { FacebookPagesPickerDialog } from "./FacebookPagesPickerDialog";

// KI-041 (Stone theme shadcn belum punya token --success/--warning, dicatat
// saat T-097.3): `Badge` shadcn cuma varian default/secondary/destructive/
// outline/ghost/link. "disconnected" (dulu "error") tetap punya padanan
// asli ("destructive"). "reconnect-required" (dulu "warning", tanpa token)
// dipetakan ke "outline" supaya beda dari "active" ("secondary") tanpa
// mengarang warna baru — perluasan gap yang sama, dilaporkan ke King Rezi,
// bukan keputusan final.
const STATUS_BADGE_VARIANT: Record<
  ConnectionDisplayStatus,
  "secondary" | "outline" | "destructive"
> = {
  active: "secondary",
  "reconnect-required": "outline",
  disconnected: "destructive",
};

/**
 * Badge ikon brand kecil di pojok Avatar. Sebelumnya (Astryx) dikomposisi
 * dari `HStack` + nilai bayangan arbitrary (Tailwind arbitrary-value box
 * shadow) untuk meniru border tipis; shadcn `Avatar` (`group/avatar
 * relative ...`) sudah `position: relative` bawaan, jadi span absolute ini
 * bisa jadi child langsung `Avatar` tanpa wrapper tambahan, dan border-nya
 * cukup utility asli `ring-1 ring-border` — tidak perlu lagi arbitrary
 * shadow value seperti sebelumnya.
 */
function PlatformStatusDot({
  platform,
}: {
  platform: ConnectedAccountRecord["platform"];
}) {
  const entry = PLATFORM_ICON[platform];
  if (!entry) {
    return null;
  }
  const PlatformGlyph = entry.Icon;
  return (
    <span
      aria-hidden
      className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-border"
    >
      {/* Warna brand asli (bukan token) — sama seperti PlatformBadge di
          sidebar-channels/ChannelsSection.tsx (ADR-058 poin 6 & 10). */}
      <PlatformGlyph size={9} color={entry.color} />
    </span>
  );
}

/**
 * Tombol "Reconnect" (T-015.3, ADR-105) — memicu
 * `initiateReconnectAccountAction` (Server Action → `WorkspaceService.
 * initiateConnectAccount` dengan `redirectAccountId` terisi →
 * `OutstandAdapter.connectAccount`, Fake loopback). Bukan aksi destruktif
 * (tidak menghapus apa pun, sebaliknya MEMULIHKAN koneksi), jadi klik
 * langsung memicu aksi tanpa dialog konfirmasi Tier 2 — beda dari
 * Disconnect. Sukses: Server Action `redirect()` ke `redirectUrl` OAuth,
 * komponen ini unmount. Gagal: `toast.error` (pola sama
 * `RetryTargetButton`).
 */
function ReconnectButton({ account }: { account: ConnectedAccountRecord }) {
  const [isPending, startTransition] = useTransition();

  function handleReconnect() {
    startTransition(async () => {
      const result = await initiateReconnectAccountAction(
        account.id,
        account.platform,
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      // Facebook (Bug #2, T-025.4/KI-070) — lihat docstring
      // `initiateReconnectAccountAction` (`../actions.ts`). Hard navigation
      // penuh, bukan client-side App Router transition.
      if (result?.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={handleReconnect}
    >
      Reconnect
    </Button>
  );
}

/**
 * Tombol "Sync Now" (T-090.5, ADR-093 poin 9) — memicu `syncNowAction`
 * (Server Action → `ImportPostsTriggerUseCase.triggerManual`). LOCKED
 * PATTERN (`templates/settings-connected-accounts.html`, Claude Design,
 * 2026-10-08, King Rezi confirmed):
 * 1. Posisi: SEBELUM Badge status, grup kanan yang sama dengan
 *    Disconnect/Reconnect (lihat `ConnectedAccountRow`).
 * 2. Hanya untuk akun `active` — tidak ada yang bisa disinkron kalau belum
 *    terkoneksi (`reconnect-required`/`disconnected` pakai "Reconnect").
 * 3. Variant: bobot visual rendah/rutin, BUKAN destructive/primary — dipilih
 *    `secondary` (sama seperti `ReconnectButton` di file ini), bukan
 *    `destructive` literal seperti tombol Disconnect di kode — mockup
 *    menyamakan "bobot visual dengan Disconnect" memakai `.btn` polos
 *    (netral) di markup prototipe-nya sendiri, sedangkan `Disconnect` di
 *    kode nyata sudah lebih dulu memakai `variant="destructive"` (keputusan
 *    established, bukan bagian task ini) — `secondary` paling dekat dengan
 *    intent "rendah urgensi, bukan primary" tanpa menabrak semantik warna
 *    destructive yang sudah dipakai Disconnect.
 * 4. Tiga state: Default, Loading (ikon refresh `animate-spin` + label
 *    "Syncing…", disabled — pola sama persis `EngageInboxView.tsx` tombol
 *    "Refresh"), dan Ditolak (cooldown/cap/RBAC) — pesan via `toast.error`
 *    (mekanisme toast yang sudah ada, BUKAN komponen inline baru); tombol
 *    kembali ke Default setelah toast (tidak tetap disabled).
 * 5. RBAC: disembunyikan total untuk role tanpa akses kelola (Creator) —
 *    sudah ditangani di level `ConnectedAccountAction` (`canManage` early
 *    return), jadi komponen ini sendiri tidak perlu cek ulang.
 */
function SyncNowButton({ account }: { account: ConnectedAccountRecord }) {
  const [isPending, startTransition] = useTransition();

  function handleSyncNow() {
    startTransition(async () => {
      const result = await syncNowAction(account.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const importedCount = result.importedCount ?? 0;
      toast(
        importedCount > 0
          ? `${importedCount} post baru diimpor.`
          : "Sinkron selesai — tidak ada post baru.",
      );
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={handleSyncNow}
      aria-label={`Sync Now — tarik ulang post dari ${PLATFORM_ICON[account.platform]?.label ?? account.platform}`}
    >
      <HugeiconsIcon
        icon={Refresh01Icon}
        strokeWidth={2}
        className={cn(isPending && "animate-spin")}
      />
      {isPending ? "Syncing…" : "Sync Now"}
    </Button>
  );
}

/**
 * Tombol aksi per baris ditentukan dari `displayStatus` penuh (3 state),
 * bukan cuma boolean `reconnectRequired`.
 *
 * T-014.3: "Disconnect" (state `active`) — membuka dialog konfirmasi Tier 2
 * (ADR-049) lewat `onRequestDisconnect`, pola persis `QueueScreen.tsx`
 * (Cancel Schedule) / `MembersTable.tsx` (Remove member).
 * T-015.3: "Reconnect" (state `reconnect-required`) — lihat `ReconnectButton`
 * di atas.
 * **KI-078 (2026-09-26):** `disconnected` (disconnect eksplisit oleh user,
 * beda dari `reconnect-required`/token kadaluarsa) SEBELUMNYA sengaja
 * dirender tanpa aksi apa pun — membuat disconnect jadi FINAL/permanen,
 * tidak sesuai ekspektasi umum (Claude Design `templates/settings-connected-
 * accounts.html`, baris "X (Twitter)": chip disconnected berpasangan dengan
 * tombol "Reconnect", pola yang sama persis dipakai di sini). Digabung ke
 * cabang yang sama dengan `reconnect-required` — `ReconnectButton` sudah
 * memanggil `initiateReconnectAccountAction` dengan `redirectAccountId`
 * terisi apa pun status akunnya, yang di `WorkspaceService.
 * completeAccountConnection` diarahkan ke `IWorkspaceRepository.
 * reconnectAccount` (UPDATE baris existing) — BUKAN `createConnectedAccount`
 * (INSERT), sehingga tidak lagi menabrak unique constraint
 * `[workspaceId, outstandAccountId]` dari baris `disconnected` yang lama.
 */
function ConnectedAccountAction({
  account,
  displayStatus,
  canManage,
  onRequestDisconnect,
}: {
  account: ConnectedAccountRecord;
  displayStatus: ConnectionDisplayStatus;
  canManage: boolean;
  onRequestDisconnect: () => void;
}) {
  // T-109 (KI-058): Creator "Baca saja" (roles-permissions.md § Connected
  // Accounts) — tombol disembunyikan total, sama seperti pola Danger Zone
  // di `WorkspaceGeneralSettings.tsx` (`{isOwner ? <Card>...</Card> : null}`),
  // bukan cuma disabled. RBAC server (`assertActorCanManageConnectedAccounts`)
  // tidak berubah — ini murni kontrol render UI.
  if (!canManage) {
    return null;
  }
  switch (displayStatus) {
    case "reconnect-required":
    case "disconnected":
      // Facebook Pages reconnect multi-page belum punya UPDATE path —
      // sembunyikan tombol supaya tidak silent 0-page "sukses" toast.
      if (account.platform === SocialPlatform.Facebook) {
        return null;
      }
      return <ReconnectButton account={account} />;
    case "active":
      return (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onRequestDisconnect}
        >
          Disconnect
        </Button>
      );
  }
}

/**
 * KI-055 (poin 5, mengikuti pola final poin 1 & 3 — Drafts/Workspaces):
 * `Card`+`Item`/`ItemGroup` diganti `Table` shadcn tanpa header kolom,
 * dibungkus `<div>` border+rounded manual (bukan `Card`). Baris di sini
 * TIDAK diklik penuh (beda dari Drafts/Workspaces) — badge status dan
 * tombol aksi (Disconnect/Reconnect) tetap elemen interaktif tersendiri
 * di dalam baris, bukan trigger navigasi baris.
 */
function ConnectedAccountRow({
  account,
  canManage,
  onRequestDisconnect,
}: {
  account: ConnectedAccountRecord;
  canManage: boolean;
  onRequestDisconnect: (account: ConnectedAccountRecord) => void;
}) {
  const displayStatus = resolveConnectionDisplayStatus(account);
  const entry = PLATFORM_ICON[account.platform];
  const platformLabel = entry?.label ?? account.platform;

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        {/* eslint-disable-next-line no-restricted-syntax -- T-099.3: file ini sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097) */}
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage
              src={account.avatarUrl ?? undefined}
              alt={account.handle}
            />
            <AvatarFallback>{getInitials(account.handle)}</AvatarFallback>
            <PlatformStatusDot platform={account.platform} />
          </Avatar>
          {/* eslint-disable-next-line no-restricted-syntax -- T-099.3, sama seperti di atas */}
          <div className="flex flex-col">
            <Text variant="small">{account.handle}</Text>
            <Text variant="muted">
              {platformLabel} · Terhubung sejak{" "}
              {formatConnectedDate(account.connectedAt)}
            </Text>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {/* eslint-disable-next-line no-restricted-syntax -- T-099.3, sama seperti di atas */}
        <div className="flex items-center justify-end gap-2">
          {canManage && displayStatus === "active" ? (
            <SyncNowButton account={account} />
          ) : null}
          <Badge variant={STATUS_BADGE_VARIANT[displayStatus]}>
            {getConnectionStatusLabel(account)}
          </Badge>
          <ConnectedAccountAction
            account={account}
            displayStatus={displayStatus}
            canManage={canManage}
            onRequestDisconnect={() => onRequestDisconnect(account)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * `ConnectedAccountsList` (T-099.3, migrasi shadcn/ui; KI-055 poin 5,
 * 2026-09-10: `Card`+`Item`/`ItemGroup` diganti `Table` tanpa header
 * kolom — lihat docstring `ConnectedAccountRow` di atas).
 */
export function ConnectedAccountsList({
  accounts,
  canManageConnections,
  connectResult = null,
  facebookPagesPicker = null,
}: {
  accounts: ConnectedAccountRecord[];
  /**
   * T-109 (KI-058) — dihitung `page.tsx` lewat `WorkspaceService.
   * canManageConnectedAccounts` (Owner/Admin aktif → true, Creator →
   * false). Halaman ini sendiri TETAP diakses Creator (read-only, matrix
   * `roles-permissions.md` § Connected Accounts) — beda dari Members/
   * Organization Settings yang redirect seluruh halaman untuk role yang
   * tidak berhak. Dipakai untuk menyembunyikan tombol "Connect Account"
   * (header) dan "Disconnect"/"Reconnect" (tiap baris) untuk Creator, pola
   * sama dengan `isOwner` di `WorkspaceGeneralSettings.tsx`.
   */
  canManageConnections: boolean;
  /**
   * Hasil Connect/Reconnect Account (T-013.1/T-013.2, T-015.3, ADR-105) —
   * diteruskan dari `page.tsx` (dibaca dari `?connect=` yang diset Route
   * Handler callback). Ditampilkan sekali sebagai toast saat mount, lalu
   * query param dibersihkan dari URL (`router.replace`, tanpa menumpuk
   * history) supaya refresh halaman tidak menampilkan toast yang sama
   * berulang.
   */
  connectResult?: ConnectResult | null;
  /**
   * Facebook Pages flow (T-025.4, KI-070, ADR-115 §7/§10; review fix) —
   * diteruskan dari `page.tsx` (`?connectFacebook=1` +
   * `?connectFacebookState=`). Session token ada di cookie httpOnly
   * (dibaca Server Action), bukan di props. Kalau ada saat mount, dialog
   * otomatis terbuka — state dibekukan lokal supaya query flag bisa
   * di-strip dari address bar tanpa menutup dialog.
   */
  facebookPagesPicker?: { state: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!connectResult) return;
    if (connectResult === "success") {
      toast("Akun berhasil terhubung");
    } else if (connectResult === "already-connected") {
      // KI-079 — dibedakan dari "error" generik: ini BUKAN kegagalan
      // transient yang bisa diperbaiki dengan retry, jadi tidak memakai
      // copy "Coba lagi" yang menyesatkan.
      //
      // Copy TIDAK menyebut tombol "Reconnect" (code review PR #139) — kasus
      // paling umum untuk toast ini adalah Connect ke akun yang statusnya
      // sudah `active`, dan baris `active` cuma punya tombol "Disconnect"
      // (lihat `ConnectedAccountAction`), jadi menunjuk ke "Reconnect" di
      // situ menunjuk ke kontrol yang tidak ada di baris itu.
      toast.error("Akun ini sudah terhubung di workspace ini.");
    } else {
      toast.error("Gagal menghubungkan akun. Coba lagi.");
    }
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya perlu re-run saat `connectResult` (query param) berubah, bukan tiap render `router`/`pathname` (referensi baru tiap render Next.js).
  }, [connectResult]);

  // Code-review PR #140 finding #4 (T-109/KI-058) — sebelumnya state ini
  // diisi dari `facebookPagesPicker` tanpa syarat, jadi Creator yang
  // mendarat di halaman ini dengan query param `?connectFacebook=...` masih
  // melihat dialog Facebook Pages Picker terbuka walau tombol Connect sudah
  // disembunyikan untuknya. Mutasi sebenarnya tetap ditolak server
  // (`assertActorCanManageConnectedAccounts`, tidak berubah), jadi ini
  // murni gap konsistensi UI — ditutup di sini supaya dialog juga tidak
  // pernah muncul sama sekali untuk role yang tidak berhak.
  const [facebookSession, setFacebookSession] = useState(
    canManageConnections ? facebookPagesPicker : null,
  );

  useEffect(() => {
    if (!facebookPagesPicker) return;
    // Strip `connectFacebook`/`connectFacebookState` dari address bar
    // SEGERA setelah dibaca ke state lokal — flag bukan bearer, tapi
    // tetap jangan biarkan query mengotori URL setelah dialog terbuka.
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya perlu jalan sekali saat mount dengan query param Facebook awal, bukan tiap render router/pathname.
  }, []);

  const disconnectConfirm = useConfirmAction<ConnectedAccountRecord>(
    (account) => disconnectAccountAction(account.id),
    () => toast("Akun berhasil diputus koneksinya"),
  );

  const target = disconnectConfirm.target;
  const targetPlatformLabel = target
    ? (PLATFORM_ICON[target.platform]?.label ?? target.platform)
    : "";

  return (
    /* eslint-disable-next-line no-restricted-syntax -- T-099.3: file ini
       sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
       VStack Astryx. */
    <div className="flex flex-col gap-4 p-4">
      <SettingsPageHead
        pageName="Connected Accounts"
        breadcrumb={`${SETTINGS_BREADCRUMB_GROUP.organization} / Connected Accounts`}
        action={canManageConnections ? <ConnectPlatformMenu /> : null}
      />

      {disconnectConfirm.error ? (
        <Alert variant="destructive">
          <AlertTitle>{disconnectConfirm.error}</AlertTitle>
        </Alert>
      ) : null}

      {/* eslint-disable-next-line no-restricted-syntax -- T-099.3: file ini sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097) */}
      <div
        className={cn(
          "rounded-xl border border-border",
          accounts.length === 0 ? "p-6" : "py-2",
        )}
      >
        {accounts.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Belum ada akun terhubung</EmptyTitle>
              <EmptyDescription>
                Hubungkan akun media sosial pertama lewat tombol Connect Account
                di atas.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableBody>
              {accounts.map((account) => (
                <ConnectedAccountRow
                  key={account.id}
                  account={account}
                  canManage={canManageConnections}
                  onRequestDisconnect={(requested) =>
                    disconnectConfirm.open(requested)
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmActionDialog
        isOpen={disconnectConfirm.isOpen}
        onClose={disconnectConfirm.close}
        title={`Putuskan koneksi ${targetPlatformLabel} ${target?.handle ?? ""}?`}
        description="Post yang sudah terjadwal untuk akun ini akan tetap di antrean — tidak otomatis dibatalkan. Post baru tidak bisa dijadwalkan ke akun ini sampai disambungkan kembali."
        confirmLabel="Putuskan Koneksi"
        isLoading={disconnectConfirm.isLoading}
        onConfirm={() => void disconnectConfirm.confirm()}
        variant="destructive"
      />

      {facebookSession ? (
        <FacebookPagesPickerDialog
          open
          state={facebookSession.state}
          onOpenChange={(next) => {
            if (!next) setFacebookSession(null);
          }}
        />
      ) : null}
    </div>
  );
}
