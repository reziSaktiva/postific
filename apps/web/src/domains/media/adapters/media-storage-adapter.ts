import type { WorkspaceId } from "@postific/shared";

export interface UploadMediaInput {
  workspaceId: WorkspaceId;
  fileBuffer: Buffer;
  contentType: string;
  /** File extension without leading dot, e.g. "jpg", "mp4". */
  extension: string;
}

export interface UploadMediaResult {
  /**
   * URL akses sementara (signed URL) ke file — bucket `media` **Private**
   * (beda dari `avatars` yang Public, lihat `database-strategy.md` §
   * Storage Strategy: "File konten tidak boleh diakses langsung via URL
   * publik tanpa authentication"). Ini hanya cache, boleh kedaluwarsa;
   * application layer wajib bisa regenerate signed URL baru dari
   * `storagePath` kapan saja — `storagePath` adalah source of truth lokasi
   * file, bukan `url` ini.
   */
  url: string;
  /** Path internal di bucket `media`, source of truth lokasi file (dipersist di `MediaItem.storagePath`). */
  storagePath: string;
}

/**
 * Port for media file storage — implementation (Supabase Storage) lives in
 * src/lib/adapters/media-storage. Kept out of the repository interface
 * because it is infrastructure for a *file*, not a domain record; mirrors
 * `IAvatarStorageAdapter` (domains/identity/adapters) which itself mirrors
 * the `IOutstandAdapter` pattern in domains/publishing/adapters.
 */
export interface IMediaStorageAdapter {
  uploadMedia(input: UploadMediaInput): Promise<UploadMediaResult>;
  /** Best-effort cleanup — used when a DB write fails after upload succeeded. */
  deleteMedia(storagePath: string): Promise<void>;
  /**
   * Unduh bytes original dari bucket private (schedule/publish →
   * `uploadMediaWorkingCopy`). Throw kalau path tidak ada / Storage gagal.
   */
  downloadMedia(storagePath: string): Promise<Buffer>;
  /**
   * Generate signed URL BARU dari `storagePath` (bug fix QA T-056,
   * 2026-10-06: kolom `MediaItem.url` yang di-cache permanen sejak upload
   * expired setelah `SIGNED_URL_EXPIRES_IN_SECONDS`, bikin thumbnail broken
   * di mana pun media ditampilkan lama setelah upload — Comments Inbox
   * "Post asal", History Detail, draft editor yang dibuka lagi). Caller
   * (`MediaService`) memanggil ini setiap kali me-resolve `MediaItemRecord`
   * untuk ditampilkan — `url` yang di-cache di DB TIDAK PERNAH dipakai
   * langsung lagi untuk display, hanya `storagePath` (source of truth)
   * yang dipakai untuk regenerate. Throw kalau path tidak ada / Storage
   * gagal — caller memutuskan fallback (mis. treat sebagai "media tidak
   * punya thumbnail" alih-alih melempar ke client).
   */
  getSignedUrl(storagePath: string): Promise<string>;
}
