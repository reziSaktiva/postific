import type { MediaId, MediaType, UserId, WorkspaceId } from "@postific/shared";
import type { MediaItemRecord } from "../types";

/**
 * Repository interface — implementation (Prisma) lives in
 * src/lib/repositories/media (pola sama `IPublishingRepository`/
 * `INotificationRepository`).
 */
export interface IMediaRepository {
  /**
   * Persist satu `MediaItem` baru (T-024.1 skeleton — dipanggil SETELAH
   * upload fisik ke Supabase Storage sudah selesai di layer atas, T-024.2;
   * method ini murni menulis record DB, tidak menyentuh Storage). `userId`
   * (RLS, pola `withCurrentUser` konsisten repository lain) adalah actor
   * yang melakukan upload — biasanya sama dengan `uploaderId`, tapi
   * dipisah eksplisit di parameter kedua supaya konsisten dengan seluruh
   * method lain di interface ini (acting user vs. data yang ditulis).
   */
  create(
    input: {
      workspaceId: WorkspaceId;
      uploaderId: UserId;
      filename: string;
      mimeType: string;
      size: bigint;
      storagePath: string;
      type: MediaType;
      url?: string;
      width?: number;
      height?: number;
      duration?: number;
    },
    userId: UserId,
  ): Promise<MediaItemRecord>;

  /**
   * Satu `MediaItem` by id, di-scope ke `workspaceId` (anti-IDOR — pola
   * sama `findDraftById`). Returns `null` kalau tidak ditemukan atau bukan
   * milik workspace ini.
   *
   * `userId` (RLS) — acting user for `withCurrentUser`.
   */
  findById(
    input: { workspaceId: WorkspaceId; mediaId: MediaId },
    userId: UserId,
  ): Promise<MediaItemRecord | null>;

  /**
   * Daftar seluruh `MediaItem` milik satu workspace, urut `createdAt`
   * descending (upload terbaru duluan — konsisten pola listing lain di
   * repo ini). Tidak ada pagination di skeleton ini — Media Library
   * (browse existing) ditunda ke task lain (out of scope T-024, dikonfirmasi
   * King Rezi).
   *
   * `userId` (RLS) — acting user for `withCurrentUser`.
   */
  findByWorkspace(
    input: { workspaceId: WorkspaceId },
    userId: UserId,
  ): Promise<MediaItemRecord[]>;

  /**
   * Batch fetch beberapa `MediaItem` by id sekaligus, di-scope ke
   * `workspaceId` (anti-IDOR — sama pola `findById`, tapi `findMany` satu
   * query untuk N id, bukan N round-trip). Dipakai T-024.4:
   * `getDraftAction` (resolve `PublishingPost.mediaIds` jadi preview
   * lengkap) dan validasi ownership sebelum mediaIds dipersist ke draft
   * (`resolveDraftMediaIds` di domain `publishing`). `mediaId` yang tidak
   * ditemukan atau bukan milik workspace ini TIDAK menyebabkan error di
   * sini — cukup tidak ikut di hasil (caller yang membandingkan panjang
   * hasil vs. input untuk menyimpulkan mana yang invalid/bukan milik
   * workspace ini).
   *
   * `userId` (RLS) — acting user for `withCurrentUser`.
   */
  findByIds(
    input: { workspaceId: WorkspaceId; mediaIds: MediaId[] },
    userId: UserId,
  ): Promise<MediaItemRecord[]>;

  /**
   * Hapus satu `MediaItem` by id, di-scope ke `workspaceId` (anti-IDOR).
   * Hard delete (tidak ada soft-delete di schema `MediaItem` — beda dari
   * `PublishingPost.deletedAt`) — pembersihan file fisik di Supabase
   * Storage BUKAN tanggung jawab method ini (itu T-024.5, orchestrated di
   * layer atas: repository ini hanya menghapus row DB). Returns record
   * yang baru dihapus (untuk `storagePath`, dibutuhkan caller T-024.5 saat
   * membersihkan Storage) atau `null` kalau tidak ditemukan/bukan milik
   * workspace ini.
   *
   * `userId` (RLS) — acting user for `withCurrentUser`.
   */
  delete(
    input: { workspaceId: WorkspaceId; mediaId: MediaId },
    userId: UserId,
  ): Promise<MediaItemRecord | null>;

  /**
   * Simpan URL working copy Outstand setelah unggah berhasil, supaya
   * publish berikutnya memakai URL yang masih berlaku.
   */
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
