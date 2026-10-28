import { asUserId } from "@postific/shared";
import type { IIdentityRepository, TimeZoneSource } from "@/domains/identity";
import { prisma } from "@/lib/prisma/client";

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  timeZone: true,
  timeZoneSource: true,
} as const;

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timeZone: string;
  timeZoneSource: string;
};

function toProfileRecord(user: ProfileRow) {
  return {
    id: asUserId(user.id),
    name: user.name,
    email: user.email,
    image: user.image,
    timeZone: user.timeZone,
    // Kolom String di DB; nilai selalu ditulis lewat service (tervalidasi).
    timeZoneSource: user.timeZoneSource as TimeZoneSource,
  };
}

const NOTIFICATION_PREFERENCES_SELECT = {
  notifyRepliesAndMentions: true,
  notifyPublishSchedule: true,
  notifyAnalyticsReport: true,
} as const;

export const identityRepository: IIdentityRepository = {
  async findById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    if (!user) {
      return null;
    }

    return toProfileRecord(user);
  },

  async updateProfile(userId, data) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.image !== undefined ? { image: data.image } : {}),
        ...(data.timeZone !== undefined ? { timeZone: data.timeZone } : {}),
        ...(data.timeZoneSource !== undefined
          ? { timeZoneSource: data.timeZoneSource }
          : {}),
      },
      select: PROFILE_SELECT,
    });

    return toProfileRecord(user);
  },

  async applyDetectedTimeZone(userId, timeZone) {
    // `updateMany` dengan syarat "pending" = satu kali & atomik: dua tab yang
    // mendeteksi bersamaan tidak saling menimpa, pilihan manual tak tersentuh.
    const { count } = await prisma.user.updateMany({
      where: { id: userId, timeZoneSource: "pending" },
      data: { timeZone, timeZoneSource: "detected" },
    });
    if (count === 0) {
      return null;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    return user ? toProfileRecord(user) : null;
  },

  async findNotificationPreferences(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: NOTIFICATION_PREFERENCES_SELECT,
    });

    return user ?? null;
  },

  async updateNotificationPreferences(userId, data) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        notifyRepliesAndMentions: data.notifyRepliesAndMentions,
        notifyPublishSchedule: data.notifyPublishSchedule,
        notifyAnalyticsReport: data.notifyAnalyticsReport,
      },
      select: NOTIFICATION_PREFERENCES_SELECT,
    });
  },
};
