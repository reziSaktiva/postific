import { MediaType } from "@postific/shared";

export { MAX_MEDIA_FILE_SIZE_BYTES } from "./constants";

/**
 * MIME type yang diizinkan untuk upload media di Draft Editor → extension +
 * `MediaType` yang dipetakan. Tidak ada baseline eksplisit di
 * `product-discovery/` untuk daftar MIME per platform (beda dari avatar yang
 * eksplisit JPG/PNG only, `identity/validation.ts`) — daftar ini adalah
 * interpretasi wajar dari `MediaType` yang SUDAH didefinisikan
 * (`domain-model.md` § BC-08: `image | video | gif`), bukan tebakan bebas.
 * Perluas di sini kalau King Rezi mengonfirmasi format lain dibutuhkan.
 */
export const ALLOWED_MEDIA_MIME_TYPES: Record<
  string,
  { extension: string; type: MediaType }
> = {
  "image/jpeg": { extension: "jpg", type: MediaType.Image },
  "image/png": { extension: "png", type: MediaType.Image },
  "image/webp": { extension: "webp", type: MediaType.Image },
  "image/gif": { extension: "gif", type: MediaType.Gif },
  "video/mp4": { extension: "mp4", type: MediaType.Video },
  "video/quicktime": { extension: "mov", type: MediaType.Video },
};
