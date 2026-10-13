"use client";

import { useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Notification03Icon,
} from "@hugeicons/core-free-icons";

import { NotificationType } from "@postific/shared";
import type { NotificationId } from "@postific/shared";
import type { NotificationRecord } from "@/domains/notification";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";
import { useNotificationRealtime } from "@/lib/hooks/use-notification-realtime";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";

/**
 * T-036.4 (NP-D08) — bell trigger + panel notifikasi di sidebar footer.
 * T-098.2: wrapper selektif `@/components/ui/Drawer` (dibangun manual karena
 * Astryx v0.4.3 tidak punya primitive Drawer/side-sheet, ADR-041) diganti
 * komponen shadcn `Sheet` asli (Radix Dialog + slide animation, dukungan
 * dismiss klik-luar/Escape bawaan) — `Drawer.tsx` dihapus setelah ini jadi
 * satu-satunya consumer-nya bermigrasi (grep dijalankan sebelum hapus).
 */

// Whitelist eksplisit (bukan substring match) karena `NotificationType` yang
// ada sekarang (ownership_transfer_requested/_resolved) tidak pernah
// mengandung "error"/"failed" — substring match lama selalu false dan
// membuat notifikasi yang masih pending (belum success) ikut dirender
// dengan icon success. T-036.5 tinggal menambah nilai enum publish-error ke
// sini saat post.error diimplementasikan.
const SUCCESS_NOTIFICATION_TYPES = new Set<NotificationType>([
  NotificationType.OwnershipTransferResolved,
]);

