"use server";

import { asNotificationId, asUserId } from "@postific/shared";
import { redirect } from "next/navigation";
import { NotificationService } from "@/domains/notification";
import { getCachedSession } from "@/lib/better-auth/session";
import { notificationRepository } from "@/lib/repositories/notification";

/**
 * Server Actions untuk panel notifikasi (T-036.4 backend — UI/Drawer
 * dikerjakan paralel oleh Mark UI Engineer). Hanya mutation (ADR-095) —
 * `list` dipanggil langsung dari Server Component (`layout.tsx`), bukan
 * lewat Server Action. Pola sama seperti
 * `apps/web/src/app/(app)/components/draft-editor/actions.ts`.
 */

export async function markNotificationReadAction(id: string): Promise<void> {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const service = new NotificationService(notificationRepository);
  await service.markAsRead(asNotificationId(id), asUserId(session.user.id));
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const service = new NotificationService(notificationRepository);
  await service.markAllAsRead(asUserId(session.user.id));
}
