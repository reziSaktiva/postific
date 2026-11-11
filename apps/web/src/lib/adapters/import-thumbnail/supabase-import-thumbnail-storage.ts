import type {
  IImportThumbnailStorage,
  StoredImportThumbnail,
} from "@/domains/publishing";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MEDIA_BUCKET = "media";
const LIST_PAGE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Waktu terbaru dari dua stempel opsional; `null` bila keduanya tak terbaca. */
export function latestTimestamp(
  ...values: Array<string | null | undefined>
): Date | null {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((time) => !Number.isNaN(time));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

/**
 * Implementasi pembersihan thumbnail posting impor di Supabase Storage
 * (T-231, ADR-158). Bucket `media` Private; path
 * `{workspaceId}/imports/{targetId}.webp`. Hanya menyentuh folder `imports/`
 * di bawah folder berawalan UUID workspace, tidak pernah media unggahan
 * pengguna (`{workspaceId}/{tahun}/{bulan}/...`).
 */
export const supabaseImportThumbnailStorage: IImportThumbnailStorage = {
  async listWorkspaceIds() {
    const supabase = createServerSupabaseClient();
    const ids: string[] = [];
    for (let offset = 0; ; offset += LIST_PAGE) {
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .list("", { limit: LIST_PAGE, offset });
      if (error) {
        throw new Error(`Gagal membaca daftar bucket media: ${error.message}`);
      }
      for (const entry of data ?? []) {
        if (UUID.test(entry.name)) ids.push(entry.name);
      }
      if (!data || data.length < LIST_PAGE) return ids;
    }
  },

  async listWorkspaceThumbnails(workspaceId, { offset, limit }) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .list(`${workspaceId}/imports`, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) {
      throw new Error(
        `Gagal membaca thumbnail impor ${workspaceId}: ${error.message}`,
      );
    }
    return (data ?? [])
      .filter((entry) => entry.id !== null)
      .map((entry): StoredImportThumbnail => ({
        path: `${workspaceId}/imports/${entry.name}`,
        // Waktu terakhir berkas disentuh: upload ulang (upsert) mengubah
        // `updated_at` tetapi tidak `created_at` (review Ridwan P1).
        createdAt: latestTimestamp(entry.created_at, entry.updated_at),
      }));
  },

  async removePaths(paths) {
    if (paths.length === 0) return;
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    if (error) {
      throw new Error(`Gagal menghapus thumbnail impor: ${error.message}`);
    }
  },
};
