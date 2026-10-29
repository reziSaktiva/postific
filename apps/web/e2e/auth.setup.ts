import { expect, test as setup } from "@playwright/test";

import { AUTH_FILE } from "./support/auth";

/**
 * Login sekali lalu simpan sesi (T-173.2, S-002). Semua tes di proyek `chrome`
 * memakai `storageState` ini, jadi tidak ada tes yang mengulang login.
 * Kredensial hanya dari env (`.env.local` atau GitHub Secrets), tidak pernah di repo.
 */
setup("login akun test", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL dan E2E_USER_PASSWORD wajib diisi (apps/web/.env.local atau GitHub Secrets).",
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
