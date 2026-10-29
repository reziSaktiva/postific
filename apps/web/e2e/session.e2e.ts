import { expect, test } from "@playwright/test";

/**
 * Membuktikan sesi tersimpan dari `auth.setup.ts` berlaku (T-173.2): rute
 * privat terbuka tanpa dialihkan ke /login. Tidak menyentuh data.
 */
test("sesi tersimpan membuka rute privat", async ({ page }) => {
  await page.goto("/start-page");
  await expect(page).not.toHaveURL(/\/login/);
});
