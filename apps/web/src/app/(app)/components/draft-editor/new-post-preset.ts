import { toDateKey, zonedLocalToUtc } from "@/domains/publishing/wib-time";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

/**
 * Preset for a new post opened from a place that already knows part of the
 * answer (T-287, S-008): the Calendar day button knows the date, the Queue
 * suggestions (T-291) know the account and the time. Every field is
 * optional; an empty preset is the same as a plain "+ New Post".
 *
 * `date` ("YYYY-MM-DD") and `time` ("HH:mm") are wall-clock values read in
 * `timeZone`: the zone shown on the Publish page, which can differ from the
 * Profile zone the Draft Editor uses. `timeZone` defaults to the editor's
 * zone. The editor shows the schedule in its own (Profile) zone, so the
 * values are converted, never reinterpreted.
 */
export interface NewPostPreset {
  /** Connected account to pre-select (same effect as the Channels "+"). */
  connectedAccountId?: string;
  date?: string;
  time?: string;
  timeZone?: string;
}

export interface NewPostPresetSchedule {
  scheduleDate?: string;
  scheduleTime?: string;
}

/** Hour at which a date-only preset is read when the zones differ. */
const DATE_ONLY_REFERENCE_TIME = "12:00";

const timeFormatter = (timeZone: string) =>
  getZonedFormatter(
    "en-GB",
    { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    timeZone,
  );

/**
 * Schedule date and time the editor starts with, in `editorTimeZone`.
 * A date alone keeps the time empty (the user picks it); a time without a
 * date is ignored (a time alone names no day).
 */
export function resolveNewPostPresetSchedule(
  preset: NewPostPreset | undefined,
  editorTimeZone: string,
): NewPostPresetSchedule {
  if (!preset?.date) return {};
  const readIn = preset.timeZone ?? editorTimeZone;

  if (preset.time) {
    const instant = zonedLocalToUtc(preset.date, preset.time, readIn);
    if (Number.isNaN(instant.getTime())) return {};
    return {
      scheduleDate: toDateKey(instant, editorTimeZone),
      scheduleTime: timeFormatter(editorTimeZone).format(instant),
    };
  }

  if (readIn === editorTimeZone) return { scheduleDate: preset.date };
  const instant = zonedLocalToUtc(
    preset.date,
    DATE_ONLY_REFERENCE_TIME,
    readIn,
  );
  if (Number.isNaN(instant.getTime())) return {};
  return { scheduleDate: toDateKey(instant, editorTimeZone) };
}
