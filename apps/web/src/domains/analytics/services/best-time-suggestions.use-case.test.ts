import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { IAnalyticsRepository } from "../repositories/analytics.repository";
import type { BestTimeSample } from "../types";
import { BestTimeSuggestionsUseCase } from "./best-time-suggestions.use-case";

const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const ACCOUNT_A = asConnectedAccountId("acc-a");
const ACCOUNT_B = asConnectedAccountId("acc-b");
// Wednesday 2026-11-25 08:30 UTC = 15:30 in Asia/Jakarta (UTC+7)
const NOW = new Date("2026-11-25T08:30:00Z");

function repoWith(samples: BestTimeSample[], seen?: { window?: unknown }) {
  return {
    findBestTimeSamples: async (_ws, window) => {
      if (seen) seen.window = window;
      return samples;
    },
  } as IAnalyticsRepository;
}

/** n samples on the same weekday-hour (UTC date list), one per week going back. */
function samplesAt(
  accountId: typeof ACCOUNT_A,
  isoTimes: string[],
  engagementRate: number,
  reach = 100,
): BestTimeSample[] {
  return isoTimes.map((iso) => ({
    connectedAccountId: accountId,
    platform: SocialPlatform.Instagram,
    publishedAt: new Date(iso),
    engagementRate,
    reach,
  }));
}

// Mondays 02:00 UTC (= 09:00 Jakarta) and Fridays 11:00 UTC (= 18:00 Jakarta)
const MONDAYS = ["2026-11-23", "2026-11-16", "2026-11-09", "2026-11-02"].map(
  (d) => `${d}T02:00:00Z`,
);
const FRIDAYS = ["2026-11-20", "2026-11-13", "2026-11-06", "2026-10-30"].map(
  (d) => `${d}T11:00:00Z`,
);
const SUNDAYS = ["2026-11-22", "2026-11-15", "2026-11-08"].map(
  (d) => `${d}T04:00:00Z`,
);

async function run(
  samples: BestTimeSample[],
  extra: { timezone?: string; limitPerAccount?: number } = {},
) {
  return new BestTimeSuggestionsUseCase(repoWith(samples)).execute({
    workspaceId: WORKSPACE,
    actingUserId: USER,
    timezone: extra.timezone ?? "Asia/Jakarta",
    limitPerAccount: extra.limitPerAccount,
    now: NOW,
  });
}

