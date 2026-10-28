import type { WorkspaceId } from "@postific/shared";

export interface UploadStartPageAvatarInput {
  workspaceId: WorkspaceId;
  fileBuffer: Buffer;
  contentType: string;
  /** Ekstensi tanpa titik, misalnya "jpg" atau "png". */
  extension: string;
}

export interface UploadStartPageAvatarResult {
  /** URL publik bucket `avatars` (sudah cache-bust). */
  url: string;
}

export interface DeleteStartPageAvatarInput {
  workspaceId: WorkspaceId;
  extension: string;
}

/**
 * Port penyimpanan file foto profil Start Page. Implementasi Supabase
 * Storage ada di `src/lib/adapters/avatar-storage`. Bukan bagian repository
 * karena ini file, bukan baris domain — pola sama `IAvatarStorageAdapter`.
 * Path: `avatars/{workspace_id}/avatar.{ext}` (`database-strategy.md`).
 */
export interface IStartPageAvatarStorage {
  uploadAvatar(
    input: UploadStartPageAvatarInput,
  ): Promise<UploadStartPageAvatarResult>;
  /** Best-effort. Dipakai saat tulis DB gagal sesudah upload, atau saat foto dihapus. */
  deleteAvatar(input: DeleteStartPageAvatarInput): Promise<void>;
}
