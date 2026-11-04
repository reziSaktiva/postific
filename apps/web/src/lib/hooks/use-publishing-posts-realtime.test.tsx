// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { asPostId } from "@postific/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  markTerminalNavigationPending,
  resetTerminalNavigationForTests,
} from "@/lib/navigation/pending-terminal-navigation";
import type { PublishingPostRealtimeHandlers } from "@/lib/supabase/realtime/publishing-posts";

/**
 * T-208.1: sambungan hook Realtime bersama (dipakai Queue, Calendar, Drafts,
 * dan History) dengan gerbang navigasi terminal. Supabase dan fetch dipalsukan;
 * gerbang yang dipakai adalah implementasi nyata.
 */
const supabase = vi.hoisted(() => ({
  setAuth: vi.fn(),
  disconnect: vi.fn(),
  unsubscribe: vi.fn(),
  handlers: undefined as PublishingPostRealtimeHandlers | undefined,
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    realtime: { setAuth: supabase.setAuth, disconnect: supabase.disconnect },
  }),
}));
vi.mock("@/lib/supabase/realtime/publishing-posts", () => ({
  subscribeToPublishingPostChanges: (
    _client: unknown,
    _workspaceId: string,
    handlers: PublishingPostRealtimeHandlers,
  ) => {
    supabase.handlers = handlers;
    return supabase.unsubscribe;
  },
}));

import { usePublishingPostsRealtime } from "./use-publishing-posts-realtime";

const POST = asPostId("11111111-1111-4111-8111-111111111111");

beforeEach(() => {
  vi.clearAllMocks();
  supabase.handlers = undefined;
  resetTerminalNavigationForTests();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ token: "t" }) })),
  );
});
afterEach(() => {
  cleanup();
  resetTerminalNavigationForTests();
  vi.unstubAllGlobals();
});

async function mountSubscribed() {
  const onInsert = vi.fn();
  const onUpdate = vi.fn();
  const view = renderHook(() =>
    usePublishingPostsRealtime("ws-1", { onInsert, onUpdate }),
  );
  await waitFor(() => expect(supabase.handlers).toBeDefined());
  return { onInsert, onUpdate, ...view };
}

describe("usePublishingPostsRealtime dengan gerbang navigasi terminal", () => {
  it("tanpa navigasi tertunda, event langsung diteruskan", async () => {
    const { onInsert, onUpdate } = await mountSubscribed();
    supabase.handlers?.onInsert?.({ postId: POST, eventType: "INSERT" });
    supabase.handlers?.onUpdate?.({ postId: POST, eventType: "UPDATE" });
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("selama navigasi terminal tertunda, event ditahan lalu dilepas setelah layar asal ditinggal", async () => {
    const { onInsert } = await mountSubscribed();
    // Layar asal = path jsdom saat ini ("/").
    markTerminalNavigationPending();
    supabase.handlers?.onInsert?.({ postId: POST, eventType: "INSERT" });
    expect(onInsert).not.toHaveBeenCalled();

    // Navigasi selesai tanpa unmount (layar lain tetap memakai hook ini):
    // path bukan layar asal lagi, penanda berakhir.
    markTerminalNavigationPending({ origin: "/layar-lain" });
    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
  });

  it("layar unmount selagi event ditahan: event dibuang, tidak ada server action tertinggal", async () => {
    const { onInsert, unmount } = await mountSubscribed();
    markTerminalNavigationPending();
    supabase.handlers?.onInsert?.({ postId: POST, eventType: "INSERT" });
    unmount();
    markTerminalNavigationPending({ origin: "/layar-lain" });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(onInsert).not.toHaveBeenCalled();
    expect(supabase.unsubscribe).toHaveBeenCalled();
  });

  it("tanpa workspace aktif tidak subscribe", async () => {
    renderHook(() => usePublishingPostsRealtime(null, {}));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(supabase.handlers).toBeUndefined();
  });
});
