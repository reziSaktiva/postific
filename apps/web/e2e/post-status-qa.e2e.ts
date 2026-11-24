import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { AUTH_FILE, creatorCredentialsProblem } from "./support/auth";
import { creatorContext } from "./support/creator-auth";
import {
  cleanupSeedFixtures,
  seedDbSkipReason,
  seedPostStatusFixtures,
  type SeedIds,
} from "./support/seed-db";

/**
 * QA status post, akun Disconnected, dan Pinterest tersimpan (T-207.4), untuk
 * peran Owner (sesi bawaan proyek) dan Creator (sesi T-214).
 *
 * Data disemai langsung di DB workspace E2E Sandbox (`support/seed-db.ts`) dan
 * dihapus di `afterAll`. Tes TIDAK PERNAH menekan Save as Draft, Schedule,
 * Publish Now, Retry, atau tombol konfirmasi, dan tidak memanggil Outstand
 * untuk menulis. Draft Editor hanya dibuka lalu ditutup (Close).
 *
 * Papan Pinterest nyata hanya dibaca bila `E2E_PINTEREST_OUTSTAND_ID` dan
 * `E2E_PINTEREST_BOARD_ID` diisi; tanpa itu id palsu dipakai dan nama papan
 * tidak dapat diverifikasi (daftar board gagal dimuat), hanya judul dan link.
 */
const skip = seedDbSkipReason();
test.skip(skip !== null, skip ?? "");

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let seed: SeedIds;
const realBoardName = process.env.E2E_PINTEREST_BOARD_NAME;

test.beforeAll(async () => {
  await cleanupSeedFixtures(); // sisa run lama yang terhenti (bukan run lain)
  seed = await seedPostStatusFixtures({
    pinterestOutstandId: process.env.E2E_PINTEREST_OUTSTAND_ID || undefined,
    pinterestBoardId: process.env.E2E_PINTEREST_BOARD_ID || undefined,
  });
});

test.afterAll(async () => {
  const removed = await cleanupSeedFixtures({ stamp: seed?.stamp });
  console.log("seed dihapus:", JSON.stringify(removed));
});

function dialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: /Edit Draft|New Post/ });
}

/**
 * Open the Calendar and click the chip of the post with this caption; return
 * the post preview popover (T-288, S-008, replaces the old summary popover).
 */
async function openCalendarEntry(page: Page, caption: string) {
  await page.goto("/publish?view=calendar&range=month");
  const entry = page.getByRole("button", { name: new RegExp(caption) }).first();
  await expect(entry).toBeVisible({ timeout: 30_000 });
  await entry.click();
  const popover = page.getByRole("dialog", { name: "Pratinjau posting" });
  await expect(popover).toContainText(caption, { timeout: 30_000 });
  return popover;
}

