// @vitest-environment jsdom
/**
 * Bukti T-204.2 dan T-204.5 di sambungan form ke Pratinjau (S-005): yang
 * diketik di blok jaringan Pinterest muncul di kartu Pratinjau, dan akun
 * TikTok serta platform tanpa Pratinjau khusus memilih kartu yang benar.
 * Hanya Server Action yang di-mock; yang diperiksa adalah teks dan label.
 */
import { SocialPlatform } from "@postific/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
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

const ACCOUNTS = [
  {
    id: "pin",
    platform: SocialPlatform.Pinterest,
    handle: "kopi-pin",
    status: "active",
  },
  {
    id: "tt",
    platform: SocialPlatform.TikTok,
    handle: "@kopitt",
    status: "active",
  },
  {
    id: "x",
    platform: SocialPlatform.Twitter,
    handle: "kopi_x",
    status: "active",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  actionMocks.getConnectedAccountsAction.mockResolvedValue(ACCOUNTS);
  actionMocks.getLastUsedAccountIdsAction.mockResolvedValue([]);
  actionMocks.listPinterestBoardsAction.mockResolvedValue([
    { id: "b1", name: "Resep Kopi" },
    { id: "b2", name: "Inspirasi Kafe" },
  ]);
  actionMocks.getDraftAction.mockResolvedValue({
    postId: "p1",
    caption: "",
    status: "draft",
    media: [],
    targets: [],
  });
});
afterEach(cleanup);

async function renderCreate() {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DraftEditorForm
            mode="create"
            onOpenChange={vi.fn()}
            dialogVariant="standard"
            onToggleDialogVariant={vi.fn()}
            onLatestChange={vi.fn()}
          />
        </DialogContent>
      </Dialog>
    </TooltipProvider>,
  );
  await screen.findByRole("button", { name: "Channels" });
  return user;
}

const preview = () => screen.getByRole("complementary", { name: "Pratinjau" });

async function pick(
  user: Awaited<ReturnType<typeof renderCreate>>,
  label: string,
) {
  await user.click(screen.getByRole("button", { name: "Channels" }));
  const popover = await screen.findByRole("dialog", {
    name: "Pilih akun tujuan",
  });
  await user.click(within(popover).getByRole("checkbox", { name: label }));
  await user.keyboard("{Escape}");
}

describe("Pratinjau dari form (T-204)", () => {
  it("T-204.2 judul, link, dan board yang diisi di blok Pinterest tampil di kartu pin", async () => {
    const user = await renderCreate();
    await pick(user, "Pilih Pinterest kopi-pin");

    const card = within(preview()).getByLabelText("Pratinjau Pinterest Pin");
    expect(within(card).queryByText(/^Board:/)).toBeNull();

    await user.type(screen.getByLabelText(/Pin Title/), "Resep kopi susu");
    await user.type(
      screen.getByLabelText(/Destination Link/),
      "https://kopi.example.test/resep",
    );
    await user.click(screen.getByRole("combobox", { name: "Board" }));
    await user.click(
      await screen.findByRole("option", { name: "Inspirasi Kafe" }),
    );
    await user.type(screen.getByLabelText("Caption"), "Seduh sempurna");

    expect(within(card).getByText("Resep kopi susu")).toBeTruthy();
    expect(within(card).getByText("kopi.example.test")).toBeTruthy();
    expect(within(card).getByText("Board: Inspirasi Kafe")).toBeTruthy();
    expect(within(card).getByText("Seduh sempurna")).toBeTruthy();
    expect(within(preview()).getByText("Pinterest · Pin")).toBeTruthy();
  });

  it("T-204.1 akun TikTok menampilkan kartu TikTok dengan caption yang diketik", async () => {
    const user = await renderCreate();
    await pick(user, "Pilih TikTok @kopitt");
    await user.type(screen.getByLabelText("Caption"), "Seduh pagi");

    const card = within(preview()).getByLabelText("Pratinjau TikTok");
    expect(within(card).getByText("Seduh pagi")).toBeTruthy();
    expect(within(card).getByText("TikTok membutuhkan media")).toBeTruthy();
  });

  it("T-204.3 akun X menampilkan kartu umum dengan nama platform dan caption", async () => {
    const user = await renderCreate();
    await pick(user, "Pilih X (Twitter) kopi_x");
    await user.type(screen.getByLabelText("Caption"), "Halo dari X");

    const card = within(preview()).getByLabelText("Pratinjau umum X (Twitter)");
    expect(within(card).getByText("kopi_x")).toBeTruthy();
    expect(within(card).getByText("Halo dari X")).toBeTruthy();
  });
});
