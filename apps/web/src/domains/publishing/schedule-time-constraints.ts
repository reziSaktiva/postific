import { PublishingDomainError } from "./errors";
import { MS_PER_DAY, toDateKey } from "./wib-time";

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

/**
 * ADR-154 (KI-105): Outstand menolak `scheduledAt` lebih dari 30 hari ke
 * depan dengan HTTP 400 dan tidak membuat post (`outstand.so/docs/create-a-post`).
 * Ditolak di Postific sebelum memanggil Outstand.
 */
export const SCHEDULE_MAX_DAYS_AHEAD = 30;

/** Waktu terjauh yang boleh dijadwalkan relatif terhadap `now`. */
export function scheduleLatestAllowed(now: Date = new Date()): Date {
  return new Date(now.getTime() + SCHEDULE_MAX_DAYS_AHEAD * MS_PER_DAY);
}

/**
 * Tanggal terjauh ("YYYY-MM-DD" di `timeZone`) untuk atribut `max` input
 * tanggal, supaya hari di luar batas tidak bisa dipilih di kalender.
 */
export function scheduleMaxDateKey(
  now: Date = new Date(),
  timeZone: string = "UTC",
): string {
  return toDateKey(scheduleLatestAllowed(now), timeZone);
}

const LIMIT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * "28 Oct 2026 18:48 (Asia/Jakarta)". Dirakit dari `formatToParts` supaya
 * tidak bergantung pada pola locale ICU (versi baru menyisipkan "at").
 */
function formatLimit(limit: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(limit);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const month = LIMIT_MONTHS[Number(part("month")) - 1] ?? part("month");
  return `${part("day")} ${month} ${part("year")} ${part("hour")}:${part("minute")} (${timeZone})`;
}

/**
 * `null` kalau jadwal valid; selain itu pesan untuk Alert (client) dan galat
 * (server). Pesan batas atas menyebut batas tepat (tanggal + jam).
 */
export function scheduleTimeConstraintMessage(
  scheduledAt: Date,
  now: Date = new Date(),
  timeZone: string = "UTC",
): string | null {
  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }
  const scheduledAtSeconds = Math.floor(scheduledAt.getTime() / 1000);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (scheduledAtSeconds <= nowSeconds) {
    return SCHEDULE_TIME_IN_PAST_MESSAGE;
  }
  const limit = scheduleLatestAllowed(now);
  if (scheduledAtSeconds > Math.floor(limit.getTime() / 1000)) {
    return `Jadwal maksimal ${SCHEDULE_MAX_DAYS_AHEAD} hari dari sekarang. Pilih waktu paling lambat ${formatLimit(limit, timeZone)}.`;
  }
  return null;
}

/**
 * Defense-in-depth (T-108.2, T-198) — dipanggil di
 * `SchedulePostsUseCase.execute`, bukan hanya diandalkan dari validasi client
 * di `Modal.tsx`. Menolak jadwal yang sudah lewat DAN yang lebih dari
 * `SCHEDULE_MAX_DAYS_AHEAD` hari ke depan.
 */
export function assertScheduledAtAllowed(
  scheduledAt: Date,
  now: Date = new Date(),
  timeZone: string = "UTC",
): void {
  const message = scheduleTimeConstraintMessage(scheduledAt, now, timeZone);
  if (message) {
    throw new PublishingDomainError(message);
  }
}
