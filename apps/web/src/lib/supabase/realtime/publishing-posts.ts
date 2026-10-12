import type { SupabaseClient } from "@supabase/supabase-js";
import { asPostId } from "@postific/shared";
import type { PostId } from "@postific/shared";

/**
 * Raw row shape delivered by Supabase Realtime's `postgres_changes` payload
 * for `publishing_posts` (snake_case, straight from the table). Only `id`
 * matters for the granular-patch strategy (ADR-094 poin 5) — the consuming
 * screen fetches its own mapped record via `PublishingService`, it never
 * trusts this raw row as the source of truth for rendering.
 */
export interface PublishingPostRealtimeRow {
  id: string;
  [key: string]: unknown;
}

export type PublishingPostChangeEventType = "INSERT" | "UPDATE";

/**
 * Minimal event shape handed to screen-level consumers (T-092.3-6):
 * `{ postId, eventType }` — exactly what ADR-094 poin 5 specifies. Screens
 * use `postId` to fetch the single mapped record from `PublishingService`
 * and upsert/remove it from their own local state based on view criteria.
 */
export interface PublishingPostChangeEvent {
  postId: PostId;
  eventType: PublishingPostChangeEventType;
}

export interface PublishingPostRealtimeHandlers {
  onInsert?: (event: PublishingPostChangeEvent) => void;
  onUpdate?: (event: PublishingPostChangeEvent) => void;
}

/**
 * Wiring T-092.2 (ADR-094 poin 2, 4) — subscribe ke tabel `publishing_posts`,
 * event `INSERT`/`UPDATE` (tanpa `DELETE` — soft-delete tercermin sebagai
 * `UPDATE`), filter `workspace_id = eq.{workspaceId}` — channel per-workspace
 * (beda dari `notifications` yang per-user, lihat
 * `lib/supabase/realtime/notifications.ts`).
 *
 * `client` HARUS sudah terautentikasi dengan Supabase Realtime JWT (sub =
 * userId, reuse `/api/realtime/token` dari T-036) supaya RLS policy
 * `publishing_posts_realtime_workspace_members` (T-092.1) meloloskan baris
 * ini — bridging dilakukan pemanggil (`usePublishingPostsRealtime`) sebelum
 * fungsi ini dipanggil.
 *
 * Generic dan reusable oleh 4 screen (Calendar/Queue/Drafts/History,
 * T-092.3-6) — tidak hardcode kriteria tampilan screen manapun, tiap
 * pemanggil memasang `onInsert`/`onUpdate` sendiri.
 *
 * Mengembalikan fungsi unsubscribe (dipanggil saat unmount/pindah
 * halaman/workspace — ADR-094 poin 6, lifecycle per-screen, bukan global
 * seperti notification bell).
 */
export function subscribeToPublishingPostChanges(
  client: SupabaseClient,
  workspaceId: string,
  handlers: PublishingPostRealtimeHandlers,
): () => void {
  const channel = client
    .channel(`publishing_posts:${workspaceId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "publishing_posts",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        handlers.onInsert?.({
          postId: asPostId((payload.new as PublishingPostRealtimeRow).id),
          eventType: "INSERT",
        });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "publishing_posts",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        handlers.onUpdate?.({
          postId: asPostId((payload.new as PublishingPostRealtimeRow).id),
          eventType: "UPDATE",
        });
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
