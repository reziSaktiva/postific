import type { SnapshotPeriod } from "@/domains/analytics";

/**
 * Rentang tanggal untuk `PublishingService.getPostPerformance` (T-043.1).
 * Pure function, tanpa I/O — sama pola dengan `getWeekRange`/`getMonthRange`
 * (`calendar-range.ts`).
 *
 * **Keputusan arsitektur (2026-09-18, refactor Temuan 1 Ridwan Architecture
 * Reviewer — circular dependency `analytics` <-> `publishing`):** rentang
 * dihitung LANGSUNG dari `period` relatif ke `now` ("weekly" = 7 hari
 * terakhir, "monthly" = 30 hari terakhir) — TIDAK lagi bergantung pada
 * `AnalyticsWorkspaceSnapshot.periodStart`/`periodEnd` seperti versi lama
 * di `AnalyticsService` (dihapus, lihat catatan di
 * `AnalyticsService.getPostMetricsByPosts`). Dipilih dibanding alternatif
 * (memperluas `PostMetricsPort` dengan method baru untuk query rentang
 * snapshot) karena lebih sederhana dan tidak menambah permukaan port lintas
 * domain — `publishing` cukup tahu "period" sebagai konsep tanggal murni,
 * tidak perlu tahu apa pun soal `AnalyticsWorkspaceSnapshot`.
 *
 * **Konsekuensi semantik (dilaporkan ke King Rezi, bukan diam-diam
 * diperluas):** empty-state `getPostPerformance` sekarang berarti "tidak
 * ada post published di rentang tanggal ini" — BUKAN lagi "belum ada
 * snapshot untuk period ini" seperti versi lama. Beda dari
 * `AnalyticsService.getDashboardSummary` (T-042.2), yang TETAP bergantung
 * pada snapshot (tidak disentuh refactor ini).
 */
const WEEKLY_DAYS = 7;
const MONTHLY_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function resolvePostPerformancePeriodRange(
  period: SnapshotPeriod,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const days = period === "weekly" ? WEEKLY_DAYS : MONTHLY_DAYS;
  const to = now;
  const from = new Date(to.getTime() - days * MS_PER_DAY);
  return { from, to };
}
