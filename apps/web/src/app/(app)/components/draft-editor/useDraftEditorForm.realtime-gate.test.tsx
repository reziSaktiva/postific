// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { SocialPlatform, asPostId } from "@postific/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTerminalNavigationForTests } from "@/lib/navigation/pending-terminal-navigation";
import type { PublishingPostRealtimeHandlers } from "@/lib/supabase/realtime/publishing-posts";

/**
 * T-208.1 (KI-108): bukti lintas batas, aksi terminal Draft Editor yang nyata
 * bersama hook Realtime bersama yang nyata. Router Next dimodelkan menurut
 * antrean aksi App Router (Next 16.2.10, `app-router-instance.js`,
 * `dispatchAction`): server action yang dikirim selagi navigasi masih tertunda
 * ikut antre di belakang navigasi itu. Tes gagal bila server action milik
 * handler Realtime (`getQueuePostAction` di Queue) dikirim selama navigasi
 * `router.push` tertunda. Tidak membuktikan perilaku router sungguhan.
 */
const actionMocks = vi.hoisted(() => ({
  getConnectedAccountsAction: vi.fn(),
  getLastUsedAccountIdsAction: vi.fn(),
  getDraftAction: vi.fn(),
  publishNowAction: vi.fn(),
  saveDraftAction: vi.fn(),
  scheduleDraftAction: vi.fn(),
  updateDraftAction: vi.fn(),
  listPinterestBoardsAction: vi.fn(),
  uploadMediaAction: vi.fn(),
  deleteMediaAction: vi.fn(),
}));
const router = vi.hoisted(() => ({
  /** `router.push` sudah dipanggil dan path belum berpindah. */
  navigationInFlight: false,
  pushedTo: undefined as string | undefined,
}));
const supabase = vi.hoisted(() => ({
  handlers: undefined as PublishingPostRealtimeHandlers | undefined,
}));

vi.mock("./actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (to: string) => {
      router.navigationInFlight = true;
      router.pushedTo = to;
    },
    refresh: () => {},
  }),
  usePathname: () => window.location.pathname,
}));
vi.mock("./Context", () => ({
  useDraftEditor: () => ({ close: vi.fn(), clearUnsavedNewPost: vi.fn() }),
}));
vi.mock("@/lib/time/user-time-zone-context", () => ({
  useUserTimeZone: () => "Asia/Jakarta",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/domains/publishing", async () => {
  const matrix = await import("@/domains/publishing/content-format-matrix");
  const story = await import("@/domains/publishing/story-caption-constraints");
  return {
    maxMediaCountForFormats: matrix.maxMediaCountForFormats,
    isCaptionRequiredForFormats: story.isCaptionRequiredForFormats,
  };
});
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    realtime: { setAuth: vi.fn(), disconnect: vi.fn() },
  }),
}));
vi.mock("@/lib/supabase/realtime/publishing-posts", () => ({
  subscribeToPublishingPostChanges: (
    _client: unknown,
    _workspaceId: string,
    handlers: PublishingPostRealtimeHandlers,
  ) => {
    supabase.handlers = handlers;
    return vi.fn();
  },
}));

import { usePublishingPostsRealtime } from "@/lib/hooks/use-publishing-posts-realtime";
import { useDraftEditorForm } from "./useDraftEditorForm";

const FACEBOOK = {
  id: "fb",
  platform: SocialPlatform.Facebook,
  handle: "fb",
  status: "active",
};
const POST = asPostId("11111111-1111-4111-8111-111111111111");

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Server action milik layar asal; salah bila dikirim selagi navigasi tertunda. */
const serverActionDispatches = { total: 0, whileNavigating: 0 };
function realtimeServerAction() {
  serverActionDispatches.total += 1;
  if (router.navigationInFlight) serverActionDispatches.whileNavigating += 1;
}

