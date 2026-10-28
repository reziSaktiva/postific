import type { WorkspaceId } from "@postific/shared";

export interface UploadStartPageAvatarInput {
  workspaceId: WorkspaceId;
  fileBuffer: Buffer;
  contentType: string;
  /** Ekstensi tanpa titik, misalnya "jpg" atau "png". */
  extension: string;
}

export interface UploadStartPageAvatarResult {
  /** URL publik bucket `avatars`. */
  url: string;
  /** Nama berkas unik di folder workspace; tiap unggahan berkas baru. */
  fileName: string;
}

export interface DeleteStartPageAvatarInput {
  workspaceId: WorkspaceId;
  fileName: string;
}

export interface DeleteOtherStartPageAvatarsInput {
  workspaceId: WorkspaceId;
  /** Berkas yang dipertahankan; kosong = hapus semua foto workspace. */
  keepFileName?: string;
}

/**
 * Port penyimpanan file foto profil Start Page. Implementasi Supabase
 * Storage ada di `src/lib/adapters/avatar-storage`. Bukan bagian repository
 * karena ini file, bukan baris domain — pola sama `IAvatarStorageAdapter`.
 * Path: `avatars/{workspace_id}/avatar-{id}.{ext}`; nama unik per unggahan
 * supaya berkas lama tidak tertimpa sebelum DB tersimpan.
 */
export interface IStartPageAvatarStorage {
  uploadAvatar(
    input: UploadStartPageAvatarInput,
  ): Promise<UploadStartPageAvatarResult>;
  /** Hapus satu berkas; dipakai saat tulis DB gagal sesudah upload. */
  deleteAvatar(input: DeleteStartPageAvatarInput): Promise<void>;
  /** Hapus berkas foto lain di folder workspace; dipakai sesudah DB tersimpan. */
  deleteOtherAvatars(input: DeleteOtherStartPageAvatarsInput): Promise<void>;
}
