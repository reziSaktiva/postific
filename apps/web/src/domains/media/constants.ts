/**
 * Batas ukuran file maksimum untuk media MVP: 50 MB (52428800 bytes).
 * Dikonfirmasi King Rezi via `AskUserQuestion` (follow-up T-024.2 — gap yang
 * sebelumnya ditandai belum ada baseline eksplisit). Ditegakkan di dua
 * tempat yang HARUS tetap sinkron:
 * 1. Level aplikasi — `UploadMediaUseCase.execute` menolak upload sebelum
 *    memanggil storage adapter kalau `fileBuffer.byteLength` melebihi ini.
 * 2. Level Storage — `file_size_limit` bucket `media`, migration
 *    `20260914090000_t024_2_create_media_bucket`.
 *
 * Diisolasi dari `validation.ts` (bukan sekadar dipindah) karena
 * `next.config.ts` mengimpor nilai ini (KI-075) — `next-config-ts`
 * mentranspile & me-require config lewat Node `require()` biasa, yang tidak
 * bisa resolve package workspace `@postific/shared` (source `.ts`, ADR-097
 * bukan penyebabnya — ini murni keterbatasan resolver next-config-ts).
 * `validation.ts` mengimpor `MediaType` dari `@postific/shared`, jadi kalau
 * konstanta ini masih satu file dengannya, import itu ikut ter-require saat
 * build next.config.ts dan build gagal (`Cannot find module
 * '../../packages/shared'`). Jangan gabungkan lagi ke `validation.ts`.
 */
export const MAX_MEDIA_FILE_SIZE_BYTES = 52_428_800;
