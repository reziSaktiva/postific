import type { UserId } from "@postific/shared";

/** Domain-specific types for identity. */

export interface UserProfileRecord {
  id: UserId;
  name: string;
  email: string;
  image: string | null;
  /** T-147 (ADR-146): zona waktu IANA pengguna, mis. "Asia/Jakarta". */
  timeZone: string;
  timeZoneSource: TimeZoneSource;
}

/**
 * T-147: asal nilai `timeZone`. "pending" = pengguna baru yang belum
 * terdeteksi (auto-deteksi browser boleh jalan SEKALI); "legacy" = pengguna
 * lama sebelum T-147 (default WIB, tidak dideteksi diam-diam); "detected" =
 * hasil deteksi browser; "manual" = dipilih sendiri di Settings → Profile.
 */
export const TIME_ZONE_SOURCES = [
  "pending",
  "legacy",
  "detected",
  "manual",
] as const;
export type TimeZoneSource = (typeof TIME_ZONE_SOURCES)[number];

/**
 * T-016.4: preferensi notifikasi email user. 3 toggle sesuai rancangan
 * Claude Design (`templates/settings-notifications.html`).
 */
export interface NotificationPreferencesRecord {
  notifyRepliesAndMentions: boolean;
  notifyPublishSchedule: boolean;
  notifyAnalyticsReport: boolean;
}
