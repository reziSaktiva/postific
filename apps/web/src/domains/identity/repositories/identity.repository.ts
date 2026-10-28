import type { UserId } from "@postific/shared";

import type {
  NotificationPreferencesRecord,
  TimeZoneSource,
  UserProfileRecord,
} from "../types";

/** Repository interface — implementation (Prisma) lives in src/lib/repositories/identity. */
export interface IIdentityRepository {
  findById(userId: UserId): Promise<UserProfileRecord | null>;

  /** Only fields present in `data` are updated; omitted fields are left untouched. */
  updateProfile(
    userId: UserId,
    data: {
      name?: string;
      image?: string;
      timeZone?: string;
      timeZoneSource?: TimeZoneSource;
    },
  ): Promise<UserProfileRecord>;

  /**
   * T-147: simpan zona hasil deteksi browser HANYA bila `timeZoneSource`
   * masih "pending" (satu kali, atomik). Mengembalikan profil terbaru, atau
   * `null` bila tidak ada baris yang berubah (sudah terdeteksi/diatur).
   */
  applyDetectedTimeZone(
    userId: UserId,
    timeZone: string,
  ): Promise<UserProfileRecord | null>;

  /** T-016.4: null = user tidak ditemukan. */
  findNotificationPreferences(
    userId: UserId,
  ): Promise<NotificationPreferencesRecord | null>;

  updateNotificationPreferences(
    userId: UserId,
    data: NotificationPreferencesRecord,
  ): Promise<NotificationPreferencesRecord>;
}
