import { expect, test } from "@playwright/test";

/**
 * Smoke test T-172: membuktikan Playwright + Chrome + `E2E_BASE_URL` terpasang
 * benar. Tanpa login (akun test baru ada di T-173) dan tanpa menyentuh data.
 */
test("halaman login terbuka tanpa sesi", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
});

test("rute privat mengalihkan tamu ke /login", async ({ page }) => {
  await page.goto("/start-page");
  await expect(page).toHaveURL(/\/login/);
});
