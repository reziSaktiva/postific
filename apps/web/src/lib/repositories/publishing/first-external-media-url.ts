import type { Prisma } from "@/generated/prisma/client";

/**
 * URL media pertama di `platformOptions.mediaUrls` (T-227) — dipakai posting
 * hasil Import yang `mediaIds`-nya kosong. Hanya string http(s) yang diterima;
 * nilai lain (bukan objek, bukan array, URL bukan http) menjadi `null`.
 */
export function firstExternalMediaUrl(
  platformOptions: Prisma.JsonValue | null,
): string | null {
  if (
    platformOptions === null ||
    typeof platformOptions !== "object" ||
    Array.isArray(platformOptions)
  ) {
    return null;
  }
  const mediaUrls = (platformOptions as Record<string, unknown>).mediaUrls;
  if (!Array.isArray(mediaUrls)) return null;
  const first: unknown = mediaUrls[0];
  return typeof first === "string" && /^https?:\/\//i.test(first)
    ? first
    : null;
}
