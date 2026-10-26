import { ContentStatus } from "@postific/shared";
import { historyItemOccurredAt } from "@/domains/publishing";
import type { HistoryItemRecord } from "@/domains/publishing";

/**
 * Jam di kiri kartu History. Memakai kunci waktu bisnis yang sama dengan
 * judul kelompok (`historyItemOccurredAt`, T-142), jadi jam dan tanggal
 * kelompok selalu satu hari kalender.
 */
export function historyListClockDate(item: HistoryItemRecord): Date {
  return historyItemOccurredAt(item);
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
