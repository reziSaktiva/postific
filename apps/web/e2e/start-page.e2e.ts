import { expect, test, type Page } from "@playwright/test";

import { E2E_PREFIX, e2eName } from "./support/e2e-data";
import { E2E_WORKSPACE_NAME } from "./support/workspace";

/**
 * T-174 (S-002): golden path Start Page di workspace E2E.
 * Aplikasi tidak punya fitur hapus halaman dan satu workspace hanya boleh satu
 * halaman, jadi halaman `e2e-start-page` dipakai ulang antar run; yang dibuat
 * dan dihapus tiap run hanya tautan `e2e-*`. Tidak menyentuh workspace nyata.
 */
const PAGE_SLUG = "e2e-start-page";
const LINK_LABEL = e2eName("link");
const LINK_TARGET = "https://example.com/e2e";
const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

test.describe.configure({ mode: "serial" });

let publicPath = "";
let visitsBefore = 0;

async function readCount(locator: ReturnType<Page["locator"]>) {
  const value = await locator
    .locator("[data-count]")
    .first()
    .getAttribute("data-count");
  return Number(value);
}

/** Baris tautan di Page Editor (bukan kartu di preview). */
function linkRow(page: Page) {
  return page.getByTestId("sp-link-row").filter({ hasText: LINK_LABEL });
}

function visitsStat(page: Page) {
  return page.getByLabel("Total kunjungan halaman publik");
}

test("buat halaman, tambah tautan, publish", async ({ page }) => {
  await page.goto("/start-page");

  // Pastikan memang di workspace E2E; tes ini membuat/mengubah data.
  await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();

  const createHeading = page.getByText("Buat Halaman", { exact: true }).first();
  if (await createHeading.isVisible().catch(() => false)) {
    await page.getByLabel("Judul Halaman").fill(PAGE_SLUG);
    await page.getByLabel("Slug (URL Halaman)").fill(PAGE_SLUG);
    await page.getByRole("button", { name: "Buat Halaman" }).click();
  }
  await expect(page.getByText("Link List")).toBeVisible({ timeout: 30_000 });

  const urlInput = page.getByLabel("URL Halaman Publik");
  publicPath = new URL(await urlInput.inputValue()).pathname;
  expect(publicPath).toBe(`/u/${PAGE_SLUG}`);

  await page.getByRole("button", { name: "Tambah Link" }).click();
  await page.getByLabel("Label").fill(LINK_LABEL);
  await page.getByLabel("URL Tujuan").fill(LINK_TARGET);
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(linkRow(page)).toBeVisible();

  // Scope ke card Share: menu samping juga punya item "Publish".
  const share = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Status Halaman" });
  const publish = share.getByRole("button", { name: "Publish", exact: true });
  const unpublish = share.getByRole("button", {
    name: "Unpublish",
    exact: true,
  });
  await expect(publish.or(unpublish)).toBeVisible();
  if (await publish.isVisible()) await publish.click();
  await expect(unpublish).toBeVisible();

  visitsBefore = await readCount(visitsStat(page));
});

test("halaman publik terbuka tanpa cookie, CSP bersih, tautan 302, counter naik", async ({
  browser,
  baseURL,
  page,
}) => {
  // Konteks tamu: tanpa sesi tersimpan. UA browser agar lolos filter bot (T-162.1).
  const guest = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
    userAgent: CHROME_UA,
  });
  const guestPage = await guest.newPage();
  const violations: string[] = [];
  await guestPage.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp ??= [];
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  guestPage.on("console", (msg) => {
    if (msg.text().includes("Content Security Policy"))
      violations.push(msg.text());
  });

  const response = await guestPage.goto(publicPath);
  expect(response?.status()).toBe(200);
  expect(new URL(guestPage.url()).pathname).toBe(publicPath);
  await expect(guestPage.getByText(LINK_LABEL)).toBeVisible();

  const domViolations = await guestPage.evaluate(
    () => (window as unknown as { __csp?: string[] }).__csp ?? [],
  );
  // `next dev` menyuntik <style> tanpa nonce dari overlay dev (T-164.6): CSP
  // hanya bermakna di build (staging/produksi), jadi tidak diuji di local.
  const isDevServer = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(
    baseURL ?? "",
  );
  if (isDevServer) {
    test.info().annotations.push({
      type: "csp",
      description: "dilewati di next dev (overlay dev melanggar style-src)",
    });
  } else {
    expect([...violations, ...domViolations]).toEqual([]);
  }

  // Klik tautan: 302 ke tujuan (tujuan eksternal dicegat, tidak ada trafik keluar).
  // Tautan dibuka di tab baru (target=_blank): pantau di level konteks.
  await guest.route("https://example.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "ok" }),
  );
  const goResponse = guest.waitForEvent("response", (r) =>
    r.url().includes(`${publicPath}/go/`),
  );
  const popup = guest.waitForEvent("page");
  await guestPage.getByText(LINK_LABEL).click();
  expect((await goResponse).status()).toBe(302);
  await (await popup).waitForURL(LINK_TARGET);
  await guest.close();

  // Counter di Page Editor naik.
  await page.goto("/start-page");
  await expect
    .poll(() => readCount(visitsStat(page)))
    .toBeGreaterThan(visitsBefore);
  await expect.poll(() => readCount(linkRow(page))).toBe(1);
});

test("bersihkan data e2e dan toast tidak menutupi tombol header (mobile)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/start-page");

  // Hapus semua tautan e2e-* (termasuk sisa run yang gagal).
  const leftovers = page
    .getByTestId("sp-link-row")
    .filter({ hasText: E2E_PREFIX });
  const total = await leftovers.count();
  for (let n = 0; n < total; n++) {
    await page
      .getByRole("button", { name: new RegExp(`^Hapus link ${E2E_PREFIX}`) })
      .first()
      .click();
    await page.getByRole("button", { name: "Hapus", exact: true }).click();
    await expect(leftovers).toHaveCount(total - n - 1);
  }

  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toContainText("Link dihapus");
  await expect(
    page.getByTestId("sp-link-row").filter({ hasText: E2E_PREFIX }),
  ).toHaveCount(0);

  // T-170: toast tidak boleh menimpa tombol di header.
  // Tunggu animasi masuk selesai (sonner meluncur dari atas): ukur posisi akhir.
  await expect(toast).toHaveAttribute("data-mounted", "true");
  await page.waitForTimeout(1_000);
  const toastBox = await toast.boundingBox();
  expect(toastBox).not.toBeNull();
  // Selector CSS, bukan getByRole: dialog yang baru menutup masih menyisakan
  // aria-hidden di sekitarnya sehingga tombol tak terlihat oleh role query.
  const menuButton = page.locator('button[aria-label="Buka menu"]');
  await expect(menuButton).toBeVisible();
  const box = await menuButton.boundingBox();
  expect(box).not.toBeNull();
  if (!box || !toastBox) return;
  const overlaps =
    box.x < toastBox.x + toastBox.width &&
    box.x + box.width > toastBox.x &&
    box.y < toastBox.y + toastBox.height &&
    box.y + box.height > toastBox.y;
  expect(overlaps, "toast menimpa tombol Buka menu").toBe(false);
});
