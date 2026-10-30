// @vitest-environment jsdom
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StartPageLinkRecord } from "@/domains/start-page";

const { reorderMock, deleteMock, toastMock } = vi.hoisted(() => ({
  reorderMock: vi.fn(),
  deleteMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../actions", () => ({
  addStartPageLinkAction: vi.fn(),
  updateStartPageLinkAction: vi.fn(),
  deleteStartPageLinkAction: deleteMock,
  reorderStartPageLinksAction: reorderMock,
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { LinkListCard } from "./LinkListCard";

function link(id: string, label: string): StartPageLinkRecord {
  return {
    id,
    label,
    url: `https://${id}.test/`,
    position: 0,
    isActive: true,
    clickCount: 0,
  };
}

const LINKS = [link("a", "Alpha"), link("b", "Bravo"), link("c", "Charlie")];

/** Induk terkontrol seperti `StartPageEditor`: urutan benar-benar berubah di DOM. */
function Harness({
  onChange,
}: {
  onChange?: (links: StartPageLinkRecord[]) => void;
}) {
  const [links, setLinks] = useState(LINKS);
  return (
    <LinkListCard
      links={links}
      showZeroHint={false}
      onLinksChange={(next) => {
        onChange?.(next);
        setLinks(next);
      }}
    />
  );
}

function labels(): string[] {
  return screen
    .getAllByTestId("sp-link-row")
    .map((row) => row.querySelector("span.truncate")!.textContent ?? "");
}

function handle(label: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`^Urutkan link ${label},`),
  });
}

beforeEach(() => {
  reorderMock.mockReset();
  reorderMock.mockResolvedValue({ data: null });
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});
afterEach(cleanup);

describe("LinkListCard keyboard reorder (T-167.5)", () => {
  it("ArrowDown moves the link down and sends ALL ids in the new order", async () => {
    render(<Harness />);
    fireEvent.keyDown(handle("Alpha"), { key: "ArrowDown" });

    expect(labels()).toEqual(["Bravo", "Alpha", "Charlie"]);
    await waitFor(() =>
      expect(reorderMock).toHaveBeenCalledWith(["b", "a", "c"]),
    );
  });

  it("re-focuses the moved link's handle after the DOM reorders", async () => {
    // Browser sungguhan kehilangan fokus saat node dipindah; jsdom tidak,
    // jadi yang diverifikasi adalah panggilan `focus()` pada handle yang benar.
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    render(<Harness />);
    fireEvent.keyDown(handle("Alpha"), { key: "ArrowDown" });

    await waitFor(() =>
      expect(focusSpy.mock.contexts).toContain(handle("Alpha")),
    );
    expect(handle("Alpha").getAttribute("aria-label")).toContain(
      "posisi 2 dari 3",
    );
    focusSpy.mockRestore();
  });

  it("announces the new position for screen readers", async () => {
    render(<Harness />);
    fireEvent.keyDown(handle("Charlie"), { key: "ArrowUp" });
    expect((await screen.findByRole("status")).textContent).toBe(
      "Charlie dipindah ke posisi 2 dari 3.",
    );
  });

  it("does nothing at the edges (no action, no focus theft)", () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(handle("Alpha"), { key: "ArrowUp" });
    fireEvent.keyDown(handle("Charlie"), { key: "ArrowDown" });

    expect(focusSpy).not.toHaveBeenCalled();
    expect(reorderMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(labels()).toEqual(["Alpha", "Bravo", "Charlie"]);
    focusSpy.mockRestore();
  });

  it("ignores other keys", () => {
    render(<Harness />);
    fireEvent.keyDown(handle("Alpha"), { key: "Enter" });
    expect(reorderMock).not.toHaveBeenCalled();
  });

  it("reverts the optimistic order and shows a toast when the action fails", async () => {
    reorderMock.mockResolvedValue({ error: "Gagal mengurutkan." });
    render(<Harness />);
    fireEvent.keyDown(handle("Alpha"), { key: "ArrowDown" });

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Gagal mengurutkan."),
    );
    expect(labels()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});

describe("LinkListCard drag and drop", () => {
  it("drops a link on another and sends the new order", async () => {
    render(<Harness />);
    const rows = screen.getAllByTestId("sp-link-row");
    const dataTransfer = {
      data: {} as Record<string, string>,
      effectAllowed: "",
      setData(type: string, value: string) {
        this.data[type] = value;
      },
      getData(type: string) {
        return this.data[type] ?? "";
      },
    };
    fireEvent.dragStart(rows[0]!, { dataTransfer });
    fireEvent.drop(rows[2]!, { dataTransfer });

    expect(labels()).toEqual(["Bravo", "Charlie", "Alpha"]);
    await waitFor(() =>
      expect(reorderMock).toHaveBeenCalledWith(["b", "c", "a"]),
    );
  });
});

describe("LinkListCard add button", () => {
  it("is enabled below the limit", () => {
    render(<Harness />);
    expect(
      (screen.getByRole("button", { name: /Tambah Link/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
