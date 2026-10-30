/** Formats a date in long Indonesian form (e.g. "12 Januari 2026"). */
export function formatConnectedDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
}

/** Formats a date in short Indonesian form (e.g. "2 Okt 2026"). */
export function formatShortDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
}
