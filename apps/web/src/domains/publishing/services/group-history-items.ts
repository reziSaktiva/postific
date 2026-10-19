import type { HistoryItemRecord } from "../repositories/publishing.repository";

/**
 * Satu kelompok tanggal untuk History (T-034.2, KSP-D10) — hasil
 * pengelompokan `listHistory`/`groupHistoryItemsByDate` per tanggal
 * kalender "waktu selesai" (`item.updatedAt`, sama proksi yang dipakai
 * `IPublishingRepository.listHistory` untuk `orderBy`, lihat catatan gap
 * `failedAt`/`failureReason` di sana).
 */
export interface HistoryGroup {
  /**
   * Kunci pengelompokan, format ISO calendar date "YYYY-MM-DD" (kalender
   * UTC). Bukan untuk ditampilkan langsung — format tanggal lokal (mis.
   * "Senin, 14 Juli") adalah tanggung jawab UI (T-034.2), sama pola dengan
   * `QueueGroup.date`.
   */
  date: string;
  items: HistoryItemRecord[];
}

/**
 * Kelompokkan history item per tanggal kalender `updatedAt` — murni
 * berdasar urutan `items` yang diberikan, fungsi ini TIDAK mengurutkan
 * ulang. Caller (composition root `/publish/history`) wajib memberi
 * `items` yang sudah terurut oleh repository (`listHistory`, `orderBy:
 * { updatedAt: "desc" }`) — sama pola dengan `groupQueueItemsByDate`
 * (Queue, ascending `scheduledAt`) supaya urutan antar-grup dan urutan
 * item di dalam tiap grup konsisten dengan kontrak repository tanpa
 * perlu sorting kedua di sini.
 *
 * `updatedAt` dipakai sebagai kunci grouping (bukan `publishedAt`) supaya
 * urutan grup SELALU konsisten dengan urutan `items` — `publishedAt` bisa
 * `null` untuk post `Failed` yang gagal sebelum sempat publish, dan
 * mem-fallback ke field lain di sini akan membuat urutan tanggal grup dan
 * urutan item tidak lagi selaras dengan input. Jam di kiri kartu History
 * wajib memakai `updatedAt` yang sama (`historyListClockDate`), supaya
 * jam dan judul tanggal satu hari kalender. Teks "Dipublikasikan …"
 * boleh memakai `publishedAt`.
 *
 * Pure function (tanpa I/O) supaya bisa diuji tanpa fake repository —
 * lihat `group-history-items.test.ts`.
 */
export function groupHistoryItemsByDate(
  items: HistoryItemRecord[],
): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  const groupByDate = new Map<string, HistoryGroup>();

  for (const item of items) {
    const date = toCalendarDateKey(item.updatedAt);
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

function toCalendarDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
