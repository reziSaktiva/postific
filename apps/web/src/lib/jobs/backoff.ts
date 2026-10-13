/**
 * T-027.3 — exponential backoff (BG-D04, `background-jobs.md` §
 * "Retry Strategy").
 *
 * **Ketidaksesuaian di dokumen sumber (dilaporkan ke King Rezi, bukan
 * diputuskan diam-diam — AGENTS.md "kalau menemukan gap/inkonsistensi...
 * laporkan ke user"):** `background-jobs.md` mencantumkan DUA sumber yang
 * saling bertentangan untuk delay yang sama:
 * - Tabel eksplisit (§ "Exponential Backoff") DAN prosa JOB-01 (§ "Job Type
 *   Registry") berdua bilang **5 menit, 15 menit, 60 menit**.
 * - Formula di baris yang sama (`delay = base_delay * 2^(attempts-1)`,
 *   `base_delay = 5 menit`) sebenarnya menghasilkan **5, 10, 20 menit** —
 *   TIDAK match tabelnya sendiri.
 *
 * Implementasi ini memakai angka tabel eksplisit (5/15/60), bukan
 * formulanya — dua sumber independen di dokumen yang sama (tabel + prosa
 * JOB-01) sepakat di angka itu, sementara formula cuma satu baris yang
 * kontradiktif dengan keduanya.
 */
const RETRY_DELAY_MINUTES = [5, 15, 60] as const;

/**
 * `attempts` — jumlah percobaan SETELAH kegagalan ini (1-based: 1 = baru
 * gagal pertama kali). Mengembalikan delay dalam milliseconds sebelum job
 * boleh dieksekusi ulang. `attempts` melebihi panjang tabel (seharusnya
 * tidak pernah terjadi selama `maxAttempts` default 4 — lihat
 * `BackgroundJob.maxAttempts` di schema.prisma, harus tetap 1 lebih besar
 * dari panjang tabel ini supaya tier delay terakhir benar-benar
 * terpakai sebelum dead-letter) memakai delay terakhir sebagai fallback,
 * bukan throw.
 */
export function retryDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), RETRY_DELAY_MINUTES.length) - 1;
  return RETRY_DELAY_MINUTES[index] * 60_000;
}
