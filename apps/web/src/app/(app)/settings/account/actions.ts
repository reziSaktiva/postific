"use server";

import { asUserId } from "@postific/shared";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { IdentityService, type TimeZoneSource } from "@/domains/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { auth } from "@/lib/better-auth/auth";
import { identityRepository } from "@/lib/repositories/identity";
import { ExternalServiceError, toActionError } from "@/lib/utils/errors";

export type UpdateProfileActionResult =
  | { ok: false; error: string }
  | {
      ok: true;
      name: string;
      image: string | null;
      timeZone: string;
      timeZoneSource: TimeZoneSource;
    };

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
  // T-147: field zona opsional; tidak ada = zona tidak diubah. Validasi
  // otoritatif (daftar zona IANA) di IdentityService.
  const timeZoneField = formData.get("timeZone");
  const timeZone =
    typeof timeZoneField === "string" && timeZoneField.length > 0
      ? timeZoneField
      : undefined;
  const timeZoneSource =
    formData.get("timeZoneSource") === "detected" ? "detected" : "manual";

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
      timeZone,
      timeZoneSource,
    });

    if (timeZone !== undefined) {
      // Zona mempengaruhi tampilan di seluruh app (layout membaca zona).
      revalidatePath("/", "layout");
    }

    return {
      ok: true,
      name: profile.name,
      image: profile.image,
      timeZone: profile.timeZone,
      timeZoneSource: profile.timeZoneSource,
    };
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

export type DetectTimeZoneActionResult =
  | { ok: false; error: string }
  | { ok: true; applied: boolean; timeZone: string };

/**
 * T-147 (ADR-146): simpan zona hasil deteksi browser SEKALI untuk pengguna
 * yang belum pernah mengatur zona. `applied: false` = sudah terdeteksi/diatur
 * sebelumnya (pilihan pengguna tidak ditimpa).
 */
export async function detectTimeZoneAction(
  timeZone: string,
): Promise<DetectTimeZoneActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const identityService = new IdentityService(
    identityRepository,
    supabaseAvatarStorageAdapter,
  );

  try {
    const profile = await identityService.applyDetectedTimeZone(
      asUserId(session.user.id),
      timeZone,
    );
    if (!profile) {
      return { ok: true, applied: false, timeZone };
    }
    revalidatePath("/", "layout");
    return { ok: true, applied: true, timeZone: profile.timeZone };
  } catch (error) {
    try {
      return { ok: false, error: toActionError(error).error };
    } catch {
      console.error("[detectTimeZoneAction] gagal simpan zona waktu:", error);
      return { ok: false, error: "Gagal menyimpan zona waktu." };
    }
  }
}
