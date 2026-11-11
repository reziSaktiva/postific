import type { HistoryDetailItem } from "@/domains/publishing";
import type { MediaService, MediaThumbnailDto } from "@/domains/media";
import type { UserId } from "@postific/shared";

import { resolveSnapshotThumbnail } from "../../../components/snapshot-thumbnail";

/**
 * Thumbnail History Detail (KI-082 untuk media Postific, T-232/ADR-158 untuk
 * posting impor). Satu thumbnail per post (ADR-107):
 * - post punya `mediaIds`: media pertama lewat `resolveFirstThumbnail`;
 * - posting impor (`mediaIds` kosong): target PERTAMA (urutan `item.targets`)
 *   yang punya `thumbnailStoragePath`, ditandatangani lewat `signStoragePaths`.
 *   Resolver yang dipakai sama dengan Engage (`resolveSnapshotThumbnail`),
 *   bukan salinan logika.
 * URL CDN platform sengaja TIDAK dipakai sebagai cadangan di sini: bisa
 * kedaluwarsa (T-228) dan `MediaThumbnail` tidak punya penanganan gambar
 * gagal seperti `PostThumb` Engage, jadi hasilnya gambar pecah. Tanpa
 * thumbnail tersimpan atau tanda tangan gagal: `null` (media dihilangkan).
 * Kegagalan resolve tidak pernah melempar.
 */
export async function resolveHistoryThumbnail(
  item: Pick<HistoryDetailItem, "mediaIds" | "targets">,
  workspaceId: Parameters<MediaService["signStoragePaths"]>[0],
  userId: UserId,
  mediaService: Pick<
    MediaService,
    "resolveFirstThumbnail" | "signStoragePaths"
  >,
): Promise<MediaThumbnailDto | null> {
  if (item.mediaIds.length > 0) {
    return mediaService.resolveFirstThumbnail(
      { workspaceId, mediaIds: item.mediaIds },
      userId,
    );
  }

  const storagePath = item.targets.find(
    (target) => target.thumbnailStoragePath,
  )?.thumbnailStoragePath;
  if (!storagePath) return null;

  let signedStoragePaths = new Map<string, string>();
  try {
    signedStoragePaths = await mediaService.signStoragePaths(workspaceId, [
      storagePath,
    ]);
  } catch (error) {
    console.error("resolveHistoryThumbnail: gagal tanda tangan", error);
  }
  return resolveSnapshotThumbnail(
    { mediaIds: [], thumbnailStoragePath: storagePath },
    new Map(),
    signedStoragePaths,
  );
}
