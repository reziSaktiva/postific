import { MediaType } from "@postific/shared";

import type { MediaThumbnailDto } from "@/domains/media";

/**
 * Thumbnail kartu posting: media Postific bila ada (`mediaIds[0]`, signed
 * URL); bila posting tidak punya media sendiri (hasil Import, T-227), pakai
 * URL CDN platform sebagai cadangan sebagai gambar. Posting tanpa keduanya
 * tetap `null` (tanpa placeholder, sesuai rancangan kartu Postific).
 */
export function resolveSnapshotThumbnail(
  snapshot: { mediaIds: string[]; externalMediaUrl?: string | null },
  thumbnailByMediaId: Map<string, MediaThumbnailDto>,
): MediaThumbnailDto | null {
  const firstMediaId = snapshot.mediaIds[0];
  if (firstMediaId) return thumbnailByMediaId.get(firstMediaId) ?? null;
  return snapshot.externalMediaUrl
    ? { url: snapshot.externalMediaUrl, type: MediaType.Image }
    : null;
}
