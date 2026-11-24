import { formatUtcDateKeyHeading } from "@/lib/utils";

const DAY_HEADING_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  // A date key is a calendar day of the display zone parsed as UTC midnight.
  timeZone: "UTC",
});

/** Heading of a day group, e.g. "Senin, 14 Juli", from a "YYYY-MM-DD" key. */
export function formatListDayHeading(dateKey: string): string {
  return formatUtcDateKeyHeading(dateKey, DAY_HEADING_FORMATTER);
}

/** Time on the left of a List card, in the display time zone. */
export function formatListTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}
