/** Domain-specific types for start-page. */

/**
 * Tautan pada halaman publik Start Page (T-070.2). Sengaja HANYA berisi
 * field yang aman untuk audiens anonim — tanpa `clickCount`, `isActive`,
 * `startPageId`, timestamp, dst. (data internal/analitik).
 */
export interface PublicStartPageLink {
  id: string;
  label: string;
  url: string;
}

/**
 * Proyeksi publik sebuah Start Page (ADR-128, `/u/[slug]`). Sengaja TANPA
 * `workspaceId`, `viewCount`, `isPublished`, `createdAt`/`updatedAt` —
 * halaman ini dibaca audiens anonim tanpa workspace context, jadi tidak
 * boleh membocorkan data internal tenant. `links` sudah terfilter aktif dan
 * terurut menurut `position`.
 */
export interface PublicStartPage {
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: string;
  links: PublicStartPageLink[];
}
