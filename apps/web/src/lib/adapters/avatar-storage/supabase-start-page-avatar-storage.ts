import type { IStartPageAvatarStorage } from "@/domains/start-page/adapters/start-page-avatar-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExternalServiceError } from "@/lib/utils/errors";

/**
 * Bucket `avatars` (publik). Path Start Page:
 * `avatars/{workspace_id}/avatar.{ext}` — terpisah dari
 * `avatars/users/{user_id}/avatar.{ext}` (ADR-071).
 */
const AVATARS_BUCKET = "avatars";

function buildAvatarPath(workspaceId: string, extension: string): string {
  return `${workspaceId}/avatar.${extension}`;
}

export const supabaseStartPageAvatarStorage: IStartPageAvatarStorage = {
  async uploadAvatar({ workspaceId, fileBuffer, contentType, extension }) {
    const supabase = createServerSupabaseClient();
    const path = buildAvatarPath(workspaceId, extension);

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, fileBuffer, { contentType, upsert: true });

    if (error) {
      throw new ExternalServiceError("Gagal upload avatar.", { cause: error });
    }

    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);

    // Path tetap saat foto diganti (upsert). Query ini memaksa browser
    // memuat berkas baru, bukan salinan cache.
    return { url: `${data.publicUrl}?v=${Date.now()}` };
  },

  async deleteAvatar({ workspaceId, extension }) {
    const supabase = createServerSupabaseClient();
    const path = buildAvatarPath(workspaceId, extension);
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
  },
};
