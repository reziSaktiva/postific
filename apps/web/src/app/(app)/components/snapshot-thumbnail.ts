import { MediaType } from "@postific/shared";

import type { MediaThumbnailDto } from "@/domains/media";

/**
 * Thumbnail kartu posting, urutan prioritas:
 * 1. media Postific (`mediaIds[0]`, signed URL);
 * 2. thumbnail tersimpan posting impor (T-230, ADR-158; webp di bucket
 *    `media`, signed URL lewat `signedStoragePaths`);
 * 3. URL CDN platform sebagai gambar (T-227), cadangan yang bisa kedaluwarsa;
 * 4. `null`: tanpa thumbnail (kartu polos, sesuai rancangan Postific).
 *
 * Bila media Postific ada tetapi gagal di-resolve, hasilnya `null` (tidak
 * jatuh ke sumber lain: itu posting yang memang punya media sendiri).
 */
export function resolveSnapshotThumbnail(
  snapshot: {
    mediaIds: string[];
    externalMediaUrl?: string | null;
    thumbnailStoragePath?: string | null;
  },
  thumbnailByMediaId: Map<string, MediaThumbnailDto>,
  signedStoragePaths: Map<string, string> = new Map(),
): MediaThumbnailDto | null {
  const firstMediaId = snapshot.mediaIds[0];
  if (firstMediaId) return thumbnailByMediaId.get(firstMediaId) ?? null;
  const storedUrl = snapshot.thumbnailStoragePath
    ? signedStoragePaths.get(snapshot.thumbnailStoragePath)
    : undefined;
  if (storedUrl) return { url: storedUrl, type: MediaType.Image };
  return snapshot.externalMediaUrl
    ? { url: snapshot.externalMediaUrl, type: MediaType.Image }
    : null;
}
