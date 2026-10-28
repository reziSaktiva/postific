/**
 * Format angka analytics Start Page (T-074, LOCKED 2026-10-26): di bawah
 * 10.000 ditulis penuh (id-ID, `1.842`), mulai 10.000 ringkas (`12,5 rb`,
 * `1,2 jt`, `2,5 M`). Murni presentasi — angka mentah (`viewCount`,
 * `clickCount`) tidak diubah.
 */
export const COMPACT_COUNT_THRESHOLD = 10_000;

const fullFormatter = new Intl.NumberFormat("id-ID");
const compactFormatter = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Angka penuh (id-ID) — dipakai pembaca layar dan atribut `title`. */
export function formatCountFull(value: number): string {
  return fullFormatter.format(value);
}

/** Angka untuk tampilan visual: penuh < 10.000, ringkas mulai 10.000. */
export function formatCountDisplay(value: number): string {
  return value < COMPACT_COUNT_THRESHOLD
    ? fullFormatter.format(value)
    : compactFormatter.format(value);
}
