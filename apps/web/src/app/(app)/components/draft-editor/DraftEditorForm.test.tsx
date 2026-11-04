// @vitest-environment jsdom
import { ContentStatus, SocialPlatform } from "@postific/shared";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
vi.mock("@/domains/publishing", async () => {
  const matrix = await import("@/domains/publishing/content-format-matrix");
  const story = await import("@/domains/publishing/story-caption-constraints");
  return {
    maxMediaCountForFormats: matrix.maxMediaCountForFormats,
    isCaptionRequiredForFormats: story.isCaptionRequiredForFormats,
  };
});

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

import { DraftEditorForm } from "./DraftEditorForm";

const FACEBOOK = {
  id: "fb",
  platform: SocialPlatform.Facebook,
  handle: "kopi-fb",
  status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  actionMocks.getConnectedAccountsAction.mockResolvedValue([FACEBOOK]);
  actionMocks.getLastUsedAccountIdsAction.mockResolvedValue([]);
  actionMocks.listPinterestBoardsAction.mockResolvedValue([]);
});
afterEach(cleanup);

function renderEditForm() {
  return render(
    <TooltipProvider>
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DraftEditorForm
            mode="edit"
            postId="p1"
            initialPendingAction="publish-now"
            onOpenChange={vi.fn()}
            dialogVariant="standard"
            onToggleDialogVariant={vi.fn()}
            onLatestChange={vi.fn()}
          />
        </DialogContent>
      </Dialog>
    </TooltipProvider>,
  );
}

describe("DraftEditorForm: Confirmation Summary dengan Pratinjau (T-205.5)", () => {
  it("ringkasan tampil dan panel Pratinjau tetap terlihat", async () => {
    actionMocks.getDraftAction.mockResolvedValue({
      postId: "p1",
      caption: "Promo kopi susu",
      status: ContentStatus.Draft,
      media: [],
      targets: [
        {
          connectedAccountId: "fb",
          contentFormat: "post",
          platformOptions: null,
        },
      ],
    });
    renderEditForm();

    await screen.findByLabelText("Ringkasan konfirmasi");
    expect(
      screen.getByRole("complementary", { name: "Pratinjau" }),
    ).toBeTruthy();
    // Footer ringkasan: konfirmasi dan batal; kontrol jadwal tidak ikut tampil.
    expect(
      screen.getByRole("button", { name: "Konfirmasi & Publish" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Jadwal:/ })).toBeNull();
  });

  it("Batal kembali ke form dengan kontrol jadwal di footer dan Pratinjau tetap ada", async () => {
    const user = userEvent.setup();
    actionMocks.getDraftAction.mockResolvedValue({
      postId: "p1",
      caption: "Promo kopi susu",
      status: ContentStatus.Draft,
      media: [],
      targets: [
        {
          connectedAccountId: "fb",
          contentFormat: "post",
          platformOptions: null,
        },
      ],
    });
    renderEditForm();
    await screen.findByLabelText("Ringkasan konfirmasi");
    await user.click(screen.getByRole("button", { name: "Batal" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Jadwal: Atur jadwal" }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("complementary", { name: "Pratinjau" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Ringkasan konfirmasi")).toBeNull();
  });
});
