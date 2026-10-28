import { CountText } from "./CountText";

/**
 * Total kunjungan di kanan page-head (T-074, LOCKED 2026-10-26; `.sp-visits`
 * memakai gaya `.stat-num`/`.stat-label`). Nol data: `0` + petunjuk
 * "Belum ada kunjungan. Bagikan URL halaman Anda.".
 */
export function VisitsStat({ viewCount }: { viewCount: number }) {
  return (
    <section
      aria-label="Total kunjungan halaman publik"
      className="flex min-w-0 flex-col items-end text-right"
    >
      <CountText
        value={viewCount}
        unit="kunjungan"
        className="font-heading text-2xl font-semibold tracking-tight"
      />
      <span className="text-sm text-muted-foreground">
        Total kunjungan sejak dipublish
      </span>
      {viewCount === 0 ? (
        <span className="mt-0.5 max-w-56 text-sm text-muted-foreground">
          Belum ada kunjungan. Bagikan URL halaman Anda.
        </span>
      ) : null}
    </section>
  );
}
