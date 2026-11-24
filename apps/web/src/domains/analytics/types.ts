/** Domain-specific types for analytics. */
import type { ConnectedAccountId, SocialPlatform } from "@postific/shared";

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

/** Thresholds of the empty-Queue best-time suggestions (S-008, confirmed 2026-11-24). */
export const BEST_TIME_WINDOW_DAYS = 90;
export const BEST_TIME_MIN_POSTS_PER_BUCKET = 3;
export const BEST_TIME_MIN_POSTS_PER_ACCOUNT = 10;
export const BEST_TIME_SUGGESTIONS_PER_ACCOUNT = 3;
export const BEST_TIME_LOOKAHEAD_DAYS = 7;

/** One published post of one account, with its stored metrics (T-291). */
export interface BestTimeSample {
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  publishedAt: Date;
  engagementRate: number;
  reach: number;
}

/** Weekday 0 = Sunday ... 6 = Saturday, hour 0-23, both in the display timezone. */
export interface BestTimeBucket {
  weekday: number;
  hour: number;
  postCount: number;
  medianEngagementRate: number;
  medianReach: number;
}

export interface BestTimeSlot {
  /** Upcoming instant (start of the local hour) within the lookahead window. */
  slotAt: Date;
  weekday: number;
  hour: number;
  /** 1 = best bucket of the account. */
  rank: number;
  medianEngagementRate: number;
  medianReach: number;
  postCount: number;
}

export interface AccountBestTimeSuggestions {
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  /** Ordered by time ascending; at most the requested limit. */
  slots: BestTimeSlot[];
}
