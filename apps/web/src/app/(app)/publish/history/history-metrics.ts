import type { PostMetricsRecord } from "@/domains/analytics";

export interface HistoryMetricsSummary {
  impressions: number;
  reach: number;
  comments: number;
  /** Mean engagement rate of the targets that have a row (0 to 1). */
  engagementRate: number;
}

/**
 * One line of metrics for a History card: counts are summed over the post's
 * targets, the engagement rate is the mean. `null` when no target has stored
 * metrics yet, so the card shows "Belum ada data" rather than zeros.
 */
export function summarizeHistoryMetrics(
  metrics: PostMetricsRecord[] | null | undefined,
): HistoryMetricsSummary | null {
  if (!metrics || metrics.length === 0) {
    return null;
  }
  return {
    impressions: metrics.reduce((sum, m) => sum + m.impressions, 0),
    reach: metrics.reduce((sum, m) => sum + m.reach, 0),
    comments: metrics.reduce((sum, m) => sum + m.comments, 0),
    engagementRate:
      metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length,
  };
}
