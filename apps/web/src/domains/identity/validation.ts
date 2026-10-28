import { ValidationError } from "@/lib/utils/errors";

import { canonicalizeTimeZone } from "./time-zones";
import type { NotificationPreferencesRecord } from "./types";

/**
 * Shared profile/avatar validation constants — single source for both
 * client (ProfileForm) and server (IdentityService) so the two limits
 * can't drift apart (code-review finding, T-016.2).
 */
export const MAX_NAME_LENGTH = 100;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB, sesuai mockup account-profile.html

/** MIME type → file extension, dipakai untuk validasi format + naming path storage. */
export const ALLOWED_AVATAR_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const ALLOWED_AVATAR_ACCEPT = Object.keys(
  ALLOWED_AVATAR_MIME_TYPES,
).join(",");

/**
 * T-147 (ADR-146): zona dari klien hanya diterima bila nama IANA yang
 * dikenal runtime (`Intl.supportedValuesOf("timeZone")` + "UTC"); alias
 * IANA yang ditulis persis disimpan dalam bentuk kanonik runtime. Selain itu
 * ditolak, bukan disimpan.
 */
export function parseTimeZone(input: unknown): string {
  const canonical =
    typeof input === "string" ? canonicalizeTimeZone(input) : null;
  if (canonical === null) {
    throw new ValidationError("Zona waktu tidak valid.");
  }
  return canonical;
}

const NOTIFICATION_PREFERENCE_KEYS = [
  "notifyRepliesAndMentions",
  "notifyPublishSchedule",
  "notifyAnalyticsReport",
] as const satisfies readonly (keyof NotificationPreferencesRecord)[];

/**
 * T-016.4: Server Action menerima objek dari klien. Pastikan ketiga flag
 * boolean ada, lalu kembalikan objek baru yang hanya berisi ketiga field
 * itu — field yang absen tidak boleh lolos sebagai `undefined` (Prisma
 * akan menganggapnya "jangan ubah kolom ini").
 */
export function parseNotificationPreferences(
  input: unknown,
): NotificationPreferencesRecord {
  if (input === null || typeof input !== "object") {
    throw new ValidationError("Preferensi notifikasi tidak valid.");
  }

  const record = input as Record<string, unknown>;
  const parsed = {} as NotificationPreferencesRecord;

  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    const value = record[key];
    if (typeof value !== "boolean") {
      throw new ValidationError("Preferensi notifikasi tidak valid.");
    }
    parsed[key] = value;
  }

  return parsed;
}
