/**
 * Awal hari UTC. Dipakai fan-out harian (JOB-04 analytics, JOB-05 import)
 * supaya "sudah dijadwalkan hari ini" dihitung dari tengah malam UTC,
 * bukan dari zona waktu proses.
 */
export function startOfUtcDay(now: Date): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}
