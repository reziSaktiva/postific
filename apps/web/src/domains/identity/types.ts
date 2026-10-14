import type { UserId } from "@postific/shared";

/** Domain-specific types for identity. */

export interface UserProfileRecord {
  id: UserId;
  name: string;
  email: string;
  image: string | null;
}

/**
 * T-016.4: preferensi notifikasi email user. 3 toggle sesuai rancangan
 * Claude Design (`templates/settings-notifications.html`).
 */
export interface NotificationPreferencesRecord {
  notifyRepliesAndMentions: boolean;
  notifyPublishSchedule: boolean;
  notifyAnalyticsReport: boolean;
}
