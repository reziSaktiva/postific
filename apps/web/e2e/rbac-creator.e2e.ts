import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { creatorCredentialsProblem } from "./support/auth";
import { creatorContext } from "./support/creator-auth";
import { E2E_WORKSPACE_NAME } from "./support/workspace";

/**
 * RBAC Creator (T-214, butir T-207.4). Acuan: `roles-permissions.md`.
 * Hanya memeriksa dan menutup: tidak pernah menekan Save as Draft, Schedule,
 * Publish Now, atau tombol konfirmasi, dan tidak membuat atau menghapus data.
 * Sesi Creator sendiri (`.auth/creator.json`), terpisah dari sesi Owner.
 */
const problem = creatorCredentialsProblem();
test.skip(problem !== null, problem ?? "");

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  context = await creatorContext(browser, baseURL);
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

test("C1 Creator aktif di workspace E2E Sandbox dengan peran Creator", async () => {
  await page.goto("/settings/account/workspaces");
  const row = page.getByRole("row").filter({ hasText: E2E_WORKSPACE_NAME });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Creator", { exact: true })).toBeVisible();
  await expect(row.getByText("Aktif")).toBeVisible();
});

test("C2 Draft Editor: Save as Draft aktif, Schedule dan Publish Now tersedia (Creator boleh menjadwalkan dan publish)", async () => {
  await page.goto("/publish/drafts");
  await page.getByRole("button", { name: "New Post" }).last().click();
  const dlg = page.getByRole("dialog").filter({ hasText: /New Post/ });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Save as Draft" })).toBeEnabled({
    timeout: 15_000,
  });
  // Keduanya tampil (tidak disembunyikan karena peran). Status aktif tidak
  // ditegaskan: Instagram butuh media dan tes ini tidak boleh mengunggah data.
  await expect(
    dlg.getByRole("button", { name: "Schedule", exact: true }),
  ).toBeVisible();
  await expect(
    dlg.getByRole("button", { name: "Publish Now", exact: true }),
  ).toBeVisible();
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dlg).toHaveCount(0);
});

test("C3 Creator tanpa akses Organization Settings, Members, dan Billing (dialihkan ke Profile)", async () => {
  for (const route of ["/settings", "/settings/members", "/settings/billing"]) {
    await page.goto(route);
    // Padanan positif: halaman tujuan (Profile) termuat, bukan sekadar kosong.
    await expect(page, `${route} harus dialihkan`).toHaveURL(
      /\/settings\/account$/,
    );
    await expect(
      page.getByRole("button", { name: "Simpan Perubahan" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Invite Member/ }),
    ).toHaveCount(0);
  }
});

test("C4 Connected Accounts hanya baca untuk Creator", async () => {
  await page.goto("/settings/connected-accounts");
  await expect(page).toHaveURL(/\/settings\/connected-accounts$/);
  // Padanan positif: akun terhubung termuat dan terlihat.
  await expect(page.getByText(/Terhubung sejak/).first()).toBeVisible({
    timeout: 15_000,
  });
  for (const name of [/Connect Account/, /^Disconnect$/, /^Reconnect$/]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
});

// Kontrol: sesi Owner (fixture `page` bawaan proyek) memastikan nama tombol dan
// perilaku di C3/C4 benar, jadi assertion negatif Creator tidak lulus karena
// salah nama. Hanya membaca.
test("C5 kontrol Owner: tombol dan halaman yang disembunyikan dari Creator tampil", async ({
  page: ownerPage,
}) => {
  await ownerPage.goto("/settings/connected-accounts");
  await expect(ownerPage).toHaveURL(/\/settings\/connected-accounts$/);
  await expect(
    ownerPage.getByRole("button", { name: /Connect Account/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    ownerPage.getByRole("button", { name: /^Disconnect$/ }).first(),
  ).toBeVisible();
  await ownerPage.goto("/settings/members");
  await expect(ownerPage).toHaveURL(/\/settings\/members$/);
  await expect(
    ownerPage.getByRole("button", { name: /Invite Member/ }),
  ).toBeVisible();
  await ownerPage.goto("/settings/billing");
  await expect(ownerPage).toHaveURL(/\/settings\/billing$/);
  await ownerPage.goto("/settings");
  await expect(ownerPage).toHaveURL(/\/settings$/);
});
