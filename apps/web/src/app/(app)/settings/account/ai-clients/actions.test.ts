import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, redirectMock, revokeGrantMock, revalidatePathMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    revokeGrantMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));
vi.mock("@/lib/mcp-access/get-mcp-access-service", () => ({
  getMcpAccessService: () => ({ revokeGrant: revokeGrantMock }),
}));

import { McpGrantNotFoundError } from "@/domains/mcp-access";
import { revokeAiClientAction } from "./actions";

describe("revokeAiClientAction", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    revokeGrantMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("mengalihkan ke /login tanpa sesi dan tidak mencabut apa pun", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(revokeAiClientAction("grant-1")).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(revokeGrantMock).not.toHaveBeenCalled();
  });

  it("memanggil revokeGrant dengan id grant dan pengguna sesi, lalu revalidate", async () => {
    revokeGrantMock.mockResolvedValue(undefined);
    await expect(revokeAiClientAction("grant-1")).resolves.toEqual({
      ok: true,
    });
    expect(revokeGrantMock).toHaveBeenCalledWith("grant-1", "user-1");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/settings/account/ai-clients",
    );
  });

  it("grant tidak ditemukan/milik orang lain: error ramah, daftar disegarkan", async () => {
    revokeGrantMock.mockRejectedValue(new McpGrantNotFoundError());
    const result = await revokeAiClientAction("grant-x");
    expect(result).toEqual({
      ok: false,
      error: "Koneksi klien AI tidak ditemukan",
    });
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("error tak terduga: pesan umum tanpa membocorkan detail", async () => {
    revokeGrantMock.mockRejectedValue(new Error("db down"));
    const result = await revokeAiClientAction("grant-1");
    expect(result).toEqual({
      ok: false,
      error: "Gagal mencabut akses. Coba lagi.",
    });
  });
});
