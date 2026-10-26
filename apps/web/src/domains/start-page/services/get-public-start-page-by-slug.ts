import { StartPageDomainError } from "../errors";
import type { IPublicStartPageRepository } from "../repositories/start-page.repository";
import type { PublicStartPage } from "../types";
import { sanitizeAvatarUrl, sanitizeLinkUrl } from "../value-objects/safe-url";
import { normalizeSlug, parseSlug } from "../value-objects/slug";
import { parseStartPageTheme } from "../value-objects/theme";

/**
 * Use-case publik T-070.3 (ADR-128): resolve halaman Start Page untuk
 * `/u/[slug]`. Sengaja TANPA dependency session/workspace — dipanggil dari
 * route yang di-bypass `proxy.ts`, jadi tidak ada user/workspace context.
 *
 * Mengembalikan `null` untuk slug tak valid/reserved/tidak ada/belum
 * dipublikasikan (entry point menerjemahkannya ke 404). Slug yang pasti
 * tidak valid tidak menyentuh DB.
 *
 * Sanitasi untuk render (prasyarat review T-070, T-071): tautan dengan url
 * non-http(s) DIBUANG, `avatarUrl` non-https jadi `null`, `theme` di luar
 * allowlist jatuh ke "default". Dengan begitu UI tidak bisa lupa memvalidasi.
 */
export class GetPublicStartPageBySlug {
  constructor(private readonly repository: IPublicStartPageRepository) {}

  async execute(rawSlug: string): Promise<PublicStartPage | null> {
    let slug: string;
    try {
      slug = parseSlug(normalizeSlug(rawSlug));
    } catch (error) {
      if (error instanceof StartPageDomainError) return null;
      throw error;
    }
    const page = await this.repository.findPublishedBySlug(slug);
    if (!page) return null;
    return {
      ...page,
      avatarUrl: sanitizeAvatarUrl(page.avatarUrl),
      theme: parseStartPageTheme(page.theme),
      links: page.links.flatMap((link) => {
        const url = sanitizeLinkUrl(link.url);
        return url ? [{ ...link, url }] : [];
      }),
    };
  }
}
