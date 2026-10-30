import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { AUTH_FILE } from "./e2e/support/auth";

/**
 * QA end-to-end (ADR-149, S-002). Chrome terpasang di mesin (`channel`), tidak
 * mengunduh browser. Target dipilih lewat `E2E_BASE_URL`: kosong berarti
 * `local` (`http://localhost:3000`, `next dev` dijalankan bila belum ada),
 * isi dengan URL staging untuk menguji staging. Local dan staging berbagi satu
 * DB (ADR-081), jadi tes hanya boleh menyentuh data milik akun test.
 */
// Muat `.env.local` apps/web walau dijalankan dari root (`bun run test:e2e`);
// env yang sudah ada (CI, shell) tidak ditimpa. Berkas tidak wajib ada.
try {
  process.loadEnvFile(path.join(__dirname, ".env.local"));
} catch {}

// `||` (bukan `??`): secret CI yang belum dibuat berisi string kosong.
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const { hostname, port } = new URL(baseURL);
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // Pulihkan member E2E yang tertinggal `removed` SEBELUM proyek `setup` (T-178);
  // tidak melakukan apa pun tanpa target staging dan koneksi DB.
  globalSetup: "./e2e/support/heal-member.global.ts",
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
    // `E2E_SLOWMO=600 bun run test:e2e --headed` untuk menonton tes berjalan.
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO) || 0 },
  },
  projects: [
    // Login sekali, simpan sesi (T-173.2).
    {
      name: "setup",
      testMatch: "**/*.setup.ts",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "chrome",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        storageState: AUTH_FILE,
      },
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
