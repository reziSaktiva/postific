import type { IAvatarStorageAdapter } from "@/domains/identity";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExternalServiceError } from "@/lib/utils/errors";

/**
 * Bucket `avatars` (Public) — sebelumnya hanya untuk avatar workspace dan
 * Start Page, diperluas untuk avatar user personal (T-016.2). Lihat
 * `database-strategy.md` § Storage Strategy.
 */
const AVATARS_BUCKET = "avatars";

/** `avatars/users/{user_id}/avatar.{ext}` — konsisten dengan pola existing `avatars/{workspace_id}/avatar.jpg`. */
function buildAvatarPath(userId: string, extension: string): string {
  return `users/${userId}/avatar.${extension}`;
}

export const supabaseAvatarStorageAdapter: IAvatarStorageAdapter = {
  async uploadAvatar({ userId, fileBuffer, contentType, extension }) {
    const supabase = createServerSupabaseClient();
    const path = buildAvatarPath(userId, extension);

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, fileBuffer, { contentType, upsert: true });

    if (error) {
      // Jangan sisipkan `error.message` provider ke pesan yang bisa sampai
      // ke client. Detailnya ada di `cause` untuk log server.
      throw new ExternalServiceError("Gagal upload avatar.", { cause: error });
    }

    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);

    // Cache-bust: path tetap sama saat avatar diganti (upsert), tanpa query
    // param browser/CDN bisa terus menampilkan avatar lama yang sudah di-cache.
    return { url: `${data.publicUrl}?v=${Date.now()}` };
  },

  async deleteAvatar({ userId, extension }) {
    const supabase = createServerSupabaseClient();
    const path = buildAvatarPath(userId, extension);

    // Best-effort — dipanggil sebagai cleanup saat DB write gagal setelah
    // upload sukses (identity.service.ts). Errornya sendiri sengaja tidak
    // dilempar; kegagalan cleanup tidak boleh menutupi error asli.
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
  },
};
