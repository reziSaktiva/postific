import { getTimeZoneOffsetMs, zonedLocalToUtc } from "@/domains/publishing";

import { McpToolInputError } from "./tool-input";

/**
 * Tafsir waktu jadwal dari klien AI (T-168.1, ADR-146): ISO 8601 dengan
 * offset (`Z`, `+07:00`, `+0700`) dipakai apa adanya; tanpa offset
 * ditafsirkan sebagai jam dinding di `timeZone` pemilik koneksi
 * (`User.timeZone`). Detik opsional, pecahan detik dibuang. Tanggal yang tidak
 * ada di kalender (mis. 30 Februari) ditolak, bukan digulirkan ke bulan
 * berikutnya seperti `Date.parse`. Jam dinding yang TIDAK ADA karena DST
 * (spring-forward) ditolak, bukan digeser diam-diam (di zona timur UTC
 * `zonedLocalToUtc` menggesernya mundur sehingga post terbit lebih awal dari
 * yang diminta); klien diminta mengirim offset eksplisit. Jam yang ganda
 * (fall-back) mengikuti `zonedLocalToUtc` apa adanya (lihat `wib-time.ts`):
 * kemunculan pertama (New_York) atau kedua (Berlin), jadi klien yang butuh
 * kepastian di jam itu sebaiknya mengirim offset eksplisit. Waktu lebih dari
 * `MAX_YEARS_AHEAD` tahun ke depan ditolak sebagai tidak wajar.
 */
const SCHEDULED_AT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i;

const MAX_OFFSET_MINUTES = 14 * 60;

/** Batas atas wajar untuk jadwal; mencegah tahun absurd lolos sampai penyedia. */
const MAX_YEARS_AHEAD = 2;

function parseScheduledAtCore(
  value: unknown,
  timeZone: string,
  label: string,
): Date {
  const hint = `${label}: scheduledAt harus berupa waktu ISO 8601, mis. 2026-11-10T09:00:00 (jam di zona waktu pengguna) atau 2026-11-10T09:00:00+07:00.`;
  if (typeof value !== "string") {
    throw new McpToolInputError(hint);
  }
  const match = SCHEDULED_AT_PATTERN.exec(value.trim());
  if (!match) {
    throw new McpToolInputError(hint);
  }
  const [, y, mo, d, h, mi, s = "00", offset] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  const calendar = new Date(Date.UTC(year, month - 1, day));
  const validCalendar =
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day;
  if (!validCalendar || hour > 23 || minute > 59 || second > 59) {
    throw new McpToolInputError(
      `${label}: scheduledAt bukan tanggal atau jam yang valid.`,
    );
  }

  const date = `${y}-${mo}-${d}`;
  const time = `${h}:${mi}:${s}`;

  if (offset === undefined) {
    const utc = zonedLocalToUtc(date, time, timeZone);
    if (Number.isNaN(utc.getTime())) {
      throw new McpToolInputError(
        `${label}: scheduledAt bukan tanggal atau jam yang valid.`,
      );
    }
    // Jam yang tidak ada (DST spring-forward) tidak bisa kembali ke jam dinding
    // yang sama; tolak daripada menerbitkan di jam lain tanpa peringatan.
    const wall = new Date(utc.getTime() + getTimeZoneOffsetMs(utc, timeZone));
    if (wall.toISOString().slice(0, 19) !== `${date}T${time}`) {
      throw new McpToolInputError(
        `${label}: jam ${h}:${mi} tanggal ${date} tidak ada di zona waktu ${timeZone} (perpindahan DST). Kirim offset eksplisit (mis. +02:00) atau pilih jam lain.`,
      );
    }
    return utc;
  }

  if (offset.toUpperCase() === "Z") {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }
  const sign = offset.startsWith("-") ? -1 : 1;
  const digits = offset.slice(1).replace(":", "");
  const offsetMinutes =
    sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
  if (
    Math.abs(offsetMinutes) > MAX_OFFSET_MINUTES ||
    Number(digits.slice(2)) > 59
  ) {
    throw new McpToolInputError(
      `${label}: offset waktu pada scheduledAt tidak valid.`,
    );
  }
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second) -
      offsetMinutes * 60_000,
  );
}

/** Tafsir `scheduledAt` lalu tolak tahun yang tidak wajar (lihat komentar di atas). */
export function parseScheduledAt(
  value: unknown,
  timeZone: string,
  label: string,
  now: Date = new Date(),
): Date {
  const parsed = parseScheduledAtCore(value, timeZone, label);
  const limit = new Date(now.getTime());
  limit.setUTCFullYear(limit.getUTCFullYear() + MAX_YEARS_AHEAD);
  if (parsed.getTime() > limit.getTime()) {
    throw new McpToolInputError(
      `${label}: scheduledAt terlalu jauh di masa depan (maksimum ${MAX_YEARS_AHEAD} tahun dari sekarang).`,
    );
  }
  return parsed;
}
