// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { SocialPlatform } from "@postific/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/publish/drafts",
}));
vi.mock("./Context", () => ({
  useDraftEditor: () => ({ close: vi.fn(), clearUnsavedNewPost: vi.fn() }),
}));
vi.mock("@/lib/time/user-time-zone-context", () => ({
  useUserTimeZone: () => "Asia/Jakarta",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Barrel domain menarik repository Prisma; hook hanya butuh dua fungsi murni.
vi.mock("@/domains/publishing", async () => {
  const matrix = await import("@/domains/publishing/content-format-matrix");
  const story = await import("@/domains/publishing/story-caption-constraints");
  return {
    maxMediaCountForFormats: matrix.maxMediaCountForFormats,
    isCaptionRequiredForFormats: story.isCaptionRequiredForFormats,
  };
});

import { useDraftEditorForm } from "./useDraftEditorForm";

const INSTAGRAM = {
  id: "ig",
  platform: SocialPlatform.Instagram,
  handle: "@ig",
  status: "active",
};
const FACEBOOK = {
  id: "fb",
  platform: SocialPlatform.Facebook,
  handle: "fb",
  status: "active",
};

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function setup(accounts = [INSTAGRAM, FACEBOOK]) {
  actionMocks.getConnectedAccountsAction.mockResolvedValue(accounts);
  actionMocks.getLastUsedAccountIdsAction.mockResolvedValue([]);
  const view = renderHook(() =>
    useDraftEditorForm({ mode: "create", onLatestChange: vi.fn() }),
  );
  await waitFor(() =>
    expect(view.result.current.isLoadingAccounts).toBe(false),
  );
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("useDraftEditorForm: wiring validasi jaringan", () => {
  it("pelanggaran jaringan menahan Schedule dan Publish Now, tetapi Save as Draft tetap jalan", async () => {
    actionMocks.saveDraftAction.mockResolvedValue({ postId: "p1" });
    const { result } = await setup();

    act(() => {
      result.current.setCaption("halo dunia");
      result.current.setScheduleDate(futureDate(3));
      result.current.setScheduleTime("10:00");
    });
    // Tanpa akun terpilih: belum siap (bukan karena pelanggaran jaringan).
    expect(result.current.isReadyToPublishNow).toBe(false);

    // Facebook Post tanpa media sah di aturan jaringan: siap.
    act(() => result.current.toggleAccount(FACEBOOK, true));
    expect(result.current.networkValidation.hasBlockingIssues).toBe(false);
    expect(result.current.isReadyToPublishNow).toBe(true);
    expect(result.current.isReadyToSchedule).toBe(true);

    // Instagram tanpa media melanggar aturan jaringan: kedua tombol tertahan.
    act(() => result.current.toggleAccount(INSTAGRAM, true));
    expect(
      result.current.networkValidation.byAccount[INSTAGRAM.id]?.length,
    ).toBeGreaterThan(0);
    expect(result.current.isReadyToPublishNow).toBe(false);
    expect(result.current.isReadyToSchedule).toBe(false);

    // Save as Draft tidak bergantung pada validasi (ADR-125).
    await act(async () => {
      await result.current.handleSaveDraft();
    });
    expect(actionMocks.saveDraftAction).toHaveBeenCalledTimes(1);
  });

  it("mencentang akun mengubah blok aktif mengikuti urutan pilihan", async () => {
    const { result } = await setup();

    // Dipilih Facebook lebih dulu, padahal Instagram lebih dulu di daftar workspace.
    act(() => result.current.toggleAccount(FACEBOOK, true));
    expect(result.current.activeAccountId).toBe(FACEBOOK.id);

    act(() => result.current.toggleAccount(INSTAGRAM, true));
    expect(result.current.activeAccountId).toBe(INSTAGRAM.id);

    act(() => result.current.setActiveAccountId(FACEBOOK.id));
    expect(result.current.activeAccountId).toBe(FACEBOOK.id);

    // Blok aktif yang dilepas jatuh ke blok paling atas yang tersisa.
    act(() => result.current.toggleAccount(FACEBOOK, false));
    expect(result.current.activeAccountId).toBe(INSTAGRAM.id);
  });
});
