/**
 * Ringkasan `reason` level-post untuk `IPublishingRepository.markPostFailed`
 * (T-107, koreksi KI-049/KI-063) — dedup pesan error unik per target yang
 * diketahui gagal, join `"; "`, fallback ke teks generik kalau tidak ada
 * satu pun pesan spesifik tersedia. Sebelumnya diimplementasikan independen
 * di `PublishNowUseCase` dan `OutstandWebhookProcessor` (code-review PR
 * #140, finding #6) — dikonsolidasi di sini, pola sama dengan
 * `schedule-time-constraints.ts`/`pinterest-board-constraints.ts` (satu
 * fungsi murni dipakai bersama beberapa caller).
 */
export const GENERIC_PUBLISH_FAILURE_MESSAGE =
  "Semua target gagal mempublikasikan post ini.";

export function summarizeFailureReasons(reasons: Iterable<string>): string {
  const unique = Array.from(new Set(reasons));
  return unique.length > 0
    ? unique.join("; ")
    : GENERIC_PUBLISH_FAILURE_MESSAGE;
}
