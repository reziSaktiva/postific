"use server";

import { asUserId } from "@postific/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  IdentityService,
  type NotificationPreferencesRecord,
} from "@/domains/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { auth } from "@/lib/better-auth/auth";
import { identityRepository } from "@/lib/repositories/identity";
import { toActionError } from "@/lib/utils/errors";

export type UpdateNotificationPreferencesActionResult =
  | { ok: false; error: string }
  | { ok: true; preferences: NotificationPreferencesRecord };

export async function updateNotificationPreferencesAction(
  preferences: NotificationPreferencesRecord,
): Promise<UpdateNotificationPreferencesActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const identityService = new IdentityService(
    identityRepository,
    supabaseAvatarStorageAdapter,
  );

  try {
    const updated = await identityService.updateNotificationPreferences(
      asUserId(session.user.id),
      preferences,
    );

    return { ok: true, preferences: updated };
  } catch (error) {
    try {
      return { ok: false, error: toActionError(error).error };
    } catch {
      console.error(
        "[updateNotificationPreferencesAction] gagal update preferensi notifikasi:",
        error,
      );
      return { ok: false, error: "Gagal menyimpan preferensi. Coba lagi." };
    }
  }
}
