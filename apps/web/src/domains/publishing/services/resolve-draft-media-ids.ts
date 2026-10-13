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
  const foundIds = new Set(foundMedia.map((item) => item.id));
  const missing = requestedMediaIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError(
      "Salah satu media yang dipilih tidak ditemukan atau bukan milik workspace ini.",
    );
  }
  return requestedMediaIds;
}
