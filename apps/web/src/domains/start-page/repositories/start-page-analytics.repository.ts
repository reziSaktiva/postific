/**
 * Port analytics publik Start Page (T-074). Jalur ANONIM seperti
 * `IPublicStartPageRepository` (tanpa session/workspace), diimplementasi
 * lewat fungsi SECURITY DEFINER sempit (pola ADR-142) — hanya menaikkan
 * counter, tanpa PII, tanpa tabel event.
 */
export interface IStartPageAnalyticsRepository {
  /** +1 `view_count` bila halaman published. `false` bila slug tak ada/draft. */
  recordView(slug: string): Promise<boolean>;

  /**
   * Atomik: bila tautan AKTIF milik halaman PUBLISHED dengan `slug` itu dan
   * berskema http(s), +1 `click_count` dan kembalikan URL-nya; selain itu
   * `null` (tidak ada efek). Nilai kembalian BELUM tentu aman — caller wajib
   * memvalidasi ulang sebelum redirect.
   */
  recordClickAndGetUrl(slug: string, linkId: string): Promise<string | null>;
}
