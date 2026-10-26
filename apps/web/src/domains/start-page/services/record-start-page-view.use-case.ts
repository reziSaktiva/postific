import type { IStartPageAnalyticsRepository } from "../repositories/start-page-analytics.repository";
import { isLikelyBot } from "../value-objects/bot-detection";
import { normalizeSlug, parseSlug } from "../value-objects/slug";
import { StartPageDomainError } from "../errors";

/**
 * Catat satu kunjungan halaman publik (T-074). Best-effort: bot (heuristik
 * user-agent, lihat `bot-detection.ts`) dan slug tak valid diabaikan tanpa
 * menyentuh DB. Tanpa dedup per pengunjung (refresh = +1) dan tanpa PII —
 * hanya counter. Mengembalikan `true` bila counter naik.
 */
export class RecordStartPageView {
  constructor(private readonly analytics: IStartPageAnalyticsRepository) {}

  async execute(input: {
    slug: string;
    userAgent: string | null | undefined;
  }): Promise<boolean> {
    if (isLikelyBot(input.userAgent)) return false;
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
