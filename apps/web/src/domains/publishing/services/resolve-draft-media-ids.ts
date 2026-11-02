import type { MediaId } from "@postific/shared";
import { ValidationError } from "@/lib/utils/errors";

/** Bentuk minimal yang dibutuhkan dari `MediaItemRecord` (domain `media`) untuk validasi ini. */
export interface MediaOwnershipRecord {
  id: MediaId;
}

/**
 * Cocokkan `mediaIds` yang diminta client (belum tentu valid/milik
 * workspace ini) dengan daftar `MediaItem` yang sudah di-resolve dari DB
 * (`MediaService.listByIds`, di-scope `workspaceId` di level repository
 * media — anti-IDOR sudah ditegakkan di sana). Melempar `ValidationError`
 * kalau ada `mediaId` yang tidak ditemukan di daftar itu (tidak ada, sudah
 * dihapus, atau bukan milik workspace ini).
 *
 * Pola sama `resolveScheduleTargets` (cross-domain validation dipisah dari
 * Server Action supaya bisa dipakai ulang entry point lain tanpa
 * duplikasi, dan supaya Server Action tetap "wiring saja" — business rule
 * hidup di domain, bukan di `actions.ts`).
 */
export function resolveDraftMediaIds(
  foundMedia: MediaOwnershipRecord[],
  requestedMediaIds: MediaId[],
): MediaId[] {
  // UUID tidak peka huruf besar-kecil (T-192.7); id yang dikembalikan adalah
  // bentuk kanonik dari DB, bukan ejaan klien.
  const canonicalById = new Map(
    foundMedia.map((item) => [item.id.toLowerCase(), item.id]),
  );
  const resolved: MediaId[] = [];
  for (const id of requestedMediaIds) {
    const canonical = canonicalById.get(id.toLowerCase());
    if (canonical === undefined) {
      throw new ValidationError(
        "Salah satu media yang dipilih tidak ditemukan atau bukan milik workspace ini.",
      );
    }
    resolved.push(canonical);
  }
  if (new Set(resolved).size !== resolved.length) {
    throw new ValidationError(
      "Media yang sama dipilih lebih dari sekali. Satu media cukup satu kali.",
    );
  }
  return resolved;
}
