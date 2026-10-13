"use server";

import { asUserId } from "@postific/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { IdentityService } from "@/domains/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { auth } from "@/lib/better-auth/auth";
import { identityRepository } from "@/lib/repositories/identity";
import { ExternalServiceError, toActionError } from "@/lib/utils/errors";

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
    // CC-D02 (KI-036): `ValidationError` dan `ApplicationError` lain yang
    // pesannya memang untuk user lewat `toActionError()`. `ExternalServiceError`
    // dari upload avatar menyertakan teks provider (bucket, path, policy) —
    // itu tidak boleh sampai ke ProfileForm. Pesan generik + log server,
    // sama seperti error yang bukan `ApplicationError`.
    if (error instanceof ExternalServiceError) {
      console.error("[updateProfileAction] gagal update profil:", error);
      return { ok: false, error: "Gagal menyimpan profil. Coba lagi." };
    }
    try {
      return { ok: false, error: toActionError(error).error };
    } catch {
      console.error("[updateProfileAction] gagal update profil:", error);
      return { ok: false, error: "Gagal menyimpan profil. Coba lagi." };
    }
  }
}
