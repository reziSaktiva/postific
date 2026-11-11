/** Satu berkas thumbnail posting impor di bucket `media` (T-231, ADR-158). */
export interface StoredImportThumbnail {
  /** Path lengkap di bucket: `{workspaceId}/imports/{targetId}.webp`. */
  path: string;
  /** Waktu berkas dibuat; `null` bila Storage tidak melaporkannya. */
  createdAt: Date | null;
}

/**
 * Port penyimpanan thumbnail posting impor untuk PEMBERSIHAN (T-231, ADR-158).
 * Implementasi (Supabase Storage) ada di `src/lib/adapters/import-thumbnail`;
 * domain tidak tahu apa pun soal itu (AGENTS.md no. 4 dan 6). Pembuatan
 * berkas tetap lewat `IImportThumbnailGenerator`.
 */
export interface IImportThumbnailStorage {
  /** ID semua workspace yang punya folder di bucket `media`. */
  listWorkspaceIds(): Promise<string[]>;
  /** Satu halaman berkas `{workspaceId}/imports/`, urut nama; halaman kosong berarti habis. */
  listWorkspaceThumbnails(
    workspaceId: string,
    page: { offset: number; limit: number },
  ): Promise<StoredImportThumbnail[]>;
  /** Hapus berkas; path yang sudah tidak ada bukan galat. Melempar bila Storage gagal. */
  removePaths(paths: string[]): Promise<void>;
}
