import { ContentStatus } from "@postific/shared";
import type { HistoryItemRecord } from "@/domains/publishing";

/**
 * Jam di kiri kartu History. Wajib satu hari kalender dengan judul
 * kelompok, yang dikunci dari `updatedAt` (`groupHistoryItemsByDate`).
 * `publishedAt` post `Imported` bisa berminggu-minggu lebih awal dari
 * waktu impor, jadi tidak boleh dipakai sebagai jam di dalam kelompok.
 */
export function historyListClockDate(item: HistoryItemRecord): Date {
  return item.updatedAt;
}

/**
 * Teks meta kartu History. `Published` dan `Imported` memakai
 * "Dipublikasikan …". Status lain di History (`Failed`) memakai pesan
 * error merah.
 */
export function historyListShowsPublishMeta(status: ContentStatus): boolean {
  return (
    status === ContentStatus.Published || status === ContentStatus.Imported
  );
}
