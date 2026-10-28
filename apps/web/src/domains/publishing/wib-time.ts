/**
 * Helper waktu berzona (T-144 → T-147, ADR-146). Awalnya hard-code WIB
 * (T-144); sejak T-147 semua fungsi menerima zona IANA sebagai parameter
 * (mis. "Asia/Jakarta", "America/New_York") dan mengukur offset sebenarnya
 * lewat `Intl.DateTimeFormat`, sehingga DST dan offset setengah jam
 * (Asia/Kolkata) ikut benar. Penyimpanan DB tetap UTC; yang berubah hanya
 * cara tanggal/jam dihitung, ditampilkan, dan ditafsirkan input jadwal.
 *
 * Zona SENGAJA tanpa default tersembunyi di tiap fungsi — pemanggil wajib
 * menyebutnya eksplisit supaya callsite yang terlewat langsung terlihat
 * (tipe error), bukan diam-diam jatuh ke WIB. `WIB_TIME_ZONE` tetap ada
 * sebagai zona default (nilai awal pengguna, MCP).
 *
 * Nama file `wib-time.ts` dipertahankan agar jalur impor tidak berubah.
 * Pure function, tanpa I/O, aman dipakai server maupun client component.
 */

/** Zona default (nilai awal pengguna, ADR-146 poin 4). */
export const WIB_TIME_ZONE = "Asia/Jakarta";

/**
 * Offset WIB tetap (+7, tanpa DST). Hanya untuk konsumen yang SENGAJA
 * tetap WIB (MCP `lib/mcp/format.ts`) — kode zona-pengguna memakai fungsi
 * berparameter zona di bawah.
 */
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * `Intl.DateTimeFormat` ter-cache per zona (konstruksinya mahal; dipakai
 * ribuan kali saat mengelompokkan item). Melempar `RangeError` untuk nama
 * zona tidak valid.
 */
function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export { isValidTimeZone } from "@/lib/time/is-valid-time-zone";

interface WallClock {
  year: number;
  month: number; // 0-based
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getWallClock(date: Date, timeZone: string): WallClock {
  const parts = getFormatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: read("year"),
    month: read("month") - 1,
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Offset zona terhadap UTC (ms, positif = timur UTC) pada instan `date`.
 * Presisi detik: milidetik dibuang sebelum dibandingkan.
 */
export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const wall = getWallClock(date, timeZone);
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  const instantSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return wallAsUtc - instantSeconds;
}

/**
 * Instan UTC untuk jam dinding `wallAsUtc` (field `getUTC*` = jam dinding)
 * di `timeZone`. Dua putaran supaya benar di sekitar perpindahan DST; jam
 * yang tidak ada (spring-forward) bergeser maju, jam ganda (fall-back)
 * memakai kemunculan pertama. Berlaku untuk perpindahan DST 1 jam; zona
 * dengan DST 30 menit (Australia/Lord_Howe) bisa menyimpang sampai 30 menit
 * pada jam dinding yang tidak ada/ganda.
 */
function wallClockToUtc(wallAsUtcMs: number, timeZone: string): Date {
  const firstGuess =
    wallAsUtcMs - getTimeZoneOffsetMs(new Date(wallAsUtcMs), timeZone);
  const offsetAtGuess = getTimeZoneOffsetMs(new Date(firstGuess), timeZone);
  const secondGuess = wallAsUtcMs - offsetAtGuess;
  // Jam dinding yang tidak ada (spring-forward): tebakan kedua mendarat di
  // jam sebelum celah; pakai tebakan pertama yang jatuh sesudah celah.
  if (getTimeZoneOffsetMs(new Date(secondGuess), timeZone) === offsetAtGuess) {
    return new Date(secondGuess);
  }
  return new Date(firstGuess);
}

/** Kunci tanggal kalender "YYYY-MM-DD" di `timeZone` dari sebuah instan. */
export function toDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = getWallClock(date, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Jam dinding (0-23) di `timeZone` dari sebuah instan. */
export function getHour(date: Date, timeZone: string): number {
  return getWallClock(date, timeZone).hour;
}

/** Komponen tanggal di `timeZone`; `month` 0-based, `weekday` 0 (Minggu) - 6 (Sabtu). */
export function getDateParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const { year, month, day } = getWallClock(date, timeZone);
  return {
    year,
    month,
    day,
    weekday: new Date(Date.UTC(year, month, day)).getUTCDay(),
  };
}

/**
 * Instan UTC untuk 00:00:00.000 di `timeZone` pada tanggal kalender
 * `year-month-day` (`month` 0-based; `day` boleh overflow/negatif,
 * dinormalisasi `Date.UTC`).
 */
export function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  return wallClockToUtc(Date.UTC(year, month, day), timeZone);
}

/** Awal hari (00:00:00.000 di `timeZone`) yang memuat `date`. */
export function startOfDay(date: Date, timeZone: string): Date {
  const { year, month, day } = getDateParts(date, timeZone);
  return zonedMidnightUtc(year, month, day, timeZone);
}

/**
 * Tafsirkan input tanggal+jam picker jadwal (T-146) sebagai waktu dinding
 * di `timeZone` (zona pengguna, ADR-146), bukan zona browser. `date`
 * "YYYY-MM-DD", `time` "HH:mm" (atau "HH:mm:ss"). Input tak valid
 * menghasilkan `Invalid Date` (sama seperti `new Date(...)`), jadi pemanggil
 * tetap memakai pola `Number.isNaN(getTime())`. Nama zona tak valid
 * melempar `RangeError`.
 */
export function zonedLocalToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const wallAsUtcMs = Date.parse(`${date}T${time}Z`);
  if (Number.isNaN(wallAsUtcMs)) {
    // Tetap validasi zona supaya nama tak valid tidak tersembunyi oleh
    // input tak valid.
    getFormatter(timeZone);
    return new Date(Number.NaN);
  }
  return wallClockToUtc(wallAsUtcMs, timeZone);
}
