/** Domain-specific types for analytics. */

/**
 * Periode agregasi `WorkspaceSnapshot` (domain-model.md BC-06). Hanya
 * dipakai di dalam domain analytics — belum ada BC lain yang
 * mengonsumsinya, jadi tetap di sini (bukan `packages/shared`) sampai ada
 * kebutuhan cross-domain nyata.
 */
export type SnapshotPeriod = "weekly" | "monthly";

/**
 * Ringkasan Dashboard Home (T-042.2, KSP-01-F04 Analytics Snapshot) —
 * gabungan angka dari `AnalyticsWorkspaceSnapshot` (`totalPosts`,
 * `totalEngagements`, `avgEngagementRate`) dengan `activeAccounts`, yang
 * berasal dari domain `workspace` (cross-domain lewat `ActiveAccountsPort`
 * di `AnalyticsService`, bukan import Prisma/domain lain langsung —
 * AGENTS.md #7). Dikembalikan oleh `AnalyticsService.getDashboardSummary`;
 * `null` berarti belum ada snapshot untuk `period` ini sama sekali, dipakai
 * caller untuk merender empty state (T-042.4).
 */
export interface DashboardSummary {
  totalPosts: number;
  totalEngagements: number;
  avgEngagementRate: number;
  activeAccounts: number;
}

// `PostPerformanceRow` (T-043.1) DIPINDAHKAN ke
// `apps/web/src/domains/publishing/services/publishing.service.ts`
// (2026-09-18, temuan kritis Ridwan Architecture Reviewer — circular
// dependency `analytics` <-> `publishing`). Ikuti pola `CalendarPostItem`:
// tipe cross-domain didefinisikan langsung di service layer domain
// `publishing` yang memanggilnya, bukan di file `types.ts` terpisah.
