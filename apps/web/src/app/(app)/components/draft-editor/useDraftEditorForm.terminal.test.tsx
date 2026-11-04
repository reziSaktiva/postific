// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { SocialPlatform } from "@postific/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isTerminalNavigationPending,
  resetTerminalNavigationForTests,
} from "@/lib/navigation/pending-terminal-navigation";

/**
 * T-208.1: aksi terminal dari layar asal Queue, Calendar, dan Drafts. Menguji
 * tujuan navigasi (ADR-054) dan bahwa gerbang Realtime hanya dipasang bila
 * navigasi benar-benar berjalan (router.push), bukan bila cukup refresh.
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
const nav = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathname: "/publish/queue",
  close: vi.fn(),
}));

vi.mock("./actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
  usePathname: () => nav.pathname,
}));
vi.mock("./Context", () => ({
  useDraftEditor: () => ({
    close: nav.close,
    clearUnsavedNewPost: vi.fn(),
  }),
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

import { useDraftEditorForm } from "./useDraftEditorForm";

const FACEBOOK = {
  id: "fb",
  platform: SocialPlatform.Facebook,
  handle: "fb",
  status: "active",
};

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function setupReady(pathname: string) {
  nav.pathname = pathname;
  actionMocks.getConnectedAccountsAction.mockResolvedValue([FACEBOOK]);
  actionMocks.getLastUsedAccountIdsAction.mockResolvedValue([]);
  actionMocks.saveDraftAction.mockResolvedValue({ postId: "p1" });
  actionMocks.scheduleDraftAction.mockResolvedValue({ postId: "p1" });
  actionMocks.publishNowAction.mockResolvedValue({ postId: "p1" });
  const view = renderHook(() =>
    useDraftEditorForm({ mode: "create", onLatestChange: vi.fn() }),
  );
  await waitFor(() =>
    expect(view.result.current.isLoadingAccounts).toBe(false),
  );
  act(() => {
    view.result.current.setCaption("halo dunia");
    view.result.current.toggleAccount(FACEBOOK, true);
    view.result.current.setScheduleDate(inDays(3));
    view.result.current.setScheduleTime("10:00");
  });
  return view.result;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTerminalNavigationForTests();
});
afterEach(() => {
  cleanup();
  resetTerminalNavigationForTests();
});

const ACTIONS = {
  "save-draft": (r: Awaited<ReturnType<typeof setupReady>>) =>
    r.current.handleSaveDraft(),
  schedule: (r: Awaited<ReturnType<typeof setupReady>>) =>
    r.current.handleConfirmSchedule(),
  "publish-now": (r: Awaited<ReturnType<typeof setupReady>>) =>
    r.current.handleConfirmPublishNow(),
} as const;

const DESTINATION = {
  "save-draft": "/publish/drafts",
  schedule: "/publish/queue",
  "publish-now": "/publish/calendar",
} as const;

describe("aksi terminal Draft Editor per layar asal (ADR-054, T-208)", () => {
  const origins = [
    "/publish/queue",
    "/publish/calendar",
    "/publish/drafts",
  ] as const;
  const actions = ["save-draft", "schedule", "publish-now"] as const;

  for (const origin of origins) {
    for (const action of actions) {
      const destination = DESTINATION[action];
      const samePlace = origin === destination;
      it(`${action} dari ${origin}: ${samePlace ? "refresh di tempat" : `push ke ${destination}`}`, async () => {
        const result = await setupReady(origin);
        await act(async () => {
          await ACTIONS[action](result);
        });

        expect(nav.close).toHaveBeenCalled();
        if (samePlace) {
          expect(nav.refresh).toHaveBeenCalledTimes(1);
          expect(nav.push).not.toHaveBeenCalled();
          // Tanpa navigasi, event Realtime layar ini tidak boleh ditahan.
          expect(isTerminalNavigationPending()).toBe(false);
        } else {
          expect(nav.push).toHaveBeenCalledWith(destination);
          expect(nav.refresh).not.toHaveBeenCalled();
          // Navigasi berjalan: gerbang Realtime aktif sampai layar asal ditinggal.
          expect(isTerminalNavigationPending()).toBe(true);
        }
      });
    }
  }

  it("aksi yang ditolak server tidak menutup editor, tidak berpindah, dan tidak memasang gerbang", async () => {
    const result = await setupReady("/publish/queue");
    actionMocks.scheduleDraftAction.mockResolvedValue({
      error: "Jadwal ditolak",
    });
    await act(async () => {
      await result.current.handleConfirmSchedule();
    });
    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.refresh).not.toHaveBeenCalled();
    expect(nav.close).not.toHaveBeenCalled();
    expect(result.current.notice).toEqual({
      status: "error",
      title: "Jadwal ditolak",
    });
    expect(isTerminalNavigationPending()).toBe(false);
  });
});
