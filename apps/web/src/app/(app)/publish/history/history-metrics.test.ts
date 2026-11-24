import { describe, expect, it } from "vitest";

import type { PostMetricsRecord } from "@/domains/analytics";

import { summarizeHistoryMetrics } from "./history-metrics";

function metric(overrides: Partial<PostMetricsRecord>): PostMetricsRecord {
  return {
    impressions: 0,
    reach: 0,
    comments: 0,
    engagementRate: 0,
    ...overrides,
  } as PostMetricsRecord;
}

describe("summarizeHistoryMetrics", () => {
  it("returns null when there is nothing stored, so the card says there is no data", () => {
    expect(summarizeHistoryMetrics(null)).toBeNull();
    expect(summarizeHistoryMetrics(undefined)).toBeNull();
    expect(summarizeHistoryMetrics([])).toBeNull();
  });

  it("sums counts and averages the engagement rate over targets", () => {
    expect(
      summarizeHistoryMetrics([
        metric({
          impressions: 100,
          reach: 80,
          comments: 2,
          engagementRate: 0.1,
        }),
        metric({
          impressions: 50,
          reach: 20,
          comments: 1,
          engagementRate: 0.3,
        }),
      ]),
    ).toEqual({
      impressions: 150,
      reach: 100,
      comments: 3,
      engagementRate: 0.2,
    });
  });
});
