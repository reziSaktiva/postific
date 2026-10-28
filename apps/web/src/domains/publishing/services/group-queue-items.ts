import { toDateKey } from "../wib-time";
import type { QueueItemRecord } from "../repositories/publishing.repository";

/**
 * Satu kelompok tanggal untuk Queue (T-032.2, KSP-03) — hasil
 * pengelompokan `PublishingService.listQueue` per tanggal kalender
 * `scheduledAt`.
 */
export interface QueueGroup {
  /**
   * Kunci pengelompokan, format ISO calendar date "YYYY-MM-DD" (kalender
   * di zona waktu pengguna, T-147/ADR-146). Bukan untuk ditampilkan langsung; format tanggal lokal
   * ("14 Juli") adalah tanggung jawab UI (T-032.3).
   */
  date: string;
  items: QueueItemRecord[];
}

/**
 * Kelompokkan queue item per tanggal kalender `scheduledAt`, murni
 * berdasar urutan `items` yang diberikan — fungsi ini TIDAK mengurutkan
 * ulang. Caller (`PublishingService.listQueue`) wajib memberi `items`
 * yang sudah terurut ascending oleh `scheduledAt` (query repository,
 * `orderBy: { scheduledAt: "asc" }`) supaya urutan antar-grup dan urutan
 * item di dalam tiap grup ikut ascending secara alami — tanpa perlu
 * sorting kedua di sini.
 *
 * Pure function (tanpa I/O) supaya bisa diuji tanpa fake repository —
 * lihat `group-queue-items.test.ts`.
 */
export function groupQueueItemsByDate(
  items: QueueItemRecord[],
  timeZone: string,
): QueueGroup[] {
  const groups: QueueGroup[] = [];
  const groupByDate = new Map<string, QueueGroup>();

  for (const item of items) {
    const date = toDateKey(item.scheduledAt, timeZone);
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
