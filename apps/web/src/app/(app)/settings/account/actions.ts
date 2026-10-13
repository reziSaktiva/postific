"use server";

import { asUserId } from "@postific/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { IdentityService } from "@/domains/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { auth } from "@/lib/better-auth/auth";
import { identityRepository } from "@/lib/repositories/identity";
import { toActionError } from "@/lib/utils/errors";

export type UpdateProfileActionResult =
  | { ok: false; error: string }
  | { ok: true; name: string; image: string | null };

export async function updateProfileAction(
  formData: FormData,
): Promise<UpdateProfileActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "");
  const avatar = formData.get("avatar");
  const avatarFile = avatar instanceof File && avatar.size > 0 ? avatar : null;

  const identityService = new IdentityService(
    identityRepository,
    supabaseAvatarStorageAdapter,
  );

  try {
    const profile = await identityService.updateProfile({
      userId: asUserId(session.user.id),
      name,
      avatarFile: avatarFile
        ? {
            buffer: Buffer.from(await avatarFile.arrayBuffer()),
            contentType: avatarFile.type,
          }
        : null,
    });

    return { ok: true, name: profile.name, image: profile.image };
  } catch (error) {
    // CC-D02 (KI-036): pakai `toActionError()` yang sama dengan Server
    // Action lain (bukan `instanceof ValidationError` manual) supaya seluruh
    // `ApplicationError` (termasuk `ExternalServiceError` dari upload avatar
    // gagal, pola sama `engage/actions.ts`) memetakan pesan yang sama
    // konsisten — `toActionError` sendiri yang rethrow untuk error non-
    // `ApplicationError`, ditangkap di sini supaya ProfileForm tetap selalu
    // menerima `{ok:false}` (bukan exception tak tertangani) untuk error
    // yang benar-benar tak terduga.
    try {
      return { ok: false, error: toActionError(error).error };
    } catch {
      console.error("[updateProfileAction] gagal update profil:", error);
      return { ok: false, error: "Gagal menyimpan profil. Coba lagi." };
    }
  }
}
