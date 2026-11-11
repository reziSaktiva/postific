import type { HistoryDetailItem } from "@/domains/publishing";
import type { MediaService, MediaThumbnailDto } from "@/domains/media";
import type { UserId } from "@postific/shared";

import { resolveSnapshotThumbnail } from "../../../components/snapshot-thumbnail";

/**
 * Thumbnail History Detail (KI-082 untuk media Postific, T-232/ADR-158 untuk
 * posting impor). Satu thumbnail per post (ADR-107):
 * - post punya `mediaIds`: media pertama lewat `resolveFirstThumbnail`;
 * - posting impor (`mediaIds` kosong): target PERTAMA (urutan `item.targets`)
 *   yang punya `thumbnailStoragePath`; bila tak ada, target pertama yang punya
 *   URL CDN. Resolver yang dipakai sama dengan Engage
 *   (`resolveSnapshotThumbnail`), bukan salinan logika.
 * Kegagalan resolve tidak pernah melempar: hasilnya `null` (media dihilangkan).
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

  const source =
    item.targets.find((target) => target.thumbnailStoragePath) ??
    item.targets.find((target) => target.externalMediaUrl);
  if (!source) return null;

  let signedStoragePaths = new Map<string, string>();
  if (source.thumbnailStoragePath) {
    try {
      signedStoragePaths = await mediaService.signStoragePaths(workspaceId, [
        source.thumbnailStoragePath,
      ]);
    } catch (error) {
      console.error("resolveHistoryThumbnail: gagal tanda tangan", error);
    }
  }
  return resolveSnapshotThumbnail(
    {
      mediaIds: [],
      externalMediaUrl: source.externalMediaUrl,
      thumbnailStoragePath: source.thumbnailStoragePath,
    },
    new Map(),
    signedStoragePaths,
  );
}
