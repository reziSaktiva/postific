import type { IStartPageAvatarStorage } from "@/domains/start-page";
import { ExternalServiceError } from "@/lib/utils/errors";
import { avatarsBucket, uploadToAvatarsBucket } from "./avatars-bucket";

/**
 * Bucket `avatars` (lihat `avatars-bucket.ts`). Path Start Page:
 * `avatars/{workspace_id}/avatar-{id}.{ext}` — terpisah dari
 * `avatars/users/{user_id}/avatar.{ext}` (ADR-071). Nama unik per unggahan:
 * berkas lama tetap utuh sampai DB menyimpan URL baru, dan URL baru tidak
 * perlu cache-bust.
 */
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
    const fileName = `avatar-${crypto.randomUUID()}.${extension}`;
    const url = await uploadToAvatarsBucket(
      `${workspaceId}/${fileName}`,
      fileBuffer,
      { contentType },
    );
    return { url, fileName };
  },

  async deleteAvatar({ workspaceId, fileName }) {
    const { error } = await avatarsBucket().remove([
      `${workspaceId}/${fileName}`,
    ]);
    if (error) {
      throw new ExternalServiceError("Gagal hapus avatar.", { cause: error });
    }
  },

  async deleteOtherAvatars({ workspaceId, keepFileName }) {
    const storage = avatarsBucket();
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
