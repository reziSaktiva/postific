import {
  getMonthRange,
  getWeekRange,
  type CalendarViewMode,
} from "@/domains/publishing";

import { addDays } from "./calendar-grid-shared";

/** Days shown by the phone Calendar, from the selected date (T-292). */
export const THREE_DAY_COUNT = 3;

/**
 * Range of posts the Calendar loads (T-292, S-008): the selected Month or
 * Week, widened to cover the three days from the selected date that the
 * phone Calendar shows. The page does not know the screen width, so it
 * always loads both; the grids ignore posts outside their own days.
 */
export function getCalendarFetchRange(
  range: CalendarViewMode,
  date: Date,
  timeZone: string,
): { from: Date; to: Date } {
  const selected =
    range === "month"
      ? getMonthRange(date, timeZone)
      : getWeekRange(date, timeZone);
  const threeDayStart = addDays(date, 0, timeZone);
  const threeDayEnd = new Date(
    addDays(date, THREE_DAY_COUNT, timeZone).getTime() - 1,
  );
  return {
    from: threeDayStart < selected.from ? threeDayStart : selected.from,
    to: threeDayEnd > selected.to ? threeDayEnd : selected.to,
  };
}

/** The three days of the phone Calendar, each at 00:00 in `timeZone`. */
export function getThreeDays(date: Date, timeZone: string): Date[] {
  return Array.from({ length: THREE_DAY_COUNT }, (_, index) =>
    addDays(date, index, timeZone),
  );
}
