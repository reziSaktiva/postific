import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { IdentityService } from "@/domains/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { getCachedSession } from "@/lib/better-auth/session";
import { identityRepository } from "@/lib/repositories/identity";

import { ProfileForm } from "./components/ProfileForm";

export default async function Page() {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const identityService = new IdentityService(
    identityRepository,
    supabaseAvatarStorageAdapter,
  );
  const profile = await identityService.getProfile(asUserId(session.user.id));
  if (!profile) {
    redirect("/login");
  }

  return <ProfileForm profile={profile} />;
}
