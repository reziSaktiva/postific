import type { IStartPageAvatarStorage } from "@/domains/start-page/adapters/start-page-avatar-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExternalServiceError } from "@/lib/utils/errors";

/**
 * Bucket `avatars` (publik). Path Start Page:
 * `avatars/{workspace_id}/avatar-{id}.{ext}` — terpisah dari
 * `avatars/users/{user_id}/avatar.{ext}` (ADR-071). Nama unik per unggahan:
 * berkas lama tetap utuh sampai DB menyimpan URL baru, dan URL baru tidak
 * perlu cache-bust.
 */
const AVATARS_BUCKET = "avatars";

export const supabaseStartPageAvatarStorage: IStartPageAvatarStorage = {
  async uploadAvatar({ workspaceId, fileBuffer, contentType, extension }) {
    const supabase = createServerSupabaseClient();
    const fileName = `avatar-${crypto.randomUUID()}.${extension}`;
    const path = `${workspaceId}/${fileName}`;

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, fileBuffer, { contentType });

    if (error) {
      throw new ExternalServiceError("Gagal upload avatar.", { cause: error });
    }

    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, fileName };
  },

  async deleteAvatar({ workspaceId, fileName }) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .remove([`${workspaceId}/${fileName}`]);
    if (error) {
      throw new ExternalServiceError("Gagal hapus avatar.", { cause: error });
    }
  },

  async deleteOtherAvatars({ workspaceId, keepFileName }) {
    const storage = createServerSupabaseClient().storage.from(AVATARS_BUCKET);
    const { data, error } = await storage.list(workspaceId);
    if (error) {
      throw new ExternalServiceError("Gagal membaca avatar.", { cause: error });
    }
    const stale = data
      .filter((file) => file.name !== keepFileName)
      .map((file) => `${workspaceId}/${file.name}`);
    if (stale.length === 0) return;
    const { error: removeError } = await storage.remove(stale);
    if (removeError) {
      throw new ExternalServiceError("Gagal hapus avatar.", {
        cause: removeError,
      });
    }
  },
};
