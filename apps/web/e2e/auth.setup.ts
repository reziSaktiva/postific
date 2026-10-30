import fs from "node:fs";

import { expect, test as setup } from "@playwright/test";

import { AUTH_FILE } from "./support/auth";
import { ensureE2eWorkspaceActive } from "./support/workspace";

/**
 * Login sekali, aktifkan workspace E2E, lalu simpan sesi (T-173.2, S-002).
 * Semua tes di proyek `chrome` memakai `storageState` ini, jadi tidak ada tes
 * yang mengulang login. Kredensial hanya dari env (`.env.local` atau GitHub
 * Secrets), tidak pernah di repo.
 *
 * Sesi tersimpan dipakai ulang selama masih berlaku: sign-in dibatasi 5
 * permintaan per 60 detik (`auth.ts`), jadi run berulang tidak boleh login
 * tiap kali.
 */
setup("login akun test", async ({ browser, baseURL }) => {
  // `next dev` mengompilasi rute saat pertama dibuka: beri waktu lebih.
  setup.setTimeout(120_000);
  if (fs.existsSync(AUTH_FILE)) {
    const context = await browser.newContext({
      baseURL,
      storageState: AUTH_FILE,
    });
    const page = await context.newPage();
    await page.goto("/start-page");
    if (!/\/login/.test(page.url())) {
      await ensureE2eWorkspaceActive(page);
      await context.storageState({ path: AUTH_FILE });
      await context.close();
      return;
    }
    await context.close();
  }

  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL dan E2E_USER_PASSWORD wajib diisi (apps/web/.env.local atau GitHub Secrets).",
    );
  }

  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  // Workspace aktif ada di cookie: pindah dulu, baru simpan sesi.
  await ensureE2eWorkspaceActive(page);
  await context.storageState({ path: AUTH_FILE });
  await context.close();
});
