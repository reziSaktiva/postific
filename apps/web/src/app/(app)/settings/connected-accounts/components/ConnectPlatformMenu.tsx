"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";

import { SocialPlatform } from "@postific/shared";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { PLATFORM_ICON } from "../../../components/platform-icons";
import { initiateConnectAccountAction } from "../actions";

const ALL_PLATFORMS = Object.values(SocialPlatform);

/**
 * CTA "Connect Account" (T-013.3 UI, T-013.1/T-013.2 wiring, ADR-105) —
 * dropdown 8 platform, tiap item memicu `initiateConnectAccountAction`
 * (Server Action → `WorkspaceService.initiateConnectAccount` →
 * `OutstandAdapter.connectAccount`, Fake loopback ke callback route kita
 * sendiri sampai real adapter T-025 tersedia). Sukses berarti Server Action
 * `redirect()` ke `redirectUrl` OAuth — `pendingPlatform` tetap direset di
 * `finally` (bukan diasumsikan unmount instan) supaya item dropdown tidak
 * macet disabled kalau navigasinya tertunda/terinterupsi. Gagal
 * (RBAC/validasi) mengembalikan `{ error }` tanpa redirect — ditampilkan
 * lewat `toast.error` (pola sama `RetryTargetButton`).
 *
 * Ikon trigger "+" `PlusSignIcon` (hugeicons, default preset Maia) — ikon
 * brand per platform (`PLATFORM_ICON`) tetap `react-icons` (ADR-058,
 * pengecualian logo bermerek dagang). Item dinonaktifkan HANYA selagi
 * request untuk platform itu sendiri pending (`pendingPlatform`), platform
 * lain tetap bisa diklik — konsisten "satu aksi async per klik", bukan
 * mengunci seluruh menu.
 */
export function ConnectPlatformMenu() {
  const [isPending, startTransition] = useTransition();
  const [pendingPlatform, setPendingPlatform] = useState<SocialPlatform | null>(
    null,
  );

  function handleConnect(platform: SocialPlatform) {
    setPendingPlatform(platform);
    startTransition(async () => {
      // `finally` (bukan reset manual di jalur sukses) — kalau redirect()
      // sukses, promise-nya tetap throw (NEXT_REDIRECT) yang harus terus
      // di-propagate supaya Next.js benar-benar menavigasi, tapi `finally`
      // tetap jalan lebih dulu. Ini mencegah item dropdown macet disabled
      // kalau unmount-nya tertunda/gagal (mis. navigasi diinterupsi) —
      // sebelumnya cuma direset di jalur error.
      try {
        const result = await initiateConnectAccountAction(platform);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        // Facebook (Bug #2, T-025.4/KI-070): Server Action SENGAJA tidak
        // redirect() sendiri untuk platform ini — lihat docstring
        // `initiateConnectAccountAction` (`../actions.ts`) untuk alasan
        // lengkap. `window.location.href` = hard navigation penuh (bukan
        // client-side App Router transition), memutus rantai yang
        // menyebabkan dialog Facebook Pages Picker macet Loading selamanya.
        if (result?.redirectUrl) {
          window.location.href = result.redirectUrl;
        }
      } finally {
        setPendingPlatform(null);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          Connect Account
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ALL_PLATFORMS.map((platform) => {
          const entry = PLATFORM_ICON[platform];
          const PlatformGlyph = entry.Icon;
          return (
            <DropdownMenuItem
              key={platform}
              disabled={isPending && pendingPlatform === platform}
              onSelect={(event) => {
                event.preventDefault();
                handleConnect(platform);
              }}
            >
              <PlatformGlyph size={16} color={entry.color} />
              {entry.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
