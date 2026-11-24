import {
  formatTimeZoneLabel,
  getTimeZoneRegion,
  INDONESIA_TIME_ZONES,
} from "@/domains/identity";

import type { DisplayTimeZoneGroup } from "./DisplayTimeZoneSelect";

/**
 * Options of the Publish time zone picker (T-286, design
 * `ScreenPublishRedesain`): the Indonesian zones, plus the Profile zone and
 * the zone shown now when they are elsewhere. Labels use the same format as
 * Settings → Profile (T-147) and are built on the server, so server and
 * browser render the same text.
 */
export function buildDisplayTimeZoneGroups(
  zones: { profileTimeZone: string; timeZone: string },
  at: Date,
): DisplayTimeZoneGroup[] {
  const byRegion = new Map<string, DisplayTimeZoneGroup["options"]>();
  const all = [
    ...new Set([
      ...INDONESIA_TIME_ZONES,
      zones.profileTimeZone,
      zones.timeZone,
    ]),
  ];
  for (const timeZone of all) {
    const region = getTimeZoneRegion(timeZone);
    const options = byRegion.get(region) ?? [];
    options.push({ value: timeZone, label: formatTimeZoneLabel(timeZone, at) });
    byRegion.set(region, options);
  }
  return [...byRegion].map(([region, options]) => ({ region, options }));
}
