import { getZonedFormatter } from "@/lib/time/zoned-formatter";

import { chipTimeFormatter } from "../calendar/components/calendar-grid-shared";

/**
 * Date and time of a post on the Publish page (S-008): the date in Indonesian
 * and the time as the Calendar chips show it, HH:mm (24 h, ":"), e.g.
 * "12 Des 2026 13:00". One rule for the preview, the expanded dialog and the
 * Board cards, so no screen says "pukul 13.00" and another "13:00".
 */
export function formatPublishDateTime(
  date: Date,
  timeZone: string,
  month: "short" | "long" = "short",
): string {
  const day = getZonedFormatter(
    "id-ID",
    { day: "numeric", month, year: "numeric" },
    timeZone,
  ).format(date);
  return `${day} ${formatPublishTime(date, timeZone)}`;
}

/** Time of a post on the Publish page, HH:mm (24 h, ":"), as the Calendar chips. */
export function formatPublishTime(date: Date, timeZone: string): string {
  return chipTimeFormatter(timeZone).format(date);
}
