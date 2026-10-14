import { asUserId } from "@postific/shared";
import type { IIdentityRepository } from "@/domains/identity";
import { prisma } from "@/lib/prisma/client";

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

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

    return {
      id: asUserId(user.id),
      name: user.name,
      email: user.email,
      image: user.image,
    };
  },

  async updateProfile(userId, data) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.image !== undefined ? { image: data.image } : {}),
      },
      select: PROFILE_SELECT,
    });

    return {
      id: asUserId(user.id),
      name: user.name,
      email: user.email,
      image: user.image,
    };
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
