"use client";

import Link from "next/link";
import { useState } from "react";
import type { DragEvent } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { DragDropVerticalIcon, PlusSignIcon } from "@hugeicons/core-free-icons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { SocialPlatform } from "@postific/shared";

import {
  getConnectionStatusLabel,
  resolveConnectionDisplayStatus,
  type SidebarChannelAccount,
} from "@/domains/workspace";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/get-initials";

import { useDraftEditor } from "../draft-editor/Context";

import { PLATFORM_ICON } from "../platform-icons";
import { reorderChannelsAction } from "./actions";

export type { SidebarChannelAccount };

// Micro-interaction timing di bawah (duration-150/ease-out) meniru
// `--duration-fast`/`--ease-standard` Astryx (125ms, lihat
// @astryxdesign/theme-stone/theme.css) — dipetakan ke step Tailwind
// terdekat karena file ini sudah dimigrasi penuh ke shadcn/Tailwind (T-098),
// bukan lagi token CSS var Astryx.
const TRANSITION_FAST = "duration-150 ease-out";

// Scroll independen dari nav items "Menu" di atasnya — max-height token-based
// (spacing scale shadcn, base 1 unit = 4px per design-tokens.md). Row ~42px
// + my-1 (8px) + gap-2 (8px) ~= 56.4px/baris x 5 = 282px, jadi spacing unit
// x72 (288px).
const LIST_CLASSNAME = "max-h-72 overflow-y-auto";

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const entry = PLATFORM_ICON[platform];
  if (!entry) {
    return null;
  }
  const PlatformGlyph = entry.Icon;
  return (
    <span
      className="absolute -inset-e-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-border"
      aria-hidden
    >
      {/* Warna brand asli (bukan token) — pengecualian disengaja, lihat
          komentar di platform-icons.tsx (ADR-058 poin 6 & 10). */}
      <PlatformGlyph size={9} color={entry.color} />
    </span>
  );
}

