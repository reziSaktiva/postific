import type { IStartPageAvatarStorage } from "@/domains/start-page";
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

/** Hanya berkas yang dibuat `uploadAvatar`; berkas lain di folder workspace tidak disentuh. */
const START_PAGE_AVATAR_FILE_PATTERN = /^avatar-[0-9a-f-]{36}\.(jpg|png)$/;
const LIST_LIMIT = 1000;
/**
 * Berkas yang lebih baru dari ini tidak dihapus: bisa jadi unggahan simpan
 * lain yang belum sempat ditulis ke DB (simpan serentak).
 */
const MIN_STALE_AGE_MS = 10 * 60 * 1000;

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
    const { data, error } = await storage.list(workspaceId, {
      limit: LIST_LIMIT,
    });
    if (error) {
      throw new ExternalServiceError("Gagal membaca avatar.", { cause: error });
    }
    const now = Date.now();
    const stale = data
      .filter(
        (file) =>
          file.name !== keepFileName &&
          START_PAGE_AVATAR_FILE_PATTERN.test(file.name) &&
          now - (file.created_at ? Date.parse(file.created_at) : 0) >=
            MIN_STALE_AGE_MS,
      )
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
