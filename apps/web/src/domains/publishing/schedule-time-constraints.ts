import { PublishingDomainError } from "./errors";

/**
 * T-108 (KI-044): tidak ada validasi yang mencegah user men-Schedule post ke
 * waktu yang sudah lewat — baik tanggal hari ini dengan jam yang sudah lewat
 * (mis. jadwalkan jam 08:00 padahal sekarang jam 11:48) maupun tanggal di
 * masa lalu sama sekali (date picker `Modal.tsx` tidak punya batas `min`).
 * Post lolos ke Queue tanpa penolakan/warning apa pun.
 *
 * Perbandingan dilakukan terhadap detik penuh (bukan `<=` murni ke
 * millisecond `now`) supaya submit yang terjadi persis di detik yang sama
 * dengan waktu terjadwal tidak ditolak karena selisih milidetik semata —
 * mirror pola `pinterestBoardConstraintMessage`/`minMediaCountConstraintMessage`
 * (`xxxConstraintMessage` untuk client, `assertXxx` untuk server, satu
 * sumber pesan yang sama untuk keduanya).
 */
export const SCHEDULE_TIME_IN_PAST_MESSAGE =
  "Waktu yang dipilih sudah lewat. Pilih tanggal atau jam yang akan datang.";

export function scheduleTimeConstraintMessage(
  scheduledAt: Date,
  now: Date = new Date(),
): string | null {
  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }
  const scheduledAtSeconds = Math.floor(scheduledAt.getTime() / 1000);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (scheduledAtSeconds <= nowSeconds) {
    return SCHEDULE_TIME_IN_PAST_MESSAGE;
  }
  return null;
}

/**
 * Defense-in-depth (T-108.2) — dipanggil di `SchedulePostsUseCase.execute`,
 * bukan hanya diandalkan dari validasi client di `Modal.tsx`.
 */
export function assertScheduledAtNotInPast(
  scheduledAt: Date,
  now: Date = new Date(),
): void {
  const message = scheduleTimeConstraintMessage(scheduledAt, now);
  if (message) {
    throw new PublishingDomainError(message);
  }
}