function ChannelRow({
  account,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  account: SidebarChannelAccount;
  isDragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void;
}) {
  const { openNewPost } = useDraftEditor();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Reveal action affordances on either hover or keyboard focus-within.
  const isRevealed = isHovered || isFocused;

  const displayStatus = resolveConnectionDisplayStatus(account);
  const needsAttention = displayStatus !== "active";

  return (
    // File ini sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097),
    // bukan lagi HStack Astryx.
    // eslint-disable-next-line no-restricted-syntax -- T-098.1
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Only clear when focus truly leaves the row, not when it moves
        // between children (e.g. from row to button within same row).
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
      className={cn(
        "relative my-1 flex items-center gap-2",
        // eslint-disable-next-line tailwindcss/no-arbitrary-value -- transition-property arbitrary value, tidak ada utility Tailwind native untuk `margin-inline-start`.
        "transition-[margin-inline-start]",
        TRANSITION_FAST,
        isRevealed ? "ms-4" : "ms-0",
        isDragging ? "opacity-50" : "opacity-100",
      )}
      data-testid="channel-row"
    >
      {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
      <div
        className={cn(
          "absolute inset-y-0 -inset-s-4 flex cursor-grab items-center transition-opacity",
          TRANSITION_FAST,
          isRevealed ? "opacity-100" : "opacity-0",
        )}
      >
        <HugeiconsIcon
          icon={DragDropVerticalIcon}
          strokeWidth={2}
          className="size-3 text-muted-foreground"
        />
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
      <div className="relative shrink-0">
        <Avatar size="sm">
          <AvatarImage
            src={account.avatarUrl ?? undefined}
            alt={account.handle}
          />
          <AvatarFallback>{getInitials(account.handle)}</AvatarFallback>
        </Avatar>
        <PlatformBadge platform={account.platform} />
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <Text variant="small" className="w-full truncate font-medium">
          {account.handle}
        </Text>
        {needsAttention ? (
          <Link href="/settings/connected-accounts" className="no-underline">
            <Badge variant="destructive">
              {getConnectionStatusLabel(account)}
            </Badge>
          </Link>
        ) : (
          <Badge variant="success">{getConnectionStatusLabel(account)}</Badge>
        )}
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
      <div className="relative size-4 shrink-0">
        {/* Swap count <-> tombol "+": fixed slot, opacity/visibility toggle
            (bukan display none<->flex) — TIDAK berubah dari ADR-058 asli
            (no-shift), berbeda dari drag-handle di atas yang sengaja
            shift-on-hover. */}
        {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            // eslint-disable-next-line tailwindcss/no-arbitrary-value -- transition-property arbitrary value, tidak ada utility Tailwind native untuk multi-property ini.
            "transition-[opacity,visibility]",
            TRANSITION_FAST,
            isRevealed
              ? "pointer-events-none invisible opacity-0"
              : "visible opacity-100",
          )}
        >
          <Text variant="muted" className="text-xs tabular-nums">
            {account.scheduledCount}
          </Text>
        </div>
        {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            // eslint-disable-next-line tailwindcss/no-arbitrary-value -- transition-property arbitrary value, tidak ada utility Tailwind native untuk multi-property ini.
            "transition-[opacity,visibility]",
            TRANSITION_FAST,
            isRevealed
              ? "visible opacity-100"
              : "pointer-events-none invisible opacity-0",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Buat post baru untuk ${account.handle}`}
                className="size-4 min-h-4 min-w-4 p-0 [&_svg]:size-2.5"
                onClick={(e) => {
                  e.stopPropagation();
                  openNewPost(account.id);
                }}
              >
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New post</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export function ChannelsSection({
  channels,
}: {
  channels: SidebarChannelAccount[];
}) {
  const [orderedChannels, setOrderedChannels] = useState(channels);
  const [channelsSnapshot, setChannelsSnapshot] = useState(channels);
  // Render-only — drives `isDragging` opacity. NOT safe to read inside drop
  // logic: this closure can be stale if native `drop` fires before React
  // re-renders from `setDraggedId` in handleDragStart. handleDrop reads the
  // source id from `e.dataTransfer` instead (immune to that race) — keep any
  // new drop-time logic doing the same, not reaching for this state.
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Sinkronisasi ringan kalau `channels` dari server berubah (akun baru
  // terhubung/diputus, atau reload) — dihitung selama render ("adjusting
  // state when a prop changes", bukan useEffect). T-012.1: server
  // (`listSidebarChannels`) sekarang selalu mengembalikan urutan final yang
  // benar (posisi tersimpan per user), jadi cukup replace langsung — skip
  // hanya saat drag aktif supaya baris tidak "menyentak" dari bawah kursor.
  if (channels !== channelsSnapshot) {
    setChannelsSnapshot(channels);
    if (!draggedId) {
      setOrderedChannels(channels);
    }
  }

  function handleDragStart(id: string) {
    return (e: DragEvent<HTMLDivElement>) => {
      setDraggedId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    };
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(targetId: string) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId) {
        return;
      }
      setOrderedChannels((prev) => {
        const next = [...prev];
        const fromIndex = next.findIndex((c) => c.id === sourceId);
        const toIndex = next.findIndex((c) => c.id === targetId);
        if (fromIndex === -1 || toIndex === -1) {
          return prev;
        }
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        // Persist (T-012.1) — optimistic, fire-and-forget. Revert ke urutan
        // sebelumnya kalau gagal (baik reject maupun `{ error }`) supaya
        // state lokal tidak diam-diam drift dari DB. Sengaja tidak
        // `router.refresh()` di jalur sukses (hindari flicker) — reload
        // berikutnya akan membaca urutan tersimpan.
        reorderChannelsAction(next.map((c) => c.id))
          .then((result) => {
            if (result.error) {
              setOrderedChannels(prev);
            }
          })
          .catch(() => {
            setOrderedChannels(prev);
          });

        return next;
      });
    };
  }

  function handleDragEnd() {
    setDraggedId(null);
  }

  if (orderedChannels.length === 0) {
    return null;
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas
    <div className="flex flex-col gap-0.5">
      <Text
        variant="muted"
        className="px-2 pb-1 text-xs font-medium tracking-wide uppercase"
      >
        Channels
      </Text>
      {/* eslint-disable-next-line no-restricted-syntax -- T-098.1, sama seperti di atas */}
      <div className={cn("flex flex-col gap-2", LIST_CLASSNAME)}>
        {orderedChannels.map((account) => (
          <ChannelRow
            key={account.id}
            account={account}
            isDragging={draggedId === account.id}
            onDragStart={handleDragStart(account.id)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(account.id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
