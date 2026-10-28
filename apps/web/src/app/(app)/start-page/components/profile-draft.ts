import {
  normalizeSlug,
  sanitizeAvatarUrl,
  type PublicStartPage,
  type StartPageRecord,
  type StartPageTheme,
  type UpdateStartPageProfileInput,
} from "@/domains/start-page";

/**
 * Draft form profil Page Editor (state UI, belum disimpan). Murni
 * presentasi/diff: validasi otoritatif tetap di `StartPageService`; di sini
 * hanya menyusun patch (field yang berubah saja), menghitung peringatan
 * slug, dan memproyeksikan draft ke bentuk publik untuk Preview.
 */
export interface ProfileDraft {
  title: string;
  slug: string;
  bio: string;
  avatarUrl: string;
  theme: StartPageTheme;
}

export function toProfileDraft(page: StartPageRecord): ProfileDraft {
  return {
    title: page.title,
    slug: page.slug,
    bio: page.bio ?? "",
    avatarUrl: page.avatarUrl ?? "",
    theme: page.theme,
  };
}

/** Teks kosong/spasi saja berarti "tidak diisi" -> `null` (hapus). */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Patch hanya berisi field yang berbeda dari data tersimpan (service
 * menolak patch kosong dan hanya mengubah field yang dikirim).
 * `bio`/`avatarUrl` kosong dikirim `null` = hapus.
 */
export function buildProfilePatch(
  page: StartPageRecord,
  draft: ProfileDraft,
): UpdateStartPageProfileInput {
  const patch: UpdateStartPageProfileInput = {};
  if (draft.title.trim() !== page.title) patch.title = draft.title;
  if (normalizeSlug(draft.slug) !== page.slug) patch.slug = draft.slug;
  if (emptyToNull(draft.bio) !== page.bio) patch.bio = emptyToNull(draft.bio);
  if (emptyToNull(draft.avatarUrl) !== page.avatarUrl) {
    patch.avatarUrl = emptyToNull(draft.avatarUrl);
  }
  if (draft.theme !== page.theme) patch.theme = draft.theme;
  return patch;
}

export function isProfileDirty(
  page: StartPageRecord,
  draft: ProfileDraft,
): boolean {
  return Object.keys(buildProfilePatch(page, draft)).length > 0;
}

/**
 * Mengubah slug saat halaman Published mematikan URL lama yang sudah
 * dibagikan — UI menampilkan peringatan.
 */
export function isPublishedSlugChange(
  page: StartPageRecord,
  draft: ProfileDraft,
): boolean {
  return page.isPublished && normalizeSlug(draft.slug) !== page.slug;
}

/**
 * Proyeksi draft + tautan tersimpan ke bentuk publik untuk Preview:
 * hanya tautan aktif (urutan tersimpan), avatar hanya https valid, judul
 * kosong jatuh ke judul tersimpan.
 */
export function toPreviewPage(
  page: StartPageRecord,
  draft: ProfileDraft,
): PublicStartPage {
  return {
    slug: page.slug,
    title: draft.title.trim() || page.title,
    bio: emptyToNull(draft.bio),
    avatarUrl: sanitizeAvatarUrl(draft.avatarUrl),
    theme: draft.theme,
    links: page.links
      .filter((link) => link.isActive)
      .map(({ id, label, url }) => ({ id, label, url })),
  };
}

/** True bila semua tautan belum pernah diklik dan halaman belum dikunjungi. */
export function hasNoAnalyticsData(page: StartPageRecord): boolean {
  return page.viewCount === 0 && page.links.every((l) => l.clickCount === 0);
}
