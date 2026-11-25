import { getDateParts, zonedMidnightUtc } from "@/domains/publishing";

/**
 * Geser `date` sejumlah hari KALENDER di `timeZone` dan kembalikan 00:00 hari
 * itu. Bukan `+ n * 24 jam`: pada hari DST (23/25 jam) tambah 24 jam
 * mendarat di tanggal yang salah.
 */
export function addDays(date: Date, days: number, timeZone: string): Date {
  const { year, month, day } = getDateParts(date, timeZone);
  return zonedMidnightUtc(year, month, day + days, timeZone);
}

/**
 * Geser `date` sejumlah bulan kalender di `timeZone`, dipatok ke tanggal 1 (bukan
 * mempertahankan tanggal-di-bulan) supaya aman dari overflow bulan
 * pendek — 31 Jan + 1 bulan via `Date.UTC` day-preserving akan lompat ke
 * 3 Maret, bukan akhir Februari. Anchor Calendar hanya perlu jatuh di
 * bulan yang benar (`getMonthRange`/`getWeekRange` yang menghitung rentang
 * sebenarnya), jadi tanggal-di-dalam-bulan tidak relevan di sini.
 */
export function addMonths(date: Date, months: number, timeZone: string): Date {
  const { year, month } = getDateParts(date, timeZone);
  return zonedMidnightUtc(year, month + months, 1, timeZone);
}
