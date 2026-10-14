"use client";

import { useCallback, useRef } from "react";

import type { ConnectedAccountId, ContentStatus } from "@postific/shared";
import {
  effectiveCalendarDate,
  getMonthRange,
  getWeekRange,
  type CalendarPostItem,
  type CalendarViewMode,
} from "@/domains/publishing";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { usePublishingPostsRealtime } from "@/lib/hooks/use-publishing-posts-realtime";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

import { getCalendarPostAction } from "../actions";
import { CalendarAgendaList } from "./CalendarAgendaList";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarWeekGrid } from "./CalendarWeekGrid";

type CalendarScreenProps = {
  /** Hasil parse `?view=` (T-033.2) — default `"week"` sudah diresolusi
   * di `page.tsx`, bukan tanggung jawab komponen ini. */
  view: CalendarViewMode;
  /** Hasil parse `?date=` (T-033.2) — anchor periode, default hari ini
   * sudah diresolusi di `page.tsx`. */
  date: Date;
  /** Hasil nyata `PublishingService.listCalendarPosts` (T-033.3/.4, sudah
   * terfilter `statuses`/`connectedAccountIds` T-033.6) untuk rentang
   * Week/Month yang memuat `date` (`getWeekRange`/`getMonthRange`) — sudah
   * data asli dari database, bukan lagi placeholder. Diinisialisasi ke
   * client state di sini (T-092.3, ADR-094 poin 5) — sumber awal SETIAP
   * kali `page.tsx` di-render ulang server-side (navigasi periode/filter),
   * dipatch granular sesudahnya oleh event Realtime. */
  items: CalendarPostItem[];
  /** Daftar akun terkoneksi workspace (T-033.6) — opsi filter Channels di `CalendarToolbar`. */
  accounts: ConnectedAccountRecord[];
  /** Filter Status aktif dari `?status=` (T-033.6, dipakai `page.tsx` untuk
   * fetch `items` awal) — array kosong = tanpa filter (semua status). Dibawa
   * ke sini SEKARANG (T-092.3) supaya granular patch bisa menilai "apakah
   * record hasil fetch by-id masih cocok kriteria tampilan saat ini",
   * bukan cuma dipakai server-side seperti sebelumnya. */
  statuses: ContentStatus[];
  /** Filter Channels aktif dari `?accounts=` (T-033.6) — diteruskan ke grid supaya
   * target yang tidak dipilih tidak ikut tampil (post multi-platform). */
  connectedAccountIds: ConnectedAccountId[];
  /** Workspace aktif — dipakai `usePublishingPostsRealtime` (T-092.3) untuk
   * subscribe channel `publishing_posts:{workspaceId}`, bukan dipakai untuk
   * fetch data apa pun langsung di komponen ini (itu tetap tugas
   * `getCalendarPostAction`/Application Service, AGENTS.md #5). */
  workspaceId: string;
};

/**
 * Calendar (T-033.2 state periode + T-033.3/.4 grid Week/Month + T-033.5
 * navigasi + T-033.6 filter) — `view`/`date`/`items`/`accounts` di sini
 * data nyata dari `page.tsx` (`parseCalendarViewState` +
 * `getWeekRange`/`getMonthRange` + `PublishingService.listCalendarPosts` +
 * `WorkspaceService.listConnectedAccounts`). Popover klik item — T-033.8/
 * T-101.1, `CalendarPostPopover` (shadcn `Popover`, ADR-090/ADR-091).
 *
 * KI-035 poin 3 (mobile ≤768px): di bawah `CalendarToolbar` dirender grid
 * Week/Month (≥768px, TIDAK berubah — addendum, bukan pengganti) DAN
 * `CalendarAgendaList` (≤768px, list per-tanggal dari `items`/
 * `connectedAccountIds` yang SAMA) — toggle murni CSS (`hidden md:block` /
 * `block md:hidden`, breakpoint sama `CalendarEntryFooter.tsx`/
 * `MembersTable.tsx`), bukan JS viewport detection. "Minggu"/"Bulan" di
 * `CalendarToolbar` tetap mengontrol RANGE tanggal yang di-fetch
 * (`page.tsx`), bukan mode render — Agenda dipakai untuk kedua pilihan itu
 * saat mobile.
 *
 * **T-092.3 (ADR-094 poin 5, 6) — client state + granular Realtime patch:**
 * `items` sekarang disalin ke `useState` lokal (bukan lagi dirender
 * langsung dari props, pola "RSC-pure tanpa state" berubah sesuai ADR-094
 * poin 5). `useEffect` men-sinkronkan ulang state ini SETIAP kali `items`
 * prop berubah (navigasi periode/filter lewat `router.replace` di
 * `useCalendarPeriodState`, yang me-refetch `page.tsx` server-side dengan
 * `from`/`to`/`statuses`/`connectedAccountIds` baru) — supaya state lokal
 * tidak pernah "nyangkut" dari periode/filter sebelumnya.
 *
 * `usePublishingPostsRealtime(workspaceId, {...})` subscribe selama screen
 * ini mount (lifecycle per-mount, ADR-094 poin 6 — dilepas otomatis oleh
 * hook itu sendiri saat unmount/`workspaceId` berubah). Event `INSERT`/
 * `UPDATE` memicu fetch SATU record via `getCalendarPostAction` (Server
 * Action → `PublishingService.getCalendarPostById`, bukan refetch seluruh
 * list) lalu di-upsert/remove ke state lokal berdasar
 * `matchesCurrentView` (rentang tanggal `getWeekRange`/`getMonthRange` dari
 * `view`+`date` saat ini, plus filter `statuses`/`connectedAccountIds` yang
 * sama dipakai `page.tsx`) — echo dari aksi milik user sendiri diproses
 * sama seperti event orang lain, tanpa deteksi/skip apa pun (idempoten by
 * design, ADR-094 poin 5).
 *
 * Sinkronisasi `items` prop → state lokal dilakukan SAAT RENDER (pola
 * "Adjusting state when a prop changes" React, bukan `useEffect` +
 * `setState` yang memicu render tambahan/cascading) — `prevItems` menyimpan
 * referensi `items` terakhir yang sudah disinkronkan; begitu `page.tsx`
 * re-render dengan `items` baru (navigasi periode/filter lewat
 * `useCalendarPeriodState`), perbedaan referensi terdeteksi di render
 * berikutnya dan `localItems` di-reset SEBELUM commit, jadi state lokal
 * tidak pernah "nyangkut" dari periode/filter sebelumnya.
 */
