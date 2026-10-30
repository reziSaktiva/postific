import { StartPageDomainError } from "../errors";
import type { IStartPageAnalyticsRepository } from "../repositories/start-page-analytics.repository";
import type { IPublicStartPageRepository } from "../repositories/start-page.repository";
import { isUuid } from "../validation";
import { isLikelyBot } from "../value-objects/bot-detection";
import { sanitizeLinkUrl } from "../value-objects/safe-url";
import { normalizeSlug, parseSlug } from "../value-objects/slug";

/**
 * Resolusi redirect klik tautan (T-074, `/u/[slug]/go/[linkId]`). Tanpa
 * session/workspace. Mengembalikan URL tujuan yang SUDAH divalidasi
 * http/https ulang (jangan pernah redirect ke skema lain), atau `null`
 * (-> 404) bila slug/linkId tak valid, halaman draft, tautan nonaktif/tidak
 * ada, atau URL tersimpan ternyata tidak aman.
 *
 * Klik dari bot/crawler tetap diarahkan tapi TIDAK dihitung (lewat jalur
 * baca publik, bukan fungsi counter). Permintaan HEAD memakai
 * `countClick: false` untuk alasan yang sama.
 */
export class ResolveStartPageLinkRedirect {
  constructor(
    private readonly analytics: IStartPageAnalyticsRepository,
    private readonly publicRepository: IPublicStartPageRepository,
  ) {}

  async execute(input: {
    slug: string;
    linkId: string;
    userAgent: string | null | undefined;
    countClick?: boolean;
  }): Promise<string | null> {
    let slug: string;
    try {
      slug = parseSlug(normalizeSlug(input.slug));
    } catch (error) {
      if (error instanceof StartPageDomainError) return null;
      throw error;
    }
    if (!isUuid(input.linkId)) return null;

    const shouldCount =
      (input.countClick ?? true) && !isLikelyBot(input.userAgent);

    if (shouldCount) {
      const url = await this.analytics.recordClickAndGetUrl(
        slug,
        input.linkId.toLowerCase(),
      );
      return url === null ? null : sanitizeLinkUrl(url);
    }

    const page = await this.publicRepository.findPublishedBySlug(slug);
    const link = page?.links.find(
      (l) => l.id.toLowerCase() === input.linkId.toLowerCase(),
    );
    return link ? sanitizeLinkUrl(link.url) : null;
  }
}
