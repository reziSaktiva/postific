import { START_PAGE_META_DESCRIPTION_MAX_LENGTH } from "./limits";

/** Deskripsi meta/OG dari bio: whitespace dirapikan, dipotong rapi dengan elipsis. */
export function buildMetaDescription(
  bio: string | null | undefined,
  fallback: string,
): string {
  const text = (bio ?? "").replace(/\s+/g, " ").trim();
  if (text.length === 0) return fallback;
  if (text.length <= START_PAGE_META_DESCRIPTION_MAX_LENGTH) return text;
  return `${text.slice(0, START_PAGE_META_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`;
}
