import type {
  MediaId,
  OutstandPostMediaInput,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import { ValidationError } from "@/lib/utils/errors";

/**
 * Satu MediaItem minimal untuk resolve URL publishing — structural typing
 * (bukan import `MediaItemRecord` domain media) supaya publishing tidak
 * bergantung pada tipe domain lain.
 */
export interface PostMediaItemForPublish {
  id: MediaId;
  filename: string;
  mimeType: string;
  storagePath: string;
  url: string | null;
  outstandMediaUrl: string | null;
  outstandExpiresAt: Date | null;
}

/**
 * Port lookup media + unduh bytes (composition root menyuplai
 * `MediaService.listByIds` + `IMediaStorageAdapter.downloadMedia`).
 * Opsional di use-case — kalau tidak disuplai dan post punya `mediaIds`,
 * publish dibatalkan (jangan tayang sebagai text-only).
 */
export interface PostMediaLookupPort {
  listByIds(
    input: { workspaceId: WorkspaceId; mediaIds: MediaId[] },
    userId: UserId,
  ): Promise<PostMediaItemForPublish[]>;
  downloadBytes(storagePath: string): Promise<Buffer>;
  saveOutstandWorkingCopy(
    input: {
      workspaceId: WorkspaceId;
      mediaId: MediaId;
      outstandMediaId: string;
      outstandMediaUrl: string;
      outstandExpiresAt: Date;
    },
    userId: UserId,
  ): Promise<void>;
}

function isUsableOutstandUrl(
  url: string | null,
  expiresAt: Date | null,
): url is string {
  if (!url || url.length === 0) return false;
  if (expiresAt && expiresAt.getTime() <= Date.now()) return false;
  return url.startsWith("https://");
}

/**
 * Resolve `mediaIds` post → array `{ url, filename }` untuk
 * `schedulePost`/`publishNow`. Prefer `outstandMediaUrl` yang masih valid;
 * kalau belum ada, unduh bytes dari Storage lalu `uploadMediaWorkingCopy`.
 * Returns `undefined` (bukan `[]`) kalau tidak ada media — supaya caller
 * bisa omit field `media` di input adapter (text-only path).
 */
export async function resolveOutstandPostMedia(input: {
  workspaceId: WorkspaceId;
  mediaIds: MediaId[] | undefined;
  actingUserId: UserId;
  outstandAdapter: IOutstandAdapter;
  mediaLookup: PostMediaLookupPort | undefined;
}): Promise<OutstandPostMediaInput[] | undefined> {
  const mediaIds = input.mediaIds ?? [];
  if (mediaIds.length === 0) {
    return undefined;
  }

  if (!input.mediaLookup) {
    throw new ValidationError(
      "Post ini punya media, tetapi penyimpanan media tidak terhubung. Publish dibatalkan supaya konten tidak tayang tanpa medianya.",
    );
  }

  const items = await input.mediaLookup.listByIds(
    { workspaceId: input.workspaceId, mediaIds },
    input.actingUserId,
  );
  const itemById = new Map(items.map((item) => [item.id, item]));
  const ordered: PostMediaItemForPublish[] = [];
  for (const mediaId of mediaIds) {
    const item = itemById.get(mediaId);
    if (!item) {
      throw new ValidationError(
        "Sebagian media pada post ini tidak ditemukan. Publish dibatalkan supaya urutan dan isi media tidak berubah.",
      );
    }
    ordered.push(item);
  }

  const resolved: OutstandPostMediaInput[] = [];

  for (const item of ordered) {
    if (isUsableOutstandUrl(item.outstandMediaUrl, item.outstandExpiresAt)) {
      resolved.push({ url: item.outstandMediaUrl, filename: item.filename });
      continue;
    }

    const bytes = await input.mediaLookup.downloadBytes(item.storagePath);
    const uploaded = await input.outstandAdapter.uploadMediaWorkingCopy({
      fileBuffer: bytes,
      mimeType: item.mimeType,
    });
    await input.mediaLookup.saveOutstandWorkingCopy(
      {
        workspaceId: input.workspaceId,
        mediaId: item.id,
        outstandMediaId: uploaded.outstandMediaId,
        outstandMediaUrl: uploaded.outstandMediaUrl,
        outstandExpiresAt: uploaded.expiresAt,
      },
      input.actingUserId,
    );
    resolved.push({
      url: uploaded.outstandMediaUrl,
      filename: item.filename,
    });
  }

  return resolved.length > 0 ? resolved : undefined;
}