describe("BestTimeSuggestionsUseCase", () => {
  it("ranks buckets by median engagement rate and returns the next occurrences within 7 days", async () => {
    const result = await run([
      ...samplesAt(ACCOUNT_A, MONDAYS, 0.05),
      ...samplesAt(ACCOUNT_A, FRIDAYS, 0.09),
      ...samplesAt(ACCOUNT_A, SUNDAYS, 0.01),
    ]);

    expect(result).toHaveLength(1);
    const slots = result[0].slots;
    expect(slots.map((s) => [s.rank, s.slotAt.toISOString()])).toEqual([
      // Fri 18:00 Jakarta (best) comes before Mon 09:00 and Sun 11:00
      [1, "2026-11-27T11:00:00.000Z"],
      [3, "2026-11-29T04:00:00.000Z"],
      [2, "2026-11-30T02:00:00.000Z"],
    ]);
    for (const slot of slots) {
      expect(slot.slotAt.getTime()).toBeGreaterThan(NOW.getTime());
      expect(slot.slotAt.getTime()).toBeLessThanOrEqual(
        NOW.getTime() + 7 * 86_400_000,
      );
    }
  });

  it("breaks an engagement-rate tie by median reach", async () => {
    const result = await run([
      ...samplesAt(ACCOUNT_A, MONDAYS, 0.05, 100),
      ...samplesAt(ACCOUNT_A, FRIDAYS, 0.05, 900),
      ...samplesAt(ACCOUNT_A, SUNDAYS, 0.01),
    ]);
    const ranked = result[0].slots.sort((a, b) => a.rank - b.rank);
    expect(ranked.map((s) => s.weekday)).toEqual([5, 1, 0]);
  });

  it("uses the median, not the mean, of a bucket", async () => {
    const outlier = samplesAt(
      ACCOUNT_A,
      MONDAYS.slice(0, 3),
      0.02, // median 0.02 even with one huge outlier below
    );
    outlier[0].engagementRate = 0.9;
    const result = await run([
      ...outlier,
      ...samplesAt(ACCOUNT_A, FRIDAYS, 0.04),
      ...samplesAt(ACCOUNT_A, SUNDAYS, 0.01),
    ]);
    expect(result[0].slots.find((s) => s.rank === 1)?.weekday).toBe(5);
  });

  it("drops a bucket with fewer than 3 posts", async () => {
    const result = await run([
      ...samplesAt(ACCOUNT_A, MONDAYS, 0.05),
      ...samplesAt(ACCOUNT_A, FRIDAYS, 0.04),
      // only 2 posts in this bucket, however good they are
      ...samplesAt(ACCOUNT_A, SUNDAYS.slice(0, 2), 0.9),
      ...samplesAt(ACCOUNT_A, ["2026-11-04T05:00:00Z"], 0.01),
    ]);
    expect(result[0].slots.map((s) => s.weekday).sort()).toEqual([1, 5]);
  });

  it("gives no suggestion to an account with fewer than 10 posts with metrics", async () => {
    const result = await run([
      ...samplesAt(ACCOUNT_A, MONDAYS, 0.05),
      ...samplesAt(ACCOUNT_A, FRIDAYS.slice(0, 3), 0.05),
      ...samplesAt(ACCOUNT_B, MONDAYS, 0.05),
      ...samplesAt(ACCOUNT_B, FRIDAYS, 0.05),
      ...samplesAt(ACCOUNT_B, SUNDAYS, 0.05),
    ]);
    expect(result.map((r) => r.connectedAccountId)).toEqual([ACCOUNT_B]);
  });

  it("counts exactly 10 posts as enough", async () => {
    const result = await run([
      ...samplesAt(ACCOUNT_A, MONDAYS, 0.05),
      ...samplesAt(ACCOUNT_A, FRIDAYS, 0.05),
      ...samplesAt(ACCOUNT_A, SUNDAYS.slice(0, 2), 0.05),
    ]);
    expect(result).toHaveLength(1);
  });

  it("ignores posts older than 90 days", async () => {
    const old = ["2026-08-01", "2026-08-08", "2026-08-15"].map(
      (d) => `${d}T02:00:00Z`,
    );
    const result = await run([
      ...samplesAt(ACCOUNT_A, old, 0.99),
      ...samplesAt(ACCOUNT_A, MONDAYS, 0.05),
      ...samplesAt(ACCOUNT_A, FRIDAYS, 0.04),
      ...samplesAt(ACCOUNT_A, SUNDAYS, 0.03),
    ]);
    // the 3 old posts would have made 10 samples of a different bucket;
    // they must not count toward the account total nor form a bucket
    expect(result[0].slots).toHaveLength(3);
    expect(result[0].slots.find((s) => s.rank === 1)?.weekday).toBe(1);
  });

  it("returns nothing when no bucket reaches 3 posts", async () => {
    const spread = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(NOW.getTime() - (i + 1) * 86_400_000 - i * 3_600_000);
      return d.toISOString();
    });
    expect(await run(samplesAt(ACCOUNT_A, spread, 0.05))).toEqual([]);
  });

  it("buckets by the display timezone, not UTC", async () => {
    // Monday 02:00 UTC is Sunday 21:00 in New York (UTC-5)
    const result = await run(
      [
        ...samplesAt(ACCOUNT_A, MONDAYS, 0.05),
        ...samplesAt(ACCOUNT_A, FRIDAYS, 0.04),
        ...samplesAt(ACCOUNT_A, SUNDAYS, 0.03),
      ],
      { timezone: "America/New_York" },
    );
    const mondayBucket = result[0].slots.find((s) => s.rank === 1);
    expect([mondayBucket?.weekday, mondayBucket?.hour]).toEqual([0, 21]);
  });

  it("honors the per-account limit and keeps slots in time order", async () => {
    const samples = [
      ...samplesAt(ACCOUNT_A, MONDAYS, 0.05),
      ...samplesAt(ACCOUNT_A, FRIDAYS, 0.09),
      ...samplesAt(ACCOUNT_A, SUNDAYS, 0.01),
    ];
    const one = await run(samples, { limitPerAccount: 1 });
    expect(one[0].slots.map((s) => s.rank)).toEqual([1]);
    const two = await run(samples, { limitPerAccount: 2 });
    expect(two[0].slots.map((s) => s.rank)).toEqual([1, 2]);
  });

  it("rejects an unknown timezone", async () => {
    await expect(run([], { timezone: "Not/AZone" })).rejects.toThrow(
      /timezone/i,
    );
  });

  it("asks the repository for the last 90 days only", async () => {
    const seen: { window?: { since: Date; until: Date } } = {};
    await new BestTimeSuggestionsUseCase(repoWith([], seen)).execute({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      timezone: "UTC",
      now: NOW,
    });
    expect(seen.window?.until).toEqual(NOW);
    expect(seen.window?.since.toISOString()).toBe("2026-08-27T08:30:00.000Z");
  });
});
