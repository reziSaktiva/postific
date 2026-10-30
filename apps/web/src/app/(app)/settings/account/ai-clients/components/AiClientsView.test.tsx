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

  it("menampilkan 'Terakhir dipakai' relatif dan tanggal singkat", () => {
    const lastUsedAt = new Date(Date.now() - 3 * 3600_000).toISOString();
    render(
      <AiClientsView clients={[client({ lastUsedAt })]} mcpUrl={MCP_URL} />,
    );
    expect(screen.getByText(/Terakhir dipakai 3 jam lalu/)).toBeTruthy();
    expect(screen.getByText(/Tersambung 2 Okt 2026/)).toBeTruthy();
  });

  it("dialog untuk workspace tak tersedia memakai 'workspace ini'", async () => {
    render(
      <AiClientsView
        clients={[client({ workspaceName: null })]}
        mcpUrl={MCP_URL}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cabut" }));
    expect(await screen.findByText(/data workspace ini\./)).toBeTruthy();
  });

  it("tombol Salin menulis URL ke clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AiClientsView clients={[]} mcpUrl={MCP_URL} />);
    fireEvent.click(screen.getByRole("button", { name: /Salin/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MCP_URL));
  });

  it("tanpa URL MCP: tidak ada input/tombol Salin, ada pesan", () => {
    render(<AiClientsView clients={[]} mcpUrl={null} />);
    expect(screen.queryByLabelText("URL MCP Postific")).toBeNull();
    expect(screen.queryByRole("button", { name: /Salin/ })).toBeNull();
    expect(screen.getByText(/URL MCP belum dikonfigurasi/)).toBeTruthy();
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
