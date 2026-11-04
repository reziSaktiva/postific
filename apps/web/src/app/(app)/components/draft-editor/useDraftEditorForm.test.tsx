// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { ContentStatus, SocialPlatform } from "@postific/shared";
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
const contextMocks = vi.hoisted(() => ({
  close: vi.fn(),
  clearUnsavedNewPost: vi.fn(),
}));
vi.mock("./Context", () => ({
  useDraftEditor: () => contextMocks,
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

describe("useDraftEditorForm: jadwal di footer (T-205)", () => {
  async function setupReady() {
    const view = await setup([FACEBOOK]);
    act(() => {
      view.result.current.setCaption("halo dunia");
      view.result.current.toggleAccount(FACEBOOK, true);
    });
    return view;
  }

  it("jadwal di masa lalu memunculkan pesan dan menahan Schedule; Publish Now tidak terpengaruh", async () => {
    const { result } = await setupReady();
    act(() => {
      result.current.setScheduleDate("2020-01-01");
      result.current.setScheduleTime("10:00");
    });
    expect(result.current.scheduleTimeMessage).toMatch(/sudah lewat/);
    expect(result.current.isReadyToSchedule).toBe(false);
    expect(result.current.isReadyToPublishNow).toBe(true);
  });

  it("jadwal lebih dari 30 hari menyebut batas dan menahan Schedule", async () => {
    const { result } = await setupReady();
    act(() => {
      result.current.setScheduleDate(futureDate(45));
      result.current.setScheduleTime("10:00");
    });
    expect(result.current.scheduleTimeMessage).toMatch(/maksimal 30 hari/);
    expect(result.current.isReadyToSchedule).toBe(false);
  });

  it("jadwal dalam batas melepas Schedule; menghapus jadwal menahannya lagi", async () => {
    const { result } = await setupReady();
    act(() => {
      result.current.setScheduleDate(futureDate(3));
      result.current.setScheduleTime("10:00");
    });
    expect(result.current.scheduleTimeMessage).toBeNull();
    expect(result.current.isReadyToSchedule).toBe(true);

    act(() => {
      result.current.setScheduleDate(undefined);
      result.current.setScheduleTime(undefined);
    });
    expect(result.current.isReadyToSchedule).toBe(false);
  });
});

describe("useDraftEditorForm: Edit Draft per status (T-205.8)", () => {
  function draft(status: string) {
    return {
      postId: "p1",
      caption: "isi tersimpan",
      status,
      media: [],
      targets: [],
    };
  }

  async function openEdit(status: string) {
    actionMocks.getConnectedAccountsAction.mockResolvedValue([FACEBOOK]);
    actionMocks.getLastUsedAccountIdsAction.mockResolvedValue([]);
    actionMocks.getDraftAction.mockResolvedValue(draft(status));
    const view = renderHook(() =>
      useDraftEditorForm({
        mode: "edit",
        postId: "p1",
        onLatestChange: vi.fn(),
      }),
    );
    await waitFor(() => expect(view.result.current.isLoadingDraft).toBe(false));
    return view;
  }

  it.each([ContentStatus.Draft, ContentStatus.Scheduled])(
    "status %s dibuka dengan data tersimpan",
    async (status) => {
      const { result } = await openEdit(status);
      expect(result.current.caption).toBe("isi tersimpan");
      expect(result.current.status).toBe(status);
      expect(contextMocks.close).not.toHaveBeenCalled();
    },
  );

  it.each([
    ContentStatus.Published,
    ContentStatus.Failed,
    ContentStatus.Imported,
  ])("status read-only %s tidak dibuka di editor", async (status) => {
    const { result } = await openEdit(status);
    expect(contextMocks.close).toHaveBeenCalledTimes(1);
    expect(result.current.caption).toBe("");
  });
});
