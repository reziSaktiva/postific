import type { WorkspaceId } from "@postific/shared";

/** Jenis thumbnail posting impor (T-230, ADR-158). */
export type ImportThumbnailKind = "image" | "video_poster";

export interface GenerateImportThumbnailInput {
  workspaceId: WorkspaceId;
  /** `publishing_post_targets.id`; menentukan path file (satu file per target, idempoten). */
  targetId: string;
  /** URL media CDN platform dari `platformOptions.mediaUrls[0]`. */
  sourceUrl: string;
  /** Dibatalkan saat anggaran waktu job habis; implementasi wajib menghentikan pekerjaannya. */
  signal?: AbortSignal;
}

/**
 * Kegagalan SEMENTARA (timeout, 5xx/429 dari CDN, `ffmpeg` tidak terpasang,
 * error Storage, dibatalkan): target TIDAK ditandai sudah dicoba, jadi dicoba
 * lagi pada import atau backfill berikutnya. Beda dari kegagalan PERMANEN
 * (URL kedaluwarsa 403/404/410, host tidak dikenal, terlalu besar, media
 * rusak) yang dikembalikan sebagai `null` dan ditandai.
 */
export class TransientThumbnailError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TransientThumbnailError";
  }
}

export interface ImportThumbnailResult {
  /** Path di bucket `media` (source of truth lokasi file). */
  storagePath: string;
  kind: ImportThumbnailKind;
}

/**
 * Port pembuat thumbnail posting impor (T-230, ADR-158) — unduh media dari
 * CDN platform, kecilkan (gambar) atau ambil satu frame (video), lalu simpan
 * di Storage. Implementasi (fetch, `sharp`, `ffmpeg`, Supabase Storage) ada
 * di `src/lib/adapters/import-thumbnail`; domain tidak tahu apa pun soal
 * itu (AGENTS.md no. 4).
 *
 * Mengembalikan `null` untuk kegagalan PERMANEN (lihat
 * `TransientThumbnailError` untuk yang sementara, yang dilempar). Pemanggil
 * menangkap lemparan per media supaya satu kegagalan tidak menggagalkan batch.
 */
export interface IImportThumbnailGenerator {
  generate(
    input: GenerateImportThumbnailInput,
  ): Promise<ImportThumbnailResult | null>;
}
