import type { NetworkIssue } from "./network-validation";
import { extractLinkHost } from "./preview-model";

export const PIN_LINK_HINT = "Link harus diawali http:// atau https://";

/**
 * Petunjuk untuk field Destination Link Pinterest (tanpa memblokir). Link
 * dikirim apa adanya (hanya di-trim) ke Outstand
 * (`real-outstand-adapter.ts`, `platformOptions.pinLink`) dan tidak ada
 * validasi di sisi server kita, jadi nilai tanpa skema tidak diperbaiki
 * diam-diam: pemakai diberi tahu. Kosong = opsional, tanpa petunjuk.
 */
export function getPinLinkHint(link: string): string | null {
  if (link.trim() === "") {
    return null;
  }
  return extractLinkHost(link) === null ? PIN_LINK_HINT : null;
}

/**
 * Turunan murni untuk akordeon blok jaringan (T-202.2). Dipisah dari React
 * supaya aturan "blok mana yang terbuka" dan "apa yang terlihat di baris
 * ringkas" bisa dites tanpa render.
 */

/**
 * Blok yang terbuka: pilihan terakhir pemakai bila masih terpilih, selain itu
 * akun pertama. `renderedAccountIds` HARUS urutan yang sama dengan blok yang
 * dirender (urutan pilihan), bukan urutan daftar workspace, supaya blok
 * terbuka bawaan adalah blok paling atas di layar.
 */
export function resolveActiveAccountId(
  renderedAccountIds: readonly string[],
  openAccountId: string | undefined,
): string | undefined {
  if (openAccountId && renderedAccountIds.includes(openAccountId)) {
    return openAccountId;
  }
  return renderedAccountIds[0];
}

/**
 * Teks pelanggaran untuk baris ringkas blok yang tertutup: pesan pertama,
 * ditambah jumlah sisanya bila ada lebih dari satu. `undefined` bila tidak
 * ada pelanggaran.
 */
export function summarizeBlockIssues(
  issues: readonly NetworkIssue[] | undefined,
): string | undefined {
  if (!issues || issues.length === 0) {
    return undefined;
  }
  const [first, ...rest] = issues;
  return rest.length === 0
    ? first.message
    : `${first.message} (+${rest.length} lagi)`;
}
