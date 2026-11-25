"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { CalendarViewState } from "@/domains/publishing";
import {
  parseCalendarViewState,
  PUBLISH_CALENDAR_RANGE_COOKIE,
} from "@/domains/publishing";

/** One year; the cookie only remembers which range to reopen (T-287). */
const RANGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type SetCalendarPeriod = (next: Partial<CalendarViewState>) => void;

export type UseCalendarPeriodStateResult = CalendarViewState & {
  /**
   * Update `view`/`date`/`statuses`/`connectedAccountIds` di query param
   * URL `/publish/calendar` (ADR-046, KSP-02-F05, T-033.6). Field yang
   * tidak dikirim dipertahankan dari state saat ini — panggil
   * `setPeriod({ view: "month" })` untuk toggle tampilan saja, atau
   * `setPeriod({ date })` untuk navigasi periode saja. `statuses`/
   * `connectedAccountIds` menggantikan (bukan menggabung) filter
   * sebelumnya — kirim `[]` untuk reset ke "All Posts"/"Semua Akun".
   *
   * Pakai `router.replace` (bukan `push`) supaya berpindah periode/toggle
   * tampilan/filter tidak menumpuk browser history satu per satu — konsisten
   * dengan sifat state ini yang murni dari URL dan tidak persist antar
   * sesi/reload (readme prototipe, catatan T-033).
   */
  setPeriod: SetCalendarPeriod;
};

/**
 * Fondasi client-side (T-033.2, T-033.6) untuk membaca & mengubah state
 * periode + filter Calendar (`view`/`date`/`statuses`/`connectedAccountIds`)
 * langsung dari URL — dipakai oleh kontrol navigasi periode (Today/‹/›),
 * toggle Minggu/Bulan (T-033.5), dan dropdown filter Status/Channels
 * (T-033.6). Hook ini sendiri tidak merender UI apa pun.
 *
 * Parsing memakai `parseCalendarViewState` yang sama dengan `page.tsx`
 * (Server Component) supaya aturan fallback identik di kedua sisi.
 */
export function useCalendarPeriodState(
  /**
   * Range the server resolved for this page (URL, else the last used range
   * from the cookie, T-287): used when the URL has no `range`, so client and
   * server agree.
   */
  serverRange?: CalendarViewState["view"],
): UseCalendarPeriodStateResult {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo(
    () =>
      parseCalendarViewState(
        {
          // T-286: on the single Publish page `view` is Calendar · List ·
          // Board; the calendar range is `range` (old `view=week|month` kept
          // as a fallback by the parser).
          range: searchParams.get("range") ?? undefined,
          view: searchParams.get("view") ?? undefined,
          date: searchParams.get("date") ?? undefined,
          status: searchParams.get("status") ?? undefined,
          accounts: searchParams.get("accounts") ?? undefined,
        },
        { lastRange: serverRange },
      ),
    [searchParams, serverRange],
  );

  const setPeriod = useCallback<SetCalendarPeriod>(
    (next) => {
      const nextView = next.view ?? state.view;
      const nextDate = next.date ?? state.date;
      const nextStatuses = next.statuses ?? state.statuses;
      const nextAccountIds =
        next.connectedAccountIds ?? state.connectedAccountIds;

      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "calendar");
      params.set("range", nextView);
      params.set("date", String(nextDate.getTime()));
      setOrDeleteParam(params, "status", nextStatuses);
      setOrDeleteParam(params, "accounts", nextAccountIds);

      if (next.view) {
        document.cookie = `${PUBLISH_CALENDAR_RANGE_COOKIE}=${nextView}; path=/; max-age=${RANGE_COOKIE_MAX_AGE}; samesite=lax`;
      }

      router.replace(`${pathname}?${params.toString()}`);
    },
    [
      pathname,
      router,
      searchParams,
      state.connectedAccountIds,
      state.date,
      state.statuses,
      state.view,
    ],
  );

  return { ...state, setPeriod };
}

/** Set param jadi daftar dipisah koma, atau hapus kalau `values` kosong — supaya URL tidak menumpuk `?status=&accounts=` kosong saat filter "All Posts"/"Semua Akun". */
function setOrDeleteParam(
  params: URLSearchParams,
  key: string,
  values: readonly string[],
): void {
  if (values.length === 0) {
    params.delete(key);
  } else {
    params.set(key, values.join(","));
  }
}
