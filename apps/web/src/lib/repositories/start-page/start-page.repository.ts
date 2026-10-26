import type {
  IPublicStartPageRepository,
  PublicStartPage,
} from "@/domains/start-page";
import { prisma } from "@/lib/prisma/client";

interface PublicStartPageRow {
  slug: string;
  title: string;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  link_id: string | null;
  link_label: string | null;
  link_url: string | null;
}

/**
 * Implementasi Prisma `IPublicStartPageRepository` (T-070.2). Jalur anonim:
 * TIDAK memakai `withCurrentUser` (tidak ada user). Role `app_runtime`
 * tidak punya akses baca ke tabel start page tanpa membership, jadi lookup
 * lewat fungsi SECURITY DEFINER sempit `start_page_get_public_by_slug`
 * (migrasi `20261026120000_t070_start_page_public_read_function`) yang hanya
 * mengembalikan kolom aman anonim (tanpa `workspace_id`, `view_count`,
 * `click_count`), hanya halaman published, tautan aktif terurut `position`.
 * Parameter di-bind (tagged template), bukan interpolasi string. Primary
 * check tetap di sisi aplikasi/SQL fungsi (AU-D06).
 */
export const publicStartPageRepository: IPublicStartPageRepository = {
  async findPublishedBySlug(slug: string): Promise<PublicStartPage | null> {
    const rows = await prisma.$queryRaw<PublicStartPageRow[]>`
      SELECT * FROM "public"."start_page_get_public_by_slug"(${slug})
    `;
    const first = rows[0];
    if (!first) return null;
    return {
      slug: first.slug,
      title: first.title,
      bio: first.bio,
      avatarUrl: first.avatar_url,
      theme: first.theme,
      links: rows.flatMap((row) =>
        row.link_id !== null && row.link_label !== null && row.link_url !== null
          ? [{ id: row.link_id, label: row.link_label, url: row.link_url }]
          : [],
      ),
    };
  },
};
