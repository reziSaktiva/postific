import type { UserId } from "@postific/shared";

import type {
  NotificationPreferencesRecord,
  UserProfileRecord,
} from "../types";

/** Repository interface — implementation (Prisma) lives in src/lib/repositories/identity. */
export interface IIdentityRepository {
  findById(userId: UserId): Promise<UserProfileRecord | null>;

  /** Only fields present in `data` are updated; omitted fields are left untouched. */
  updateProfile(
    userId: UserId,
    data: { name?: string; image?: string },
  ): Promise<UserProfileRecord>;

  /** T-016.4: null = user tidak ditemukan. */
  findNotificationPreferences(
    userId: UserId,
  ): Promise<NotificationPreferencesRecord | null>;

  updateNotificationPreferences(
    userId: UserId,
    data: NotificationPreferencesRecord,
  ): Promise<NotificationPreferencesRecord>;
}
