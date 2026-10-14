import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { IdentityService } from "@/domains/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { getCachedSession } from "@/lib/better-auth/session";
import { identityRepository } from "@/lib/repositories/identity";

import { NotificationPreferencesForm } from "./components/NotificationPreferencesForm";

export default async function Page() {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const identityService = new IdentityService(
    identityRepository,
    supabaseAvatarStorageAdapter,
  );
  const preferences = await identityService.getNotificationPreferences(
    asUserId(session.user.id),
  );
  if (!preferences) {
    redirect("/login");
  }

  return <NotificationPreferencesForm preferences={preferences} />;
}
