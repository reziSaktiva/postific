import { expect, type Page } from "@playwright/test";

/**
 * Workspace khusus E2E (T-173, S-002). Akun test juga anggota workspace
 * nyata (mis. "Cook It Real Good"), dan satu workspace hanya boleh satu Start
 * Page tanpa fitur hapus, jadi semua tes berjalan di workspace terpisah ini.
 */
export const E2E_WORKSPACE_NAME = "E2E Sandbox";

/**
 * Pastikan workspace aktif sesi ini adalah `E2E_WORKSPACE_NAME`: dibuat bila
 * belum ada, dipindah bila belum aktif. Workspace aktif tersimpan di cookie,
 * jadi dipanggil sebelum `storageState` disimpan.
 */
export async function ensureE2eWorkspaceActive(page: Page): Promise<void> {
  await page.goto("/settings/account/workspaces");

  // Login baru tanpa workspace aktif (akun di >1 workspace) diarahkan ke
  // halaman "Pilih Workspace".
  const picker = page.getByText("Pilih Workspace");
  await picker.or(page.getByRole("row").first()).first().waitFor();
  if (await picker.isVisible()) {
    const target = page.getByText(E2E_WORKSPACE_NAME);
    if ((await target.count()) > 0) {
      await target.click();
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    } else {
      await page.getByLabel("Nama Workspace").fill(E2E_WORKSPACE_NAME);
      await page
        .getByRole("button", { name: "Buat Workspace", exact: true })
        .click();
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    }
    await page.goto("/settings/account/workspaces");
  }

  const row = page.getByRole("row").filter({ hasText: E2E_WORKSPACE_NAME });

  if ((await row.count()) === 0) {
    await page.getByRole("button", { name: "Buat Workspace Baru" }).click();
    await page.getByLabel("Nama Workspace").fill(E2E_WORKSPACE_NAME);
    await page
      .getByRole("button", { name: "Buat Workspace", exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await page.goto("/settings/account/workspaces");
  } else if ((await row.getByText("Aktif").count()) === 0) {
    await row.click();
    await page.getByRole("button", { name: "Pindah", exact: true }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await page.goto("/settings/account/workspaces");
  }

  await expect(
    page
      .getByRole("row")
      .filter({ hasText: E2E_WORKSPACE_NAME })
      .getByText("Aktif"),
  ).toBeVisible();
}
