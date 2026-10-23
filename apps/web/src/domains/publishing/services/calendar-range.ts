import { getWibDateParts, MS_PER_DAY, wibMidnightUtc } from "../wib-time";

/**
 * Rentang tanggal Week/Month Calendar (T-033.3/.4, KSP-02) — dipakai
 * composition root (`page.tsx`) untuk menghitung `from`/`to`
 * `PublishingService.listCalendarPosts` dari anchor `date` hasil
 * `parseCalendarViewState` (T-033.2). Pure function, tanpa I/O.
 *
 * Kalender WIB / Asia/Jakarta (T-144, `../wib-time`): batas hari adalah
 * 00:00 WIB (= 17:00 UTC hari sebelumnya), konsisten dengan kunci grup
 * `groupQueueItemsByDate`/`groupHistoryItemsByDate`. Minggu dimulai
 * **Senin** (mockup Claude Design `templates/publish-calendar.html`:
 * kolom Sen-Sel-Rab-Kam-Jum-Sab-Ming).
 */

/**
 * Rentang Week yang memuat `date`: Senin 00:00:00.000 WIB s.d. Minggu
 * 23:59:59.999 WIB. Padding hari dari minggu sebelum/sesudah di grid
 * tidak relevan di sini — grid Week menampilkan tepat 7 hari, tidak ada
 * sel "muted" seperti Month.
 */
export function getWeekRange(date: Date): { from: Date; to: Date } {
  const { year, month, day, weekday } = getWibDateParts(date); // weekday 0 (Minggu) - 6 (Sabtu)
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;

  const from = wibMidnightUtc(year, month, day + offsetToMonday);
  const to = new Date(from.getTime() + 7 * MS_PER_DAY - 1);

  return { from, to };
}

/**
 * Rentang Month yang memuat `date`: tanggal 1 00:00:00.000 WIB s.d. hari
 * terakhir bulan 23:59:59.999 WIB. Tidak diperluas ke hari padding
 * bulan sebelum/sesudah yang tampil "muted" di grid Month — sel itu
 * sengaja kosong by design (Buffer-style), bukan menampilkan post dari
 * bulan lain (keputusan produk, lihat catatan task T-033.3/.4).
 *
 * Akhir bulan = 1 ms sebelum 00:00 WIB tanggal 1 bulan berikutnya —
 * menangani Februari 28/29 hari maupun pergantian tahun tanpa kondisional.
 */
export function getMonthRange(date: Date): { from: Date; to: Date } {
  const { year, month } = getWibDateParts(date);
  const from = wibMidnightUtc(year, month, 1);
  const to = new Date(wibMidnightUtc(year, month + 1, 1).getTime() - 1);

  return { from, to };
}