async function mountOriginScreen(origin: string) {
  window.history.pushState({}, "", origin);
  actionMocks.getConnectedAccountsAction.mockResolvedValue([FACEBOOK]);
  actionMocks.getLastUsedAccountIdsAction.mockResolvedValue([]);
  actionMocks.saveDraftAction.mockResolvedValue({ postId: "p1" });
  actionMocks.scheduleDraftAction.mockResolvedValue({ postId: "p1" });
  actionMocks.publishNowAction.mockResolvedValue({ postId: "p1" });

  const screen = renderHook(() =>
    usePublishingPostsRealtime("ws-1", {
      onInsert: realtimeServerAction,
      onUpdate: realtimeServerAction,
    }),
  );
  await waitFor(() => expect(supabase.handlers).toBeDefined());

  const editor = renderHook(() =>
    useDraftEditorForm({ mode: "create", onLatestChange: vi.fn() }),
  );
  await waitFor(() =>
    expect(editor.result.current.isLoadingAccounts).toBe(false),
  );
  act(() => {
    editor.result.current.setCaption("halo dunia");
    editor.result.current.toggleAccount(FACEBOOK, true);
    editor.result.current.setScheduleDate(inDays(3));
    editor.result.current.setScheduleTime("10:00");
  });
  return { screen, editor: editor.result };
}

beforeEach(() => {
  vi.clearAllMocks();
  supabase.handlers = undefined;
  router.navigationInFlight = false;
  router.pushedTo = undefined;
  serverActionDispatches.total = 0;
  serverActionDispatches.whileNavigating = 0;
  resetTerminalNavigationForTests();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ token: "t" }) })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  resetTerminalNavigationForTests();
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

type Editor = Awaited<ReturnType<typeof mountOriginScreen>>["editor"];
const RUN = {
  "save-draft": (e: Editor) => e.current.handleSaveDraft(),
  schedule: (e: Editor) => e.current.handleConfirmSchedule(),
  "publish-now": (e: Editor) => e.current.handleConfirmPublishNow(),
} as const;

// Kombinasi yang memicu router.push (tujuan berbeda dari layar asal).
const PUSH_CASES = [
  ["save-draft", "/publish/queue", "/publish/drafts"],
  ["save-draft", "/publish/calendar", "/publish/drafts"],
  ["schedule", "/publish/calendar", "/publish/queue"],
  ["schedule", "/publish/drafts", "/publish/queue"],
  ["publish-now", "/publish/queue", "/publish/calendar"],
  ["publish-now", "/publish/drafts", "/publish/calendar"],
] as const;

describe("Realtime tidak mengirim server action selagi navigasi terminal tertunda (KI-108)", () => {
  for (const [action, origin, destination] of PUSH_CASES) {
    it(`${action} dari ${origin}: event INSERT dan UPDATE tidak memicu server action sampai navigasi selesai`, async () => {
      const { screen, editor } = await mountOriginScreen(origin);
      vi.useFakeTimers();

      await act(async () => {
        await RUN[action](editor);
      });
      expect(router.pushedTo).toBe(destination);

      // Event Realtime milik draft/post baru tiba selagi navigasi tertunda.
      supabase.handlers?.onInsert?.({ postId: POST, eventType: "INSERT" });
      supabase.handlers?.onUpdate?.({ postId: POST, eventType: "UPDATE" });
      await vi.advanceTimersByTimeAsync(5_000);
      expect(serverActionDispatches.whileNavigating).toBe(0);
      expect(serverActionDispatches.total).toBe(0);

      // Navigasi berhasil: layar asal unmount, event tertahan dibuang.
      screen.unmount();
      router.navigationInFlight = false;
      window.history.pushState({}, "", destination);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(serverActionDispatches.total).toBe(0);
    });
  }

  it("aksi yang selesai di tempat (refresh) tidak menahan event layar ini", async () => {
    const { editor } = await mountOriginScreen("/publish/queue");
    await act(async () => {
      await RUN.schedule(editor);
    });
    expect(router.pushedTo).toBeUndefined();

    supabase.handlers?.onInsert?.({ postId: POST, eventType: "INSERT" });
    expect(serverActionDispatches.total).toBe(1);
  });

  it("navigasi yang macet: event dilepas setelah batas waktu supaya layar tidak basi", async () => {
    const { editor } = await mountOriginScreen("/publish/queue");
    vi.useFakeTimers();
    await act(async () => {
      await RUN["save-draft"](editor);
    });
    supabase.handlers?.onInsert?.({ postId: POST, eventType: "INSERT" });
    await vi.advanceTimersByTimeAsync(29_000);
    expect(serverActionDispatches.total).toBe(0);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(serverActionDispatches.total).toBe(1);
  });
});
