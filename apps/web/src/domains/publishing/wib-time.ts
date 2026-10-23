/**
 * Zona waktu tampilan Publish (T-144) — Asia/Jakarta (WIB, UTC+7 tetap,
 * tanpa DST). Belum ada timezone per workspace, jadi satu konstanta ini
 * dipakai bersama untuk kunci tanggal grup (History/Queue), rentang
 * Calendar, jam kartu, dan semua formatter tampilan. Penyimpanan DB tetap
 * UTC; yang berubah hanya cara tanggal/jam dihitung dan ditampilkan.
 *
 * Pure function, tanpa I/O, aman dipakai server maupun client component.
 */

export const WIB_TIME_ZONE = "Asia/Jakarta";

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Geser instan ke "jam dinding WIB yang dipetakan ke field UTC" — field
 * `getUTC*` dari hasilnya adalah tahun/bulan/tanggal/jam WIB.
 */
function toWibWallClock(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

/** Kunci tanggal kalender WIB "YYYY-MM-DD" dari sebuah instan. */
export function toWibDateKey(date: Date): string {
  return toWibWallClock(date).toISOString().slice(0, 10);
}

/** Jam WIB (0-23) dari sebuah instan. */
export function getWibHour(date: Date): number {
  return toWibWallClock(date).getUTCHours();
}

/** Komponen tanggal WIB; `month` 0-based, `weekday` 0 (Minggu) - 6 (Sabtu). */
export function getWibDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const wall = toWibWallClock(date);
  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth(),
    day: wall.getUTCDate(),
    weekday: wall.getUTCDay(),
  };
}

/**
 * Instan UTC untuk 00:00:00.000 WIB pada tanggal kalender
 * `year-month-day` (`month` 0-based; `day` boleh overflow/negatif, dinormalisasi
 * `Date.UTC`).
 */
export function wibMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS);
}

/** Awal hari WIB (00:00:00.000 WIB) yang memuat `date`. */
export function startOfWibDay(date: Date): Date {
  const { year, month, day } = getWibDateParts(date);
  return wibMidnightUtc(year, month, day);
}
