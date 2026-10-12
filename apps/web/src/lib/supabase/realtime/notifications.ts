import type { SupabaseClient } from "@supabase/supabase-js";
import { asNotificationId, asUserId, asWorkspaceId } from "@postific/shared";
import type { NotificationType } from "@postific/shared";
import type { NotificationRecord } from "@/domains/notification";

/**
 * Raw row shape delivered by Supabase Realtime's `postgres_changes` payload
 * (snake_case, straight from the `notifications` table — no Prisma mapping
 * involved, unlike `toRecord()` in `lib/repositories/notification`).
 */
export interface NotificationRealtimeRow {
  id: string;
  workspace_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

export function toNotificationRecord(
  row: NotificationRealtimeRow,
): NotificationRecord {
  return {
    id: asNotificationId(row.id),
    workspaceId: asWorkspaceId(row.workspace_id),
    userId: asUserId(row.user_id),
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Wiring T-036.2 (ADR-023, RT-D01/RT-D03): subscribe ke tabel `notifications`,
 * event `INSERT` saja, filter `user_id = eq.{userId}` — satu-satunya tabel
 * yang Realtime boleh dipakai untuk baseline ini (perluasan ke
 * `publishing_posts` ada di ADR-094, domain terpisah).
 *
 * `client` HARUS sudah terautentikasi dengan Supabase Realtime JWT (sub =
 * userId) supaya RLS policy `notifications_realtime_own_rows` meloloskan
 * baris ini — bridging dari session Better Auth ke `client.realtime.setAuth`
 * dilakukan pemanggil (`useNotificationRealtime`, T-036.3) sebelum fungsi
 * ini dipanggil. Tanpa itu, subscription tetap terbentuk tapi tidak akan
 * menerima baris apa pun (RLS default-deny).
 *
 * Mengembalikan fungsi unsubscribe (dipanggil saat logout/unmount — RT-D
 * "Subscription dihapus saat user logout atau session berakhir").
 */
export function subscribeToNotificationInserts(
  client: SupabaseClient,
  userId: string,
  onInsert: (notification: NotificationRecord) => void,
): () => void {
  const channel = client
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onInsert(toNotificationRecord(payload.new as NotificationRealtimeRow));
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
