import type { BestTimeSlot } from "@/domains/analytics";
import { toDateKey } from "@/domains/publishing/wib-time";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

import type { NewPostPreset } from "../../../components/draft-editor/new-post-preset";

/** Suggestions shown per account before "show more times" (S-008). */
export const INITIAL_SUGGESTIONS_PER_ACCOUNT = 3;

/** Suggestions the server fetches per account, so "show more" needs no request. */
export const FETCHED_SUGGESTIONS_PER_ACCOUNT = 9;

/**
 * Slots of one account to show, ordered by time. The use case returns its
 * top buckets ordered by time, so the first view keeps the best-ranked ones
 * (rank 1 is best), not just the earliest; "show more" adds the rest.
 */
export function pickVisibleSlots(
  slots: BestTimeSlot[],
  showAll: boolean,
  initial: number = INITIAL_SUGGESTIONS_PER_ACCOUNT,
): BestTimeSlot[] {
  const chosen = showAll
    ? slots
    : [...slots].sort((a, b) => a.rank - b.rank).slice(0, initial);
  return [...chosen].sort((a, b) => a.slotAt.getTime() - b.slotAt.getTime());
}

/**
 * Draft Editor preset for "+ New" on a suggested slot (T-291 item 4): the
 * account and the slot's wall-clock date and time in the display zone of
 * the Publish page. The editor converts it to its own zone.
 */
export function suggestionSlotPreset(
  connectedAccountId: string,
  slotAt: Date,
  timeZone: string,
): NewPostPreset {
  return {
    connectedAccountId,
    date: toDateKey(slotAt, timeZone),
    time: getZonedFormatter(
      "en-GB",
      { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
      timeZone,
    ).format(slotAt),
    timeZone,
  };
}
