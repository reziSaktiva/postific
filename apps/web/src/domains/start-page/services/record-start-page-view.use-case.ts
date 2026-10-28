import type { IStartPageAnalyticsRepository } from "../repositories/start-page-analytics.repository";
import { isLikelyBot } from "../value-objects/bot-detection";
import {
  isDocumentNavigation,
  type FetchMetadata,
} from "../value-objects/document-navigation";
import { normalizeSlug, parseSlug } from "../value-objects/slug";
import { StartPageDomainError } from "../errors";

/**
 * Catat satu kunjungan halaman publik (T-074). Best-effort: bot (heuristik
 * user-agent, lihat `bot-detection.ts`), request yang bukan navigasi dokumen
 * browser (mis. `HEAD`, yang Next.js render sebagai `GET`; lihat
 * `document-navigation.ts`, T-162.1), dan slug tak valid diabaikan tanpa
 * menyentuh DB. Tanpa dedup per pengunjung (refresh = +1) dan tanpa PII —
 * hanya counter. Mengembalikan `true` bila counter naik.
 */
export class RecordStartPageView {
  constructor(private readonly analytics: IStartPageAnalyticsRepository) {}

  async execute(
    input: {
      slug: string;
      userAgent: string | null | undefined;
    } & FetchMetadata,
  ): Promise<boolean> {
    if (isLikelyBot(input.userAgent)) return false;
    if (!isDocumentNavigation(input)) return false;
    let slug: string;
    try {
      slug = parseSlug(normalizeSlug(input.slug));
    } catch (error) {
      if (error instanceof StartPageDomainError) return false;
      throw error;
    }
    return this.analytics.recordView(slug);
  }
}
