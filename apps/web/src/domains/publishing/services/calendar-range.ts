import { getDateParts, zonedMidnightUtc } from "../wib-time";

/**
 * Rentang tanggal Week/Month Calendar (T-033.3/.4, KSP-02) — dipakai
 * composition root (`page.tsx`) untuk menghitung `from`/`to`
 * `PublishingService.listCalendarPosts` dari anchor `date` hasil
 * `parseCalendarViewState` (T-033.2). Pure function, tanpa I/O.
 *
 * Kalender di zona waktu pengguna (T-147, `../wib-time`; zona IANA eksplisit):
 * batas hari adalah 00:00 di zona itu, konsisten dengan kunci grup
 * `groupQueueItemsByDate`/`groupHistoryItemsByDate`. Minggu dimulai
 * **Senin** (mockup Claude Design `templates/publish-calendar.html`:
 * kolom Sen-Sel-Rab-Kam-Jum-Sab-Ming).
 */

/**
 * Rentang Week yang memuat `date`: Senin 00:00:00.000 s.d. Minggu
 * 23:59:59.999 di zona pengguna. Padding hari dari minggu sebelum/sesudah di grid
 * tidak relevan di sini — grid Week menampilkan tepat 7 hari, tidak ada
 * sel "muted" seperti Month.
 */
export function getWeekRange(
  date: Date,
  timeZone: string,
): { from: Date; to: Date } {
  const { year, month, day, weekday } = getDateParts(date, timeZone); // weekday 0 (Minggu) - 6 (Sabtu)
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;

  const from = zonedMidnightUtc(year, month, day + offsetToMonday, timeZone);
  // Akhir = 1 ms sebelum Senin berikutnya (bukan from + 7 * 24 jam) supaya
  // minggu yang melewati perpindahan DST tetap tepat (23 atau 25 jam sehari).
  const to = new Date(
    zonedMidnightUtc(
      year,
      month,
      day + offsetToMonday + 7,
      timeZone,
    ).getTime() - 1,
  );

  return { from, to };
}

/**
 * Rentang Month yang memuat `date`: tanggal 1 00:00:00.000 s.d. hari
 * terakhir bulan 23:59:59.999 di zona pengguna. Tidak diperluas ke hari padding
 * bulan sebelum/sesudah yang tampil "muted" di grid Month — sel itu
 * sengaja kosong by design (Buffer-style), bukan menampilkan post dari
 * bulan lain (keputusan produk, lihat catatan task T-033.3/.4).
 *
 * Akhir bulan = 1 ms sebelum 00:00 tanggal 1 bulan berikutnya —
 * menangani Februari 28/29 hari maupun pergantian tahun tanpa kondisional.
 */
export function getMonthRange(
  date: Date,
  timeZone: string,
): { from: Date; to: Date } {
  const { year, month } = getDateParts(date, timeZone);
  const from = zonedMidnightUtc(year, month, 1, timeZone);
  const to = new Date(
    zonedMidnightUtc(year, month + 1, 1, timeZone).getTime() - 1,
  );

  return { from, to };
}
