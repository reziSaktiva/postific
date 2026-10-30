import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExternalServiceError } from "@/lib/utils/errors";

/**
 * Bucket `avatars` (publik), dipakai bersama adapter avatar user
 * (`users/{user_id}/…`) dan Start Page (`{workspace_id}/…`), ADR-071.
 */
export const AVATARS_BUCKET = "avatars";

export function avatarsBucket() {
  return createServerSupabaseClient().storage.from(AVATARS_BUCKET);
}

/** Unggah ke bucket `avatars` dan kembalikan URL publik `path`. */
export async function uploadToAvatarsBucket(
  path: string,
  fileBuffer: Buffer,
  options: { contentType: string; upsert?: boolean },
): Promise<string> {
  const bucket = avatarsBucket();
  const { error } = await bucket.upload(path, fileBuffer, options);
  if (error) {
    // Jangan sisipkan `error.message` provider ke pesan yang bisa sampai
    // ke client. Detailnya ada di `cause` untuk log server.
    throw new ExternalServiceError("Gagal upload avatar.", { cause: error });
  }
  return bucket.getPublicUrl(path).data.publicUrl;
}
