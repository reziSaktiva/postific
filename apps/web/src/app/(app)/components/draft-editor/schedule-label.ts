import { scheduleMaxDateKey } from "@/domains/publishing/schedule-time-constraints";
import { toDateKey, zonedLocalToUtc } from "@/domains/publishing/wib-time";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

/**
 * Logika murni tampilan jadwal Draft Editor (T-205.1): label tombol "Atur
 * jadwal", ringkasan waktu di Confirmation Summary, label zona, dan batas
 * Calendar. Tanggal dan jam selalu string "YYYY-MM-DD" dan "HH:mm" yang
 * ditafsirkan di zona waktu pengguna (ADR-146); tidak ada zona browser yang
 * ikut campur.
 */

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  month: "short",
  timeZone: "UTC",
});

/** Teks tombol bila belum ada jadwal sama sekali. */
export const SCHEDULE_TRIGGER_EMPTY_LABEL = "Atur jadwal";
/** Ringkasan Confirmation Summary bila jadwal belum lengkap. */
export const SCHEDULE_SUMMARY_EMPTY_LABEL = "-";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface DateKeyParts {
  year: number;
  /** 0-11. */
  month: number;
  day: number;
}

function parseDateKey(key: string | undefined): DateKeyParts | null {
  if (!key) {
    return null;
  }
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  // Tolak tanggal yang tidak ada (30 Feb): Date.UTC menggulung ke bulan lain.
  const check = new Date(Date.UTC(year, month, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function isValidTime(time: string | undefined): time is string {
  return time !== undefined && TIME_PATTERN.test(time);
}

/**
 * Singkatan zona untuk label jadwal. Tiga zona Indonesia memakai singkatan
 * resmi (WIB, WITA, WIT); zona lain memakai nama pendek Intl pada saat jadwal
 * (mis. "GMT+8"), dan jatuh ke nama IANA bila Intl tidak memberinya.
 */
export function getTimeZoneLabel(timeZone: string, at: Date): string {
  switch (timeZone) {
    case "Asia/Jakarta":
    case "Asia/Pontianak":
      return "WIB";
    case "Asia/Makassar":
      return "WITA";
    case "Asia/Jayapura":
      return "WIT";
  }
  try {
    const parts = getZonedFormatter(
      "en-US",
      { timeZoneName: "short" },
      timeZone,
    ).formatToParts(at);
    return (
      parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone
    );
  } catch {
    return timeZone;
  }
}

function labelInstant(
  date: string,
  time: string | undefined,
  timeZone: string,
): Date {
  // Instan tidak sah (celah DST, zona tak dikenal) diteruskan apa adanya;
  // `getTimeZoneLabel` lalu jatuh ke nama IANA, bukan zona hari ini.
  return zonedLocalToUtc(date, time ?? "12:00", timeZone);
}

function formatShortDate(parts: DateKeyParts, includeYear: boolean): string {
  const at = new Date(Date.UTC(parts.year, parts.month, parts.day));
  const named = SHORT_DATE_FORMATTER.formatToParts(at);
  const dayName = named.find((part) => part.type === "weekday")?.value;
  const monthName = named.find((part) => part.type === "month")?.value;
  const base = `${dayName}, ${parts.day} ${monthName}`;
  return includeYear ? `${base} ${parts.year}` : base;
}

/**
 * Label tombol jadwal di footer:
 * - tanggal dan jam lengkap: "Rab, 4 Nov · 10:00 WIB"
 * - hanya tanggal: "Rab, 4 Nov · pilih jam"
 * - kosong atau tidak sah: "Atur jadwal"
 */
export function formatScheduleTriggerLabel(
  date: string | undefined,
  time: string | undefined,
  timeZone: string,
): string {
  const parts = parseDateKey(date);
  if (!parts || !date) {
    return SCHEDULE_TRIGGER_EMPTY_LABEL;
  }
  const short = formatShortDate(parts, false);
  if (!isValidTime(time)) {
    return `${short} · pilih jam`;
  }
  const zone = getTimeZoneLabel(timeZone, labelInstant(date, time, timeZone));
  return `${short} · ${time} ${zone}`;
}

/**
 * Baris "Waktu" di Confirmation Summary jadwal: "Rab, 4 Nov 2026 · 10:00 WIB".
 * Bila jadwal belum lengkap, "-" (Schedule memang tidak aktif saat itu).
 */
export function formatScheduleSummary(
  date: string | undefined,
  time: string | undefined,
  timeZone: string,
): string {
  const parts = parseDateKey(date);
  if (!parts || !date || !isValidTime(time)) {
    return SCHEDULE_SUMMARY_EMPTY_LABEL;
  }
  const zone = getTimeZoneLabel(timeZone, labelInstant(date, time, timeZone));
  return `${formatShortDate(parts, true)} · ${time} ${zone}`;
}

/**
 * "Hari ini" dan batas atas Calendar sebagai kunci tanggal di zona pengguna.
 * Hari lampau (sebelum `minKey`) dan hari setelah `maxKey` nonaktif; hari ini
 * dan hari batas masih bisa dipilih, jam-nya yang diperiksa
 * `scheduleTimeConstraintMessage`.
 */
export function getScheduleCalendarBounds(
  now: Date,
  timeZone: string,
): { minKey: string; maxKey: string } {
  return {
    minKey: toDateKey(now, timeZone),
    maxKey: scheduleMaxDateKey(now, timeZone),
  };
}

/**
 * Kunci tanggal sebagai `Date` lokal tengah malam, hanya untuk dipakai
 * sebagai penampung hari kalender (react-day-picker bekerja dengan `Date`
 * lokal); bukan instan waktu. `undefined` bila kunci tidak sah.
 */
export function dateKeyToCalendarDate(
  key: string | undefined,
): Date | undefined {
  const parts = parseDateKey(key);
  if (!parts) {
    return undefined;
  }
  return new Date(parts.year, parts.month, parts.day);
}

/** Kebalikan `dateKeyToCalendarDate`: hari kalender lokal jadi "YYYY-MM-DD". */
export function calendarDateToDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Jam bawaan saat pemakai memilih tanggal sebelum mengisi jam (rancangan: 10:00). */
export const DEFAULT_SCHEDULE_TIME = "10:00";

/**
 * Hasil memilih tanggal di Calendar: tanggal baru, dan jam tetap bila sudah
 * ada, selain itu jam bawaan. Memilih ulang hari yang sama tidak menghapus
 * jadwal (Calendar single mode mengirim `undefined` saat klik hari terpilih;
 * itu diabaikan oleh pemanggil).
 */
export function pickScheduleDate(
  date: Date,
  currentTime: string | undefined,
): { date: string; time: string } {
  return {
    date: calendarDateToDateKey(date),
    time: isValidTime(currentTime) ? currentTime : DEFAULT_SCHEDULE_TIME,
  };
}
