// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revokeMock, toastMock } = vi.hoisted(() => ({
  revokeMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("../actions", () => ({ revokeAiClientAction: revokeMock }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/time/user-time-zone-context", () => ({
  useUserTimeZone: () => "Asia/Jakarta",
}));

import { AiClientsView, type AiClientItem } from "./AiClientsView";

const MCP_URL = "https://app.test/api/mcp";

function client(over: Partial<AiClientItem> = {}): AiClientItem {
  return {
    id: "grant-1",
    clientName: "Claude",
    workspaceName: "Kopi Selasar",
    scopes: ["read", "draft"],
    connectedAt: "2026-10-02T03:00:00.000Z",
    lastUsedAt: null,
    ...over,
  };
}

describe("AiClientsView", () => {
  beforeEach(() => {
    revokeMock.mockReset();
    toastMock.mockClear();
  });
  afterEach(cleanup);

  it("menampilkan nama, workspace, scope, dan 'Belum pernah dipakai'", () => {
    render(<AiClientsView clients={[client()]} mcpUrl={MCP_URL} />);
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByText(/Kopi Selasar/)).toBeTruthy();
    expect(screen.getByText(/Belum pernah dipakai/)).toBeTruthy();
    expect(screen.getByText("read")).toBeTruthy();
    expect(screen.getByText("draft")).toBeTruthy();
  });

  it("memakai fallback untuk nama klien dan workspace yang tidak ada", () => {
    render(
      <AiClientsView
        clients={[client({ clientName: null, workspaceName: null })]}
        mcpUrl={MCP_URL}
      />,
    );
    expect(screen.getByText("Klien AI")).toBeTruthy();
    expect(screen.getByText(/Workspace tidak tersedia/)).toBeTruthy();
  });

  it("empty state menampilkan URL MCP", () => {
    render(<AiClientsView clients={[]} mcpUrl={MCP_URL} />);
    expect(screen.getByText("Belum ada klien AI tersambung")).toBeTruthy();
    expect(
      (screen.getByLabelText("URL MCP Postific") as HTMLInputElement).value,
    ).toBe(MCP_URL);
  });

  it("Cabut membuka dialog; Batal tidak memanggil action", async () => {
    render(<AiClientsView clients={[client()]} mcpUrl={MCP_URL} />);
    fireEvent.click(screen.getByRole("button", { name: "Cabut" }));
    expect(await screen.findByText("Cabut akses Claude?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("konfirmasi memanggil action dengan id grant", async () => {
    revokeMock.mockResolvedValue({ ok: true });
    render(<AiClientsView clients={[client()]} mcpUrl={MCP_URL} />);
    fireEvent.click(screen.getByRole("button", { name: "Cabut" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cabut Akses" }));
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith("grant-1"));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
  });

  it("menampilkan error bila action gagal", async () => {
    revokeMock.mockResolvedValue({ ok: false, error: "Gagal mencabut akses." });
    render(<AiClientsView clients={[client()]} mcpUrl={MCP_URL} />);
    fireEvent.click(screen.getByRole("button", { name: "Cabut" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cabut Akses" }));
    expect(await screen.findByText("Gagal mencabut akses.")).toBeTruthy();
  });
});
