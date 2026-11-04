"use client";

import { useEffect, useRef } from "react";
import { createPendingNavigationGate } from "@/lib/navigation/pending-terminal-navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  subscribeToPublishingPostChanges,
  type PublishingPostChangeEvent,
} from "@/lib/supabase/realtime/publishing-posts";

export interface UsePublishingPostsRealtimeHandlers {
  onInsert?: (event: PublishingPostChangeEvent) => void;
  onUpdate?: (event: PublishingPostChangeEvent) => void;
}

/**
 * T-092.2 (ADR-094 poin 2, 4, 6) — subscribe ke perubahan `publishing_posts`
 * milik `workspaceId` selama komponen pemanggil mount. Fondasi generic yang
 * dipakai 4 screen Publish (Calendar/Queue/Drafts/History, T-092.3-6);
 * screen tersebut memasang `onInsert`/`onUpdate` sendiri sesuai kriteria
 * tampilannya masing-masing (mis. Queue cuma peduli status `Scheduled`) —
 * hook ini tidak tahu apa-apa soal kriteria itu.
 *
 * `workspaceId` `null` berarti belum ada workspace aktif siap (mis. masih
 * loading) — hook tidak subscribe sampai tersedia.
 *
 * Sebelum subscribe, client otentikasi dulu ke Supabase Realtime lewat JWT
 * bridge (`/api/realtime/token`, reuse T-036.3 — generic, tidak
 * table-specific, tidak dibangun ulang di sini) supaya `auth.uid()`/klaim
 * `sub` valid untuk RLS `publishing_posts_realtime_workspace_members`
 * (T-092.1). Kalau fetch token gagal (network/401), error di-log via
 * `console.error` dan subscribe dibatalkan — sengaja tidak throw supaya
 * screen pemanggil tidak crash.
 *
 * Beda dari `useNotificationRealtime` (T-036.2, global sepanjang sesi lewat
 * registry shared per-`userId`): lifecycle di sini **per-screen** — dibuat
 * saat screen di-mount, dilepas saat unmount/pindah halaman/workspace
 * (ADR-094 poin 6) — cukup 1 dari 4 screen yang aktif dalam satu waktu di
 * satu tab, jadi tidak perlu dedupe/ref-count seperti notification bell.
 *
 * T-208 (KI-108): selama navigasi pascaaksi terminal Draft Editor berjalan
 * dari layar ini, event ditahan dan baru diproses setelah layar ini ditinggal
 * atau batas waktu lewat. Diduga (mekanismenya belum dibaca di router Next,
 * lihat T-208.1) server action milik handler layar ini membuat navigasi itu
 * tidak pernah selesai. Bila navigasi berhasil, layar ini sudah unmount dan
 * event yang tertahan dibuang bersama `dispose`.
 */
export function usePublishingPostsRealtime(
  workspaceId: string | null,
  handlers: UsePublishingPostsRealtimeHandlers,
): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!workspaceId) return;
    const activeWorkspaceId = workspaceId;

    const client = createBrowserSupabaseClient();
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const gate = createPendingNavigationGate();

    async function connect() {
      try {
        const response = await fetch("/api/realtime/token");
        if (!response.ok) {
          throw new Error(
            `Failed to fetch Supabase Realtime token: ${response.status}`,
          );
        }

        const { token } = (await response.json()) as { token: string };
        if (cancelled) return;

        await client.realtime.setAuth(token);
        if (cancelled) return;

        unsubscribe = subscribeToPublishingPostChanges(
          client,
          activeWorkspaceId,
          {
            onInsert: (event) =>
              gate.run(event.postId, () =>
                handlersRef.current.onInsert?.(event),
              ),
            onUpdate: (event) =>
              gate.run(event.postId, () =>
                handlersRef.current.onUpdate?.(event),
              ),
          },
        );
      } catch (error) {
        console.error(
          "usePublishingPostsRealtime: failed to authenticate Supabase Realtime client",
          error,
        );
      }
    }

    void connect();

    return () => {
      cancelled = true;
      gate.dispose();
      unsubscribe?.();
      client.realtime.disconnect();
    };
  }, [workspaceId]);
}
