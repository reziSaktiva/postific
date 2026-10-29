import { expect, test, type Page } from "@playwright/test";

/**
 * T-177 (KI-104, ADR-055): pengunjung tanpa cookie `theme` dan ber-OS gelap
 * harus mendapat kelas `dark` pada `<html>` sebelum `<body>` dilukis, bukan
 * setelah chunk framework dimuat. Tes berjalan sebagai tamu (tanpa sesi) di
 * `/login` (rute biasa) dan halaman publik `e2e-start-page` (rute dengan CSP
 * nonce, T-160). Halaman itu dibuat dan dipublish oleh `start-page.e2e.ts`
 * (berkas yang jalan lebih dulu) dan dipakai ulang antar run. Jangan pakai
 * `/u/<slug tak ada>`: 404 itu memakai shell error yang dirender di client,
 * tanpa skrip tema di HTML awal.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const PUBLIC_PAGE_PATH = "/u/e2e-start-page";

/**
 * Merekam apakah kelas `dark` sudah terpasang tepat saat `<body>` pertama kali
 * muncul di DOM. Skrip inline sinkron di `<head>` sudah berjalan pada saat itu;
 * skrip yang baru jalan setelah framework dimuat belum.
 */
async function recordDarkAtBodyInsertion(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __darkAtBody?: boolean };
    new MutationObserver(() => {
      if (document.body && w.__darkAtBody === undefined) {
        w.__darkAtBody = document.documentElement.classList.contains("dark");
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

async function darkAtBody(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __darkAtBody?: boolean }).__darkAtBody,
  );
}

for (const path of ["/login", PUBLIC_PAGE_PATH]) {
  test.describe(path, () => {
    test("OS gelap tanpa cookie: kelas dark sudah ada sebelum body dilukis", async ({
      page,
    }) => {
      const cspViolations: string[] = [];
      page.on("console", (message) => {
        if (message.text().includes("Content Security Policy")) {
          cspViolations.push(message.text());
        }
      });
      await page.emulateMedia({ colorScheme: "dark" });
      await recordDarkAtBodyInsertion(page);

      const response = await page.goto(path);
      await page.waitForLoadState("load");

      // `/u/e2e-start-page` dibuat oleh `start-page.e2e.ts`; 404 di sini
      // berarti halaman itu belum ada, bukan perbaikan tema yang rusak.
      expect(
        response?.status(),
        `${path} harus 200 (halaman E2E dibuat start-page.e2e.ts)`,
      ).toBe(200);
      // Kelas `dark` sudah ada saat `<body>` muncul = tidak ada lukisan terang
      // lebih dulu, jadi tidak ada pemudaran kartu/lencana sesudahnya.
      expect(await darkAtBody(page)).toBe(true);
      // Skrip inline ber-nonce tidak boleh diblokir CSP di `/u/*`.
      expect(cspViolations).toEqual([]);
    });

    test("OS terang tanpa cookie: tetap terang", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await recordDarkAtBodyInsertion(page);

      await page.goto(path);
      await page.waitForLoadState("load");

      expect(await darkAtBody(page)).toBe(false);
      await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
    });
  });
}

test("cookie theme=light mengalahkan OS gelap", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "theme", value: "light", url: baseURL as string },
  ]);
  await page.emulateMedia({ colorScheme: "dark" });
  await recordDarkAtBodyInsertion(page);

  await page.goto("/login");
  await page.waitForLoadState("load");

  expect(await darkAtBody(page)).toBe(false);
  await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
});
