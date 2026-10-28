import type { IStartPageAnalyticsRepository } from "@/domains/start-page";
import { prisma } from "@/lib/prisma/client";

/**
 * Implementasi Prisma `IStartPageAnalyticsRepository` (T-074). Jalur anonim
 * seperti `publicStartPageRepository`: tanpa `withCurrentUser`, lewat dua
 * fungsi SECURITY DEFINER sempit (migrasi
 * `20261026133000_t074_start_page_analytics_functions`, pola ADR-142) yang
 * hanya menaikkan counter pada halaman published. Parameter di-bind
 * (tagged template); `::uuid` eksplisit karena Prisma mengirim string.
 * Fungsi view mengembalikan boolean (bukan void) karena `$queryRaw` tidak
 * dapat men-deserialisasi tipe `void`.
 */
export const startPageAnalyticsRepository: IStartPageAnalyticsRepository = {
  async recordView(slug) {
    const rows = await prisma.$queryRaw<{ recorded: boolean }[]>`
      SELECT "public"."start_page_record_view"(${slug}) AS recorded
    `;
    return rows[0]?.recorded === true;
  },

  async recordClickAndGetUrl(slug, linkId) {
    const rows = await prisma.$queryRaw<{ url: string | null }[]>`
      SELECT "public"."start_page_record_click_and_get_url"(${slug}, ${linkId}::uuid) AS url
    `;
    return rows[0]?.url ?? null;
  },
};
