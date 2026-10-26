import type { PublicStartPage } from "../types";

/**
 * Port baca publik untuk halaman Start Page (T-070.2, ADR-128). Dipakai
 * route publik `/u/[slug]` yang diakses TANPA session — karena itu kontrak
 * ini tidak menerima `workspaceId`/`userId` dan hanya mengembalikan
 * proyeksi aman-anonim (`PublicStartPage`). Implementasi Prisma ada di
 * `lib/repositories/start-page/`; domain tidak mengimpor Prisma.
 */
export interface IPublicStartPageRepository {
  /**
   * Mengembalikan halaman HANYA bila `isPublished`; `null` bila slug tidak
   * ada ATAU belum dipublikasikan (keduanya sengaja tak terbedakan supaya
   * keberadaan draft tidak bocor). `links` hanya yang aktif, terurut
   * `position` naik. Slug sudah harus tervalidasi/dinormalisasi caller.
   */
  findPublishedBySlug(slug: string): Promise<PublicStartPage | null>;
}
