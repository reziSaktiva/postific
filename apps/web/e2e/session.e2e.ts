import { expect, test } from "@playwright/test";

import { E2E_WORKSPACE_NAME } from "./support/workspace";

/**
 * Membuktikan sesi tersimpan dari `auth.setup.ts` berlaku (T-173.2): rute
 * privat terbuka tanpa dialihkan ke /login. Tidak menyentuh data.
 */
test("sesi tersimpan membuka rute privat", async ({ page }) => {
  await page.goto("/start-page");
  await expect(page).not.toHaveURL(/\/login/);
});

test("workspace aktif adalah workspace E2E, bukan workspace nyata", async ({
  page,
}) => {
  await page.goto("/settings/account/workspaces");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: E2E_WORKSPACE_NAME })
      .getByText("Aktif"),
  ).toBeVisible();
});