export function CalendarScreen({
  view,
  date,
  items,
  accounts,
  statuses,
  connectedAccountIds,
  workspaceId,
}: CalendarScreenProps) {
  const resetGenerationRef = useRef(0);
  const [localItems, setLocalItems] = useSyncedState(items, () => {
    resetGenerationRef.current += 1;
  });
  const requestSeqRef = useRef<Map<string, number>>(new Map());

  const matchesCurrentView = useCallback(
    (item: CalendarPostItem): boolean => {
      if (statuses.length > 0 && !statuses.includes(item.status)) {
        return false;
      }
      if (
        connectedAccountIds.length > 0 &&
        !item.targets.some((target) =>
          connectedAccountIds.includes(target.connectedAccountId),
        )
      ) {
        return false;
      }

      const { from, to } =
        view === "month" ? getMonthRange(date) : getWeekRange(date);
      const effectiveDate = effectiveCalendarDate(item);
      return effectiveDate >= from && effectiveDate <= to;
    },
    [statuses, connectedAccountIds, view, date],
  );

  const handlePublishingPostChange = useCallback(
    (event: { postId: CalendarPostItem["id"] }) => {
      const seq = (requestSeqRef.current.get(event.postId) ?? 0) + 1;
      requestSeqRef.current.set(event.postId, seq);
      const generationAtRequestTime = resetGenerationRef.current;

      void (async () => {
        const fetched = await getCalendarPostAction(event.postId);

        // Buang hasil kalau sudah disusul event lain untuk postId yang sama
        // (out-of-order response), atau kalau user sudah pindah
        // periode/filter (`items` prop di-reset) sebelum fetch ini selesai —
        // closure `matchesCurrentView` di bawah bisa saja masih merujuk
        // kriteria periode yang sudah tidak aktif.
        if (
          requestSeqRef.current.get(event.postId) !== seq ||
          resetGenerationRef.current !== generationAtRequestTime
        ) {
          return;
        }

        setLocalItems((prev) => {
          const withoutStale = prev.filter((item) => item.id !== event.postId);
          if (fetched && matchesCurrentView(fetched)) {
            return [...withoutStale, fetched].sort(
              (a, b) =>
                effectiveCalendarDate(a).getTime() -
                effectiveCalendarDate(b).getTime(),
            );
          }
          return withoutStale;
        });
      })();
    },
    [matchesCurrentView, setLocalItems],
  );

  usePublishingPostsRealtime(workspaceId, {
    onInsert: handlePublishingPostChange,
    onUpdate: handlePublishingPostChange,
  });

  return (
    // T-101.1: `VStack` Astryx -> Tailwind flex (layout-only, ADR-097).
    // eslint-disable-next-line no-restricted-syntax
    <div className="flex flex-col gap-4">
      <CalendarToolbar accounts={accounts} />

      {/* eslint-disable-next-line no-restricted-syntax -- KI-035 poin 3: layout-only, toggle CSS-only grid vs agenda */}
      <div className="hidden md:block">
        {view === "month" ? (
          <CalendarMonthGrid
            date={date}
            items={localItems}
            connectedAccountIds={connectedAccountIds}
          />
        ) : (
          <CalendarWeekGrid
            date={date}
            items={localItems}
            connectedAccountIds={connectedAccountIds}
          />
        )}
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- KI-035 poin 3: layout-only */}
      <div className="block md:hidden">
        <CalendarAgendaList
          items={localItems}
          connectedAccountIds={connectedAccountIds}
        />
      </div>
    </div>
  );
}