/** Read-only preview: no Edit, no cancel-schedule item; the footer action by status. */
async function expectReadOnlyPreview(
  page: Page,
  pop: Locator,
  footer: "go-to-post" | "retry",
) {
  await expect(pop.getByRole("button", { name: "Edit" })).toHaveCount(0);
  if (footer === "go-to-post") {
    await expect(pop.getByRole("link", { name: /Go to post/ })).toBeVisible();
  } else {
    // Retry is shown (allowed for any role on a failed post) but never pressed.
    await expect(pop.getByRole("button", { name: "Coba Lagi" })).toBeVisible();
  }
  await pop.getByRole("button", { name: "Aksi lainnya" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Batalkan jadwal" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
}

/** Expand the preview into the History Detail dialog. */
async function expandPreview(page: Page, pop: Locator) {
  await pop.getByRole("button", { name: "Perbesar" }).click();
  await expect(pop).toHaveCount(0);
  return page.getByRole("dialog");
}

function suite(label: string, getPage: () => Page) {
  test(`${label} Published read-only di Calendar dan History Detail`, async () => {
    const page = getPage();
    const pop = await openCalendarEntry(page, seed.captions.published);
    await expectReadOnlyPreview(page, pop, "go-to-post");
    const detail = await expandPreview(page, pop);
    await expect(detail).toContainText(/Dipublikasikan/, { timeout: 20_000 });
    await expect(detail).toContainText(seed.captions.published);
    await expect(
      detail.getByRole("button", {
        name: /Retry|Coba lagi|Buka Draft Editor/i,
      }),
    ).toHaveCount(0);
  });

  test(`${label} Failed read-only di Calendar dan History Detail`, async () => {
    const page = getPage();
    const pop = await openCalendarEntry(page, seed.captions.failed);
    await expect(pop.getByText("Publish gagal")).toBeVisible();
    await expectReadOnlyPreview(page, pop, "retry");
    const detail = await expandPreview(page, pop);
    await expect(detail).toContainText(seed.captions.failed, {
      timeout: 20_000,
    });
    await expect(
      detail.getByRole("button", { name: "Buka Draft Editor" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `test-results/post-status/${label}-failed-detail.png`,
    });
  });

  test(`${label} Imported read-only di Calendar`, async () => {
    const page = getPage();
    const pop = await openCalendarEntry(page, seed.captions.imported);
    await expectReadOnlyPreview(page, pop, "go-to-post");
  });

  test(`${label} Pinterest Edit Draft: judul, link, dan board dari data tersimpan`, async () => {
    const page = getPage();
    await page.goto("/publish/drafts");
    const row = page
      .getByRole("button")
      .filter({ hasText: seed.captions.pinterestDraft })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    const dlg = dialog(page);
    await expect(
      dlg.getByRole("heading", { name: "Edit Draft" }),
    ).toBeVisible();
    await expect(dlg.getByLabel("Caption")).toHaveValue(
      seed.captions.pinterestDraft,
      { timeout: 15_000 },
    );
    await expect(dlg.getByLabel(/Pin Title/)).toHaveValue(seed.pinterest.title);
    await expect(dlg.getByLabel(/Destination Link/)).toHaveValue(
      seed.pinterest.link,
    );
    await expect(dlg.getByText("Format: Pin")).toBeVisible();
    if (seed.pinterestIsReal && realBoardName) {
      // Papan nyata dibaca (hanya baca) dan terpilih dari data tersimpan.
      await expect(dlg.getByRole("combobox", { name: "Board" })).toContainText(
        realBoardName,
        { timeout: 30_000 },
      );
    }
    await page.screenshot({
      path: `test-results/post-status/${label}-pinterest-edit.png`,
    });
    // Tombol aksi tampil sesuai peran (tidak ditekan).
    await expect(
      dlg.getByRole("button", { name: "Save as Draft" }),
    ).toBeVisible();
    await dlg.getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test(`${label} akun Disconnected: Channels, Edit Draft, dan peringatan`, async () => {
    const page = getPage();
    await page.goto("/publish/drafts");
    const row = page
      .getByRole("button")
      .filter({ hasText: seed.captions.disconnectedDraft })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    const dlg = dialog(page);
    await expect(
      dlg.getByRole("heading", { name: "Edit Draft" }),
    ).toBeVisible();
    await expect(dlg.getByLabel("Caption")).toHaveValue(
      seed.captions.disconnectedDraft,
      { timeout: 15_000 },
    );
    await expect(dlg.getByText("Akun ini terputus.")).toBeVisible();
    await expect(dlg.getByText("Akun terputus")).toBeVisible();
    // Schedule nonaktif karena jadwal kosong; Publish Now tidak ditekan.
    await expect(
      dlg.getByRole("button", { name: "Schedule", exact: true }),
    ).toBeDisabled();
    const publishNow = dlg.getByRole("button", {
      name: "Publish Now",
      exact: true,
    });
    // ADR-155 addendum B.2: akun Disconnected tidak memblokir Publish Now
    // (penolakan akun tidak aktif ada di server).
    await expect(publishNow).toBeEnabled();
    await dlg.getByRole("button", { name: "Tambah akun" }).click();
    const pop = page.getByRole("dialog", { name: "Pilih akun tujuan" });
    const li = pop.getByRole("listitem").filter({ hasText: /e2e-seed-fb-/ });
    await expect(li).toContainText("Disconnected");
    await expect(li.getByRole("link", { name: "Reconnect" })).toHaveAttribute(
      "href",
      "/settings/connected-accounts",
    );
    await page.screenshot({
      path: `test-results/post-status/${label}-disconnected.png`,
    });
    await page.keyboard.press("Escape");
    await dlg.getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test(`${label} Draft Editor: tombol aksi sesuai peran`, async () => {
    const page = getPage();
    await page.goto("/publish/drafts");
    await page.getByRole("button", { name: "New Post" }).last().click();
    const dlg = dialog(page);
    await expect(
      dlg.getByRole("button", { name: "Save as Draft" }),
    ).toBeEnabled({
      timeout: 15_000,
    });
    await expect(
      dlg.getByRole("button", { name: "Schedule", exact: true }),
    ).toBeVisible();
    await expect(
      dlg.getByRole("button", { name: "Publish Now", exact: true }),
    ).toBeVisible();
    await dlg.getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });
}

// Owner (sesi bawaan proyek).
let ownerPage: Page;
test.describe("Owner", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: AUTH_FILE,
    });
    ownerPage = await ctx.newPage();
  });
  test.afterAll(async () => {
    await ownerPage?.context().close();
  });
  suite("Owner", () => ownerPage);
});

// Creator (sesi T-214).
const problem = creatorCredentialsProblem();
let creatorCtx: BrowserContext;
let creatorPage: Page;
test.describe("Creator", () => {
  test.skip(problem !== null, problem ?? "");
  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    creatorCtx = await creatorContext(browser, baseURL);
    creatorPage = await creatorCtx.newPage();
  });
  test.afterAll(async () => {
    await creatorCtx?.close();
  });
  suite("Creator", () => creatorPage);
});
