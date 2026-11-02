import type { McpToolServices } from "./tool-types";

/**
 * Double lokal untuk tes MCP (AGENTS.md #11): profil pengguna dengan zona
 * waktu tertentu, supaya `runMcpTool` bisa membaca `User.timeZone` (T-168)
 * tanpa database. Hanya diimpor berkas tes.
 */
export function fakeIdentity(
  timeZone: string | null = "Asia/Jakarta",
): McpToolServices["identity"] {
  return {
    getProfile: async () =>
      timeZone === null ? null : ({ timeZone } as never),
  };
}