function isSuccessType(type: NotificationType): boolean {
  return SUCCESS_NOTIFICATION_TYPES.has(type);
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: NotificationRecord;
  onMarkRead: (id: NotificationId) => void;
}) {
  const isUnread = !notification.isRead;
  const isError = !isSuccessType(notification.type);

  return (
    // File ini sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097),
    // bukan lagi ListItem/HStack Astryx.
    // eslint-disable-next-line no-restricted-syntax -- T-098.2
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl p-3",
        isUnread && "bg-accent",
      )}
    >
      {/* eslint-disable-next-line no-restricted-syntax -- T-098.2, sama seperti di atas */}
      <div className="shrink-0">
        {/* Gap desain #3 (spec `.notif-icon` + `.is-success`/`.is-error`):
            circle status 32px, background muted sesuai status. KI-041
            (tokens `--success`/`--warning` belum ada) sudah Resolved lewat
            ADR-098 (2026-09-04) — sekarang dipetakan ke token semantik asli
            (`success`/`destructive`), bukan lagi workaround netral `muted`. */}
        {/* eslint-disable-next-line no-restricted-syntax -- T-098.2, sama seperti di atas */}
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            isError
              ? "bg-destructive/10 text-destructive"
              : "bg-success/10 text-success",
          )}
        >
          <HugeiconsIcon
            icon={isError ? AlertCircleIcon : CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-4"
          />
        </div>
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-098.2, sama seperti di atas */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
        {isUnread ? (
          // Gap desain #2 (`.notif-dot`, cross-checked ke DesignSync
          // `components/notifications-panel.html` + `styles.css`): spec
          // asli menaruh dot di pojok kanan-atas `.notif-item`, tapi di
          // situ waktu+timestamp (`.notif-meta`) masih bagian dari kolom
          // body yang sama (stacked di bawah judul) — bukan kolom
          // terpisah rata-kanan seperti layout shadcn ini. Ditemukan QA
          // Najwa: dot di pojok baris penuh menimpa teks timestamp di
          // kolom meta. Diposisikan relatif ke kolom judul/body saja
          // (bukan seluruh baris) supaya tetap di "pojok kanan-atas" versi
          // spec tanpa bertabrakan dengan kolom meta yang terpisah.
          <span
            className="absolute -top-1 -right-1 size-2 rounded-full bg-primary"
            aria-hidden
          />
        ) : null}
        <Text
          variant="small"
          className={cn(
            "truncate pe-3",
            isUnread ? "font-semibold" : "font-normal text-muted-foreground",
          )}
        >
          {notification.title}
        </Text>
        <Text variant="muted" className="truncate text-xs">
          {notification.body}
        </Text>
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-098.2, sama seperti di atas */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Text variant="muted" className="text-xs whitespace-nowrap">
          {formatRelativeTime(notification.createdAt)}
        </Text>
        {isUnread ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMarkRead(notification.id)}
          >
            Tandai dibaca
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
  userId,
}: {
  initialNotifications: NotificationRecord[];
  initialUnreadCount: number;
  userId: string;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  // State terpisah dari `notifications` (bukan `.filter(!isRead).length`) —
  // `notifications` cuma berisi 50 baris terbaru (`list()` dibatasi), jadi
  // menghitung dari situ under-count begitu user punya >50 notifikasi belum
  // dibaca. `countUnread()` (query `count` terpisah, tanpa `take`) yang jadi
  // sumber kebenaran awal; sesudahnya di-update incremental di bawah.
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useNotificationRealtime(userId, (notification) => {
    setNotifications((prev) => [notification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  });

  async function handleMarkRead(id: NotificationId) {
    const wasUnread = notifications.some((n) => n.id === id && !n.isRead);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationReadAction(id);
    } catch {
      // Revert lewat functional update yang cuma menyentuh `id` ini (bukan
      // snapshot stale) — supaya notifikasi baru yang masuk lewat realtime
      // selagi request pending tidak ikut hilang.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
      );
      if (wasUnread) setUnreadCount((prev) => prev + 1);
    }
  }

  async function handleMarkAllRead() {
    const unreadIds = new Set(
      notifications.filter((n) => !n.isRead).map((n) => n.id),
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsReadAction();
    } catch {
      // Sama seperti handleMarkRead — revert lewat functional update
      // (tambah balik jumlah yang tadi di-nolkan), bukan assign nilai tetap,
      // supaya unread count dari realtime insert yang masuk selagi request
      // pending tidak ikut hilang.
      setNotifications((prev) =>
        prev.map((n) => (unreadIds.has(n.id) ? { ...n, isRead: false } : n)),
      );
      setUnreadCount((prev) => prev + unreadIds.size);
    }
  }

  return (
    <>
      {/* eslint-disable-next-line no-restricted-syntax -- T-098.2, sama seperti di atas */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifikasi"
          onClick={() => setIsOpen(true)}
        >
          <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
        </Button>
        {unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {/* Fix regresi alignment (dilaporkan King Rezi, review langsung ke
            spec Claude Design `.notif-header`): tombol close bawaan
            `SheetContent` di-absolute-position `top-4 right-4` independen
            dari baris flex header, jadi tidak pernah sejajar dengan title +
            "Mark all as read" — `pr-14` sebelumnya cuma mencadangkan ruang,
            tidak memperbaiki alignment vertikal. `showCloseButton={false}`
            + tombol close dirender manual di dalam grup aksi kanan (pola
            sama seperti `draft-editor/Modal.tsx` DialogHeader) supaya
            title/"Mark all as read"/close jadi flex-sibling satu baris,
            dijamin sejajar oleh `items-center`. */}
        <SheetContent
          showCloseButton={false}
          className="w-full gap-0 p-0 sm:max-w-sm"
        >
          {/* Padding `p-4` (16px) = token spec `.notif-header { padding:
              var(--spacing-4) }` — sebelumnya masih p-6 (24px) bawaan
              `SheetHeader`, tidak match spec. `gap-3` (12px) = token
              `--spacing-3` yang dipakai spec baik untuk gap header maupun
              gap internal `.notif-header-actions`. */}
          <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border p-4">
            <SheetTitle>Notifications</SheetTitle>
            {/* `.notif-header-actions` spec: markall + close dikelompokkan
                jadi satu grup rata-kanan, gap-3. */}
            {/* eslint-disable-next-line no-restricted-syntax -- padanan `.notif-header-actions`, murni Tailwind flex, tidak ada primitive shadcn setara. */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={unreadCount === 0}
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => setIsOpen(false)}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </div>
          </SheetHeader>

          {/* eslint-disable-next-line no-restricted-syntax -- T-098.2, sama seperti di atas */}
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <Empty className="h-full flex-1 border-none p-6">
                <EmptyHeader>
                  <EmptyTitle>Belum ada notifikasi</EmptyTitle>
                  <EmptyDescription>
                    Notifikasi hasil publish akan muncul di sini.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              // eslint-disable-next-line no-restricted-syntax -- T-098.2, sama seperti di atas
              <div className="flex flex-col gap-1">
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
