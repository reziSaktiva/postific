import { cn } from "@/lib/utils";
import {
  formatCountDisplay,
  formatCountFull,
} from "@/components/start-page/format-count";

/**
 * Angka analytics Start Page (T-074, LOCKED 2026-10-26). Teks ringkas
 * visual (`12,5 rb`) di-`aria-hidden`; nilai penuh (`12.480 klik`) ada di
 * teks `sr-only` untuk pembaca layar dan di atribut `title` (hover).
 * `showUnit`: satuan ikut tampil secara visual (klik per tautan: "128 klik");
 * tanpa itu hanya angka yang tampil (total kunjungan memakai label sendiri)
 * tetapi pembaca layar tetap membaca satuan lengkap.
 */
export function CountText({
  value,
  unit,
  showUnit = false,
  className,
}: {
  value: number;
  unit: string;
  showUnit?: boolean;
  className?: string;
}) {
  const full = formatCountFull(value);
  const display = formatCountDisplay(value);
  return (
    <span
      className={cn("tabular-nums", className)}
      title={`${full} ${unit}`}
      data-count={value}
    >
      <span aria-hidden="true">
        {display}
        {showUnit ? ` ${unit}` : ""}
      </span>
      <span className="sr-only">
        {full} {unit}
      </span>
    </span>
  );
}
