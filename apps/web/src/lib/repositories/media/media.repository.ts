import {
  asMediaId,
  asUserId,
  asWorkspaceId,
  type MediaType,
} from "@postific/shared";
import type { IMediaRepository, MediaItemRecord } from "@/domains/media";
import type { MediaItem } from "@/generated/prisma/client";
import { withCurrentUser } from "@/lib/prisma/with-current-user";
import { NotFoundError } from "@/lib/utils/errors";

function toRecord(item: MediaItem): MediaItemRecord {
  return {
    id: asMediaId(item.id),
    workspaceId: asWorkspaceId(item.workspaceId),
    uploaderId: asUserId(item.uploaderId),
    filename: item.filename,
    mimeType: item.mimeType,
    size: item.size,
    url: item.url,
    storagePath: item.storagePath,
    outstandMediaId: item.outstandMediaId,
    outstandMediaUrl: item.outstandMediaUrl,
    outstandUploadedAt: item.outstandUploadedAt,
    outstandExpiresAt: item.outstandExpiresAt,
    type: item.type as MediaType,
    width: item.width,
    height: item.height,
    duration: item.duration ? item.duration.toNumber() : null,
    createdAt: item.createdAt,
  };
}

export const mediaRepository: IMediaRepository = {
  async create(
    {
      workspaceId,
      uploaderId,
      filename,
      mimeType,
      size,
      storagePath,
      type,
      url,
      width,
      height,
      duration,
    },
    userId,
  ) {
    const item = await withCurrentUser(userId, (tx) =>
      tx.mediaItem.create({
        data: {
          workspaceId,
          uploaderId,
          filename,
          mimeType,
          size,
          storagePath,
          type,
          url,
          width,
          height,
          duration,
        },
      }),
    );

    return toRecord(item);
  },

  /**
   * `findFirst` (bukan `findUnique`) — guard `workspaceId` wajib ikut
   * WHERE (anti-IDOR, konsisten pola `findDraftById`), bukan divalidasi
   * belakangan setelah fetch by id saja.
   */
  async findById({ workspaceId, mediaId }, userId) {
    const item = await withCurrentUser(userId, (tx) =>
      tx.mediaItem.findFirst({
        where: { id: mediaId, workspaceId },
      }),
    );

    return item ? toRecord(item) : null;
  },

  async findByWorkspace({ workspaceId }, userId) {
    const items = await withCurrentUser(userId, (tx) =>
      tx.mediaItem.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      }),
    );

    return items.map(toRecord);
  },

  /**
   * `findMany` batch (bukan loop `findFirst`) — satu query untuk N id,
   * `workspaceId` tetap wajib di WHERE (anti-IDOR, konsisten `findById`).
   * `mediaId` yang tidak ditemukan/bukan milik workspace ini otomatis tidak
   * ikut hasil — tidak ada error di layer ini.
   */
  async findByIds({ workspaceId, mediaIds }, userId) {
    if (mediaIds.length === 0) {
      return [];
    }
    const items = await withCurrentUser(userId, (tx) =>
      tx.mediaItem.findMany({
        where: { id: { in: mediaIds }, workspaceId },
        orderBy: { createdAt: "desc" },
      }),
    );

    return items.map(toRecord);
  },

  /**
   * `deleteMany` + fetch-before-delete di dalam transaksi yang sama
   * (bukan `delete` langsung) — supaya WHERE mencakup `workspaceId`
   * (anti-IDOR) DAN caller tetap dapat record yang dihapus (dibutuhkan
   * T-024.5 untuk `storagePath`, best-effort cleanup Supabase Storage).
   * `delete()` Prisma tidak mendukung WHERE komposit di luar unique key
   * tanpa lookup terpisah, jadi pola ini (baca dulu, lalu hapus by id
   * kalau ketemu, dalam satu `withCurrentUser` transaction) konsisten
   * dengan guard "return null kalau tidak ditemukan/bukan milik
   * workspace ini" yang dipakai method lain di repository ini.
   */
  async delete({ workspaceId, mediaId }, userId) {
    return withCurrentUser(userId, async (tx) => {
      const existing = await tx.mediaItem.findFirst({
        where: { id: mediaId, workspaceId },
      });
      if (!existing) {
        return null;
      }

      const deleted = await tx.mediaItem.delete({
        where: { id: existing.id },
      });

      return toRecord(deleted);
    });
  },

  async saveOutstandWorkingCopy(
    {
      workspaceId,
      mediaId,
      outstandMediaId,
      outstandMediaUrl,
      outstandExpiresAt,
    },
    userId,
  ) {
    await withCurrentUser(userId, async (tx) => {
      const { count } = await tx.mediaItem.updateMany({
        where: { id: mediaId, workspaceId },
        data: {
          outstandMediaId,
          outstandMediaUrl,
          outstandExpiresAt,
          outstandUploadedAt: new Date(),
        },
      });
      if (count === 0) {
        throw new NotFoundError("Media tidak ditemukan.");
      }
    });
  },
};
