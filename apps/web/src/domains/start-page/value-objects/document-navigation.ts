/**
 * Pembeda "kunjungan sungguhan" vs request non-navigasi untuk counter view
 * Start Page (T-162.1, ADR-143 § Consequences).
 *
 * Masalah: Next.js merender `HEAD` ke sebuah page sebagai `GET`, dan metode
 * HTTP TIDAK diekspos ke Server Component/`after()` (Next 16.2: hanya Route
 * Handler yang menerima `request.method`). Jadi `HEAD` dengan user-agent
 * browser (link checker, pratinjau) lolos `isLikelyBot` dan menaikkan counter.
 *
 * Solusi: hitung hanya request yang browser tandai sebagai navigasi dokumen
 * lewat Fetch Metadata (`Sec-Fetch-Dest: document` + `Sec-Fetch-Mode:
 * navigate`). Browser selalu mengirimnya pada kunjungan nyata dan tidak
 * pernah mengirim `HEAD` untuk navigasi, sedangkan `HEAD` dari tool/skrip
 * tidak membawa header ini. Fail-closed: header hilang = tidak dihitung.
 *
 * Batasan (heuristik, sejalan dengan ADR-143 poin 5-6):
 * - header ini sengaja bisa dipalsukan klien non-browser (tidak ada
 *   jaminan anti-fraud);
 * - browser tanpa Fetch Metadata (mis. Safari < 16.4) dan akses lewat HTTP
 *   non-secure selain localhost tidak terhitung;
 * - fetch RSC/prefetch Next.js (`Sec-Fetch-Dest: empty`) tidak dihitung.
 */
export interface FetchMetadata {
  /** Nilai header `Sec-Fetch-Dest`. */
  fetchDest: string | null | undefined;
  /** Nilai header `Sec-Fetch-Mode`. */
  fetchMode: string | null | undefined;
}

export function isDocumentNavigation(meta: FetchMetadata): boolean {
  return (
    meta.fetchDest?.trim().toLowerCase() === "document" &&
    meta.fetchMode?.trim().toLowerCase() === "navigate"
  );
}
