import type { IMediaStorageAdapter } from "@/domains/media";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExternalServiceError } from "@/lib/utils/errors";

/**
 * Bucket `media` (Private — beda dari `avatars` yang Public) sesuai
 * `database-strategy.md` § Storage Strategy: "File konten tidak boleh
 * diakses langsung via URL publik tanpa authentication. Signed URL
 * digunakan untuk generate link sementara saat merender konten." Dibuat via
 * migration `prisma/migrations/*_create_media_bucket` (pola sama
 * `20260806120000_extend_avatars_bucket_user_profile` untuk `avatars`).
 */
const MEDIA_BUCKET = "media";

/** Signed URL default expiry: 1 jam — cukup untuk preview segera setelah upload (T-024.2 scope), regenerable dari `storagePath` kapan saja. */
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;

/**
 * `media/{workspace_id}/{year}/{month}/{uuid}.{ext}` — sesuai naming
 * convention `database-strategy.md` § Storage Strategy (bucket name sendiri
 * bukan bagian dari path, ditentukan lewat `storage.from(MEDIA_BUCKET)`).
 */
function buildMediaPath(workspaceId: string, extension: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  return `${workspaceId}/${year}/${month}/${uuid}.${extension}`;
}

export const supabaseMediaStorageAdapter: IMediaStorageAdapter = {
  async uploadMedia({ workspaceId, fileBuffer, contentType, extension }) {
    const supabase = createServerSupabaseClient();
    const path = buildMediaPath(workspaceId, extension);

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, fileBuffer, { contentType, upsert: false });

    if (uploadError) {
      throw new ExternalServiceError(
        `Gagal upload media: ${uploadError.message}`,
      );
    }

    try {
      const url = await this.getSignedUrl(path);
      return { url, storagePath: path };
    } catch {
      // File sudah ter-upload tapi gagal generate signed URL — tetap
      // kembalikan storagePath (source of truth), url kosong string supaya
      // caller (use case) tidak menganggap upload gagal padahal file sudah
      // ada. Caller/consumer lain bisa regenerate signed URL dari
      // storagePath kapan saja.
      return { url: "", storagePath: path };
    }
  },

  async deleteMedia(storagePath: string) {
    const supabase = createServerSupabaseClient();

    // Best-effort — dipanggil sebagai cleanup saat DB write gagal setelah
    // upload sukses (UploadMediaUseCase). Errornya sendiri sengaja tidak
    // dilempar; kegagalan cleanup tidak boleh menutupi error asli, pola sama
    // `supabaseAvatarStorageAdapter.deleteAvatar`.
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
  },

  async downloadMedia(storagePath: string) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw new ExternalServiceError(
        `Gagal mengunduh media dari Storage: ${error?.message ?? "empty response"}`,
      );
    }

    return Buffer.from(await data.arrayBuffer());
  },

  async getSignedUrl(storagePath: string) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS);

    if (error || !data) {
      throw new ExternalServiceError(
        `Gagal generate signed URL: ${error?.message ?? "empty response"}`,
      );
    }

    return data.signedUrl;
  },
};
