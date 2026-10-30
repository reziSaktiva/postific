import { toDateKey } from "../wib-time";
import { ContentStatus } from "@postific/shared";
import type { HistoryItemRecord } from "../repositories/publishing.repository";

/**
 * Waktu bisnis sebuah item History (T-142) — satu-satunya kunci untuk
 * pengelompokan tanggal, urutan, dan jam kartu. `Failed` memakai
 * `failedAt ?? updatedAt`; status lain (`Published`/`Imported`) memakai
 * `publishedAt ?? updatedAt`. `updatedAt` hanya fallback — kolom audit itu
 * berubah tiap baris di-update (import, klasifikasi, backfill), jadi bukan
 * waktu terbit.
 *
 * WAJIB identik dengan generated column `publishing_posts.occurred_at`
 * (T-145, migrasi `..._t145_publishing_posts_occurred_at`, `ORDER BY` di
 * `listHistory`): ubah salah satu, ubah keduanya.
 */
export function historyItemOccurredAt(item: HistoryItemRecord): Date {
  if (item.status === ContentStatus.Failed) {
    return item.failedAt ?? item.updatedAt;
  }
  return item.publishedAt ?? item.updatedAt;
}

/**
 * Pembanding urutan History: waktu bisnis descending
 * (`historyItemOccurredAt`), tie-breaker `updatedAt` descending lalu `id`
 * descending supaya urutan deterministik. Dipakai repository (`listHistory`)
 * dan sort lokal Realtime di UI, jadi keduanya tidak bisa berbeda.
 */
export function compareHistoryItemsDesc(
  a: HistoryItemRecord,
  b: HistoryItemRecord,
): number {
  const byOccurred =
    historyItemOccurredAt(b).getTime() - historyItemOccurredAt(a).getTime();
  if (byOccurred !== 0) return byOccurred;
  const byUpdated = b.updatedAt.getTime() - a.updatedAt.getTime();
  if (byUpdated !== 0) return byUpdated;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * Satu kelompok tanggal untuk History (T-034.2, KSP-D10) — hasil
 * pengelompokan `listHistory`/`groupHistoryItemsByDate` per tanggal
 * kalender waktu bisnis (`historyItemOccurredAt`, T-142), urutan sama
 * dengan `compareHistoryItemsDesc` yang dipakai `listHistory`.
 */
export interface HistoryGroup {
  /**
   * Kunci pengelompokan, format ISO calendar date "YYYY-MM-DD" (kalender
   * di zona waktu pengguna, T-147/ADR-146). Bukan untuk ditampilkan langsung — format tanggal lokal (mis.
   * "Senin, 14 Juli") adalah tanggung jawab UI (T-034.2), sama pola dengan
   * `QueueGroup.date`.
   */
  date: string;
  items: HistoryItemRecord[];
}

/**
 * Kelompokkan history item per tanggal kalender waktu bisnis
 * (`historyItemOccurredAt`: `publishedAt ?? updatedAt`, Failed
 * `failedAt ?? updatedAt`) — murni berdasar urutan `items` yang diberikan,
 * fungsi ini TIDAK mengurutkan ulang. Caller wajib memberi `items` yang
 * sudah terurut `compareHistoryItemsDesc` (repository `listHistory`) supaya
 * urutan grup dan urutan item konsisten. Jam di kiri kartu
 * (`historyListClockDate`) memakai kunci yang sama.
 *
 * Pure function (tanpa I/O) — lihat `group-history-items.test.ts`.
 */
export function groupHistoryItemsByDate(
  items: HistoryItemRecord[],
  timeZone: string,
): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  const groupByDate = new Map<string, HistoryGroup>();

  for (const item of items) {
    const date = toDateKey(historyItemOccurredAt(item), timeZone);
    let group = groupByDate.get(date);
    if (!group) {
      group = { date, items: [] };
      groupByDate.set(date, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}
