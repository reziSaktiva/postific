import type { IAvatarStorageAdapter } from "@/domains/identity";
import { avatarsBucket, uploadToAvatarsBucket } from "./avatars-bucket";

/** `avatars/users/{user_id}/avatar.{ext}` — konsisten dengan pola existing `avatars/{workspace_id}/avatar.jpg`. */
function buildAvatarPath(userId: string, extension: string): string {
  return `users/${userId}/avatar.${extension}`;
}

export const supabaseAvatarStorageAdapter: IAvatarStorageAdapter = {
  async uploadAvatar({ userId, fileBuffer, contentType, extension }) {
    const publicUrl = await uploadToAvatarsBucket(
      buildAvatarPath(userId, extension),
      fileBuffer,
      { contentType, upsert: true },
    );

    // Cache-bust: path tetap sama saat avatar diganti (upsert), tanpa query
    // param browser/CDN bisa terus menampilkan avatar lama yang sudah di-cache.
    return { url: `${publicUrl}?v=${Date.now()}` };
  },

  async deleteAvatar({ userId, extension }) {
    // Best-effort — dipanggil sebagai cleanup saat DB write gagal setelah
    // upload sukses (identity.service.ts). Errornya sendiri sengaja tidak
    // dilempar; kegagalan cleanup tidak boleh menutupi error asli.
    await avatarsBucket().remove([buildAvatarPath(userId, extension)]);
  },
};
