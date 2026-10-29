import { defineConfig, devices } from "@playwright/test";

/**
 * QA end-to-end (ADR-149, S-002). Chrome terpasang di mesin (`channel`), tidak
 * mengunduh browser. Target dipilih lewat `E2E_BASE_URL`: kosong berarti
 * `local` (`http://localhost:3000`, `next dev` dijalankan bila belum ada),
 * isi dengan URL staging untuk menguji staging. Local dan staging berbagi satu
 * DB (ADR-081), jadi tes hanya boleh menyentuh data milik akun test.
 */
// `||` (bukan `??`): secret CI yang belum dibuat berisi string kosong.
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const { hostname, port } = new URL(baseURL);
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  // Satu akun test dan satu DB dipakai bersama (ADR-081): jangan paralel antar berkas.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: isLocal
    ? {
        command: "bun run dev",
        env: { PORT: port || "3000" },
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
