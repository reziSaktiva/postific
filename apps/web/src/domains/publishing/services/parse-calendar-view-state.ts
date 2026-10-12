import { ContentStatus, asConnectedAccountId } from "@postific/shared";
import type { ConnectedAccountId } from "@postific/shared";

/**
 * State periode + filter Calendar (T-033.2, T-033.6, KSP-02-F05) — dibawa
 * lewat query param `?view=week|month&date=<timestamp>&status=<comma-
 * separated ContentStatus>&accounts=<comma-separated ConnectedAccountId>`
 * pada route tunggal `/publish/calendar` (ADR-046: tidak ada route terpisah
 * per view/periode/filter). Pure function, tanpa I/O — dipanggil dari
 * `page.tsx` (Server Component, `searchParams` mentah) maupun dari hook
 * client (`useSearchParams`) supaya kedua sisi memakai aturan parsing &
 * fallback yang identik.
 *
 * Fokus T-033.2 murni parsing/validasi state dari URL — TIDAK menghitung
 * rentang tanggal (start/end minggu atau bulan) untuk query
 * `PublishingService.listCalendarPosts` (T-033.1). Perhitungan rentang itu
 * tanggung jawab grid Week/Month (T-033.3/.4) yang mengonsumsi `date` di
 * sini sebagai anchor. `statuses`/`connectedAccountIds` (T-033.6) dikonsumsi
 * langsung oleh `PublishingService.listCalendarPosts` — array kosong berarti
 * "tanpa filter" (semua status/akun), sama seperti semantik opsional method
 * itu sendiri.
 */

/** Dua mode tampilan Calendar (KSP-02-F05) — default `"week"`. */
export type CalendarViewMode = "week" | "month";

export interface CalendarViewState {
  view: CalendarViewMode;
  date: Date;
  /** Filter status (T-033.6) — array kosong = "All Posts" (tanpa filter). */
  statuses: ContentStatus[];
  /** Filter akun/Channels (T-033.6) — array kosong = "Semua Akun" (tanpa filter). */
  connectedAccountIds: ConnectedAccountId[];
}

export const DEFAULT_CALENDAR_VIEW: CalendarViewMode = "week";

const VALID_STATUSES = new Set<string>(Object.values(ContentStatus));

/**
 * Bentuk longgar dipilih supaya function ini bisa langsung menerima
 * `searchParams` Next.js App Router (Server Component, tiap value bisa jadi
 * `string[]` kalau query param diulang) maupun objek sederhana
 * `{ view, date, status, accounts }` hasil `useSearchParams().get(...)` di
 * sisi client.
 */
export type CalendarViewSearchParams = Record<
  string,
  string | string[] | undefined
>;

/**
 * Parse & validasi `view`/`date`/`status`/`accounts` dari query param URL
 * Calendar.
 *
 * - `view`: valid hanya kalau nilainya persis `"month"` (case-sensitive,
 *   sesuai literal kontrak `?view=week|month`) — apa pun selain itu
 *   (`"week"`, hilang, typo, casing lain) jatuh ke default `"week"`.
 * - `date`: diperlakukan sebagai epoch milliseconds (`Number(raw)`). Hilang,
 *   string kosong/whitespace, non-numeric, atau menghasilkan `Date` tidak
 *   valid (`NaN`/non-finite) jatuh ke default hari ini (jam server saat
 *   fungsi dipanggil).
 * - `status`: daftar `ContentStatus` dipisah koma. Token yang bukan value
 *   `ContentStatus` valid (typo, kosong) di-drop diam-diam, bukan error —
 *   konsisten dengan fallback `view`/`date` di atas.
 * - `accounts`: daftar `ConnectedAccountId` dipisah koma, token kosong
 *   (mis. dari koma ganda) di-drop.
 */
export function parseCalendarViewState(
  searchParams: CalendarViewSearchParams,
): CalendarViewState {
  return {
    view: parseViewMode(firstValue(searchParams.view)),
    date: parseAnchorDate(firstValue(searchParams.date)),
    statuses: parseStatuses(firstValue(searchParams.status)),
    connectedAccountIds: parseAccountIds(firstValue(searchParams.accounts)),
  };
}

function parseStatuses(raw: string | undefined): ContentStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token): token is ContentStatus => VALID_STATUSES.has(token));
}

function parseAccountIds(raw: string | undefined): ConnectedAccountId[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map(asConnectedAccountId);
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseViewMode(raw: string | undefined): CalendarViewMode {
  return raw === "month" ? "month" : DEFAULT_CALENDAR_VIEW;
}

function parseAnchorDate(raw: string | undefined): Date {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return new Date();
  }

  const timestamp = Number(trimmed);
  if (!Number.isFinite(timestamp)) {
    return new Date();
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}
