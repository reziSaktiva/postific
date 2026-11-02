import { ContentFormat } from "@postific/shared";

/**
 * Aturan caption dan Story (KI-073) yang dipakai bersama Draft Editor
 * (`Modal.tsx`) dan Safety Check di server (`assertScheduleSafetyCheck`,
 * T-153), supaya tidak ada dua salinan yang bisa menyimpang (T-192.1). Pola
 * sama `pinterestBoardConstraintMessage`: fungsi murni, mengembalikan pesan
 * atau `null`.
 */
export const CAPTION_REQUIRED_MESSAGE =
  "Caption wajib diisi, kecuali semua konten ini berformat Story (Story tampil tanpa caption).";

export const MIXED_STORY_CAPTION_MESSAGE =
  "Story tidak bisa digabung dengan target lain selama caption terisi — kosongkan caption atau publish Story secara terpisah dari target lainnya.";

/** Caption wajib hanya bila tidak ada target Story sama sekali. */
export function isCaptionRequiredForFormats(
  formats: ReadonlyArray<ContentFormat>,
): boolean {
  return !formats.includes(ContentFormat.Story);
}

/** Pesan bila caption kosong padahal wajib; `null` bila boleh. */
export function captionRequiredConstraintMessage(
  caption: string,
  formats: ReadonlyArray<ContentFormat>,
): string | null {
  return isCaptionRequiredForFormats(formats) && caption.trim().length === 0
    ? CAPTION_REQUIRED_MESSAGE
    : null;
}

/** Pesan bila Story digabung target lain selama caption terisi; `null` bila aman. */
export function mixedStoryCaptionConstraintMessage(
  caption: string,
  formats: ReadonlyArray<ContentFormat>,
): string | null {
  const hasStory = formats.includes(ContentFormat.Story);
  const hasNonStory = formats.some((format) => format !== ContentFormat.Story);
  return hasStory && hasNonStory && caption.trim().length > 0
    ? MIXED_STORY_CAPTION_MESSAGE
    : null;
}
