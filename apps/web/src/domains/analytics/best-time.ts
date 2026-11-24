import {
  BEST_TIME_LOOKAHEAD_DAYS,
  BEST_TIME_MIN_POSTS_PER_ACCOUNT,
  BEST_TIME_MIN_POSTS_PER_BUCKET,
  BEST_TIME_SUGGESTIONS_PER_ACCOUNT,
  BEST_TIME_WINDOW_DAYS,
  type AccountBestTimeSuggestions,
  type BestTimeBucket,
  type BestTimeSample,
  type BestTimeSlot,
} from "./types";
import { AnalyticsDomainError } from "./errors";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ComputeBestTimeInput {
  samples: BestTimeSample[];
  /** IANA timezone shown on the page, e.g. "Asia/Jakarta". */
  timezone: string;
  now: Date;
  limitPerAccount?: number;
}

interface LocalParts {
  weekday: number;
  hour: number;
  minute: number;
  second: number;
}

function createLocalPartsReader(timezone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
  } catch {
    throw new AnalyticsDomainError(`Unknown timezone: ${timezone}`);
  }
  return (date: Date): LocalParts => {
    const parts = formatter.formatToParts(date);
    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "0";
    return {
      weekday: WEEKDAYS.indexOf(get("weekday")),
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
      second: Number(get("second")),
    };
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Ranked buckets (best first) of one account's samples; buckets under the minimum are dropped. */
export function rankBestTimeBuckets(
  samples: BestTimeSample[],
  timezone: string,
): BestTimeBucket[] {
  const read = createLocalPartsReader(timezone);
  const groups = new Map<string, BestTimeSample[]>();
  for (const sample of samples) {
    const { weekday, hour } = read(sample.publishedAt);
    const key = `${weekday}-${hour}`;
    const group = groups.get(key);
    if (group) group.push(sample);
    else groups.set(key, [sample]);
  }

  const buckets: BestTimeBucket[] = [];
  for (const [key, group] of groups) {
    if (group.length < BEST_TIME_MIN_POSTS_PER_BUCKET) continue;
    const [weekday, hour] = key.split("-").map(Number);
    buckets.push({
      weekday,
      hour,
      postCount: group.length,
      medianEngagementRate: median(group.map((s) => s.engagementRate)),
      medianReach: median(group.map((s) => s.reach)),
    });
  }

  return buckets.sort(
    (a, b) =>
      b.medianEngagementRate - a.medianEngagementRate ||
      b.medianReach - a.medianReach ||
      a.weekday - b.weekday ||
      a.hour - b.hour,
  );
}

/**
 * Suggested posting times per account from its own published posts of the
 * last 90 days (S-008 § Empty Queue). Pure: no I/O, no clock besides `now`.
 * Accounts under the post threshold, or with no qualifying bucket, are omitted.
 */
export function computeBestTimeSuggestions(
  input: ComputeBestTimeInput,
): AccountBestTimeSuggestions[] {
  const { timezone, now } = input;
  const limit = input.limitPerAccount ?? BEST_TIME_SUGGESTIONS_PER_ACCOUNT;
  const read = createLocalPartsReader(timezone);

  const windowStart = now.getTime() - BEST_TIME_WINDOW_DAYS * DAY_MS;
  const byAccount = new Map<string, BestTimeSample[]>();
  for (const sample of input.samples) {
    const at = sample.publishedAt.getTime();
    if (at < windowStart || at > now.getTime()) continue;
    const list = byAccount.get(sample.connectedAccountId);
    if (list) list.push(sample);
    else byAccount.set(sample.connectedAccountId, [sample]);
  }

  // Hourly candidates aligned to the local hour start, every instant after
  // `now` up to the lookahead; the earliest candidate per bucket wins (a DST
  // fall-back repeats an hour, a spring-forward skips one).
  const nowParts = read(now);
  const firstHourStart =
    Math.floor(now.getTime() / 1000) * 1000 -
    (nowParts.minute * 60 + nowParts.second) * 1000;
  const slotByBucket = new Map<string, Date>();
  for (let k = 1; k <= BEST_TIME_LOOKAHEAD_DAYS * 24; k += 1) {
    const at = new Date(firstHourStart + k * HOUR_MS);
    const { weekday, hour } = read(at);
    const key = `${weekday}-${hour}`;
    if (!slotByBucket.has(key)) slotByBucket.set(key, at);
  }

  const result: AccountBestTimeSuggestions[] = [];
  for (const samples of byAccount.values()) {
    if (samples.length < BEST_TIME_MIN_POSTS_PER_ACCOUNT) continue;

    const slots: BestTimeSlot[] = [];
    rankBestTimeBuckets(samples, timezone).forEach((bucket, index) => {
      if (slots.length >= limit) return;
      const slotAt = slotByBucket.get(`${bucket.weekday}-${bucket.hour}`);
      if (!slotAt) return;
      slots.push({ ...bucket, slotAt, rank: index + 1 });
    });
    if (slots.length === 0) continue;

    slots.sort((a, b) => a.slotAt.getTime() - b.slotAt.getTime());
    result.push({
      connectedAccountId: samples[0].connectedAccountId,
      platform: samples[0].platform,
      slots,
    });
  }
  return result;
}
