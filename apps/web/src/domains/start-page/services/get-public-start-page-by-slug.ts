import { StartPageDomainError } from "../errors";
import type { IPublicStartPageRepository } from "../repositories/start-page.repository";
import type { PublicStartPage } from "../types";
import { normalizeSlug, parseSlug } from "../value-objects/slug";

/**
 * Use-case publik T-070.3 (ADR-128): resolve halaman Start Page untuk
 * `/u/[slug]`. Sengaja TANPA dependency session/workspace — dipanggil dari
 * route yang di-bypass `proxy.ts`, jadi tidak ada user/workspace context.
 *
 * Mengembalikan `null` untuk slug tak valid/reserved/tidak ada/belum
 * dipublikasikan (entry point menerjemahkannya ke 404). Slug yang pasti
 * tidak valid tidak menyentuh DB.
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
    return this.repository.findPublishedBySlug(slug);
  }
}
