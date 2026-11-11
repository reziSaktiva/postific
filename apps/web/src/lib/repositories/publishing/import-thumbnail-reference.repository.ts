import type { ThumbnailReferencePort } from "@/domains/publishing";
import { prisma } from "@/lib/prisma/client";

/**
 * T-231 (ADR-158): path thumbnail posting impor yang MASIH dirujuk
 * `publishing_post_targets.thumbnail_storage_path`, untuk job sapu berkas
 * yatim. Lewat fungsi SECURITY DEFINER karena job runner tidak punya sesi
 * pengguna dan tabel ber-RLS (pola `import_list_accounts_for_periodic_sync`).
 * Sengaja terpisah dari `publishingRepository` (bukan operasi per pengguna).
 */
export const importThumbnailReferenceRepository: ThumbnailReferencePort = {
  async findReferencedThumbnailPaths(paths) {
    if (paths.length === 0) return [];
    const rows = await prisma.$queryRaw<{ storage_path: string }[]>`
      SELECT "storage_path" FROM "public"."import_thumbnail_referenced_paths"(${paths}::text[])`;
    return rows.map((row) => row.storage_path);
  },
};
