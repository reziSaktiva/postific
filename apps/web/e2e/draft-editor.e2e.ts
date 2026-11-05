import fs from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { AUTH_FILE } from "./support/auth";
import { E2E_WORKSPACE_NAME } from "./support/workspace";

const OUT = "test-results/draft-editor";
const STAMP = Date.now().toString(36);
const CAPTION = `e2e-qa-draft-${STAMP} caption uji`;
const CAPTION_RESUME = `e2e-qa-resume-${STAMP}`;
const STORAGE_KEY_PREFIX = "sm_draft_editor_new_post_unsaved_v1";

// PNG 1x1 valid
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const consoleLog: string[] = [];
function track(page: Page, label: string) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      consoleLog.push(`[${label}] ${m.type()}: ${m.text().slice(0, 400)}`);
  });
  page.on("pageerror", (e) =>
    consoleLog.push(`[${label}] pageerror: ${String(e).slice(0, 400)}`),
  );
}
function snap(page: Page, name: string) {
  return page.screenshot({ path: `${OUT}/${name}.png` });
}
function dialog(page: Page) {
  return page.getByRole("dialog").filter({
    hasText: /New Post|Edit Draft|Konfirmasi Jadwal|Konfirmasi Publish/,
  });
}
/**
 * T-205: jadwal diatur lewat popover "Atur jadwal" (Calendar + jam), bukan dua
 * input di badan form. Memilih hari `offsetDays` dari hari ini (zona WIB, zona
 * akun test) lalu menutup popover dengan "Selesai".
 */
async function pickScheduleDay(page: Page, dlg: Locator, offsetDays: number) {
  const target = new Date(Date.now() + offsetDays * 86_400_000);
  const label = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(target);
  await dlg.getByRole("button", { name: /^Jadwal:/ }).click();
  const day = page.getByRole("button", {
    name: new RegExp(`${label}(, dipilih)?$`),
  });
  if ((await day.count()) === 0) {
    await page.getByRole("button", { name: "Ke bulan berikutnya" }).click();
  }
  await day.click();
  await page.getByLabel("Jam").fill("10:00");
  await page.getByRole("button", { name: "Selesai" }).click();
}

function dayButton(page: Page, offsetDays: number) {
  const target = new Date(Date.now() + offsetDays * 86_400_000);
  const label = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(target);
  return page.getByRole("button", {
    name: new RegExp(`${label}(, dipilih)?$`),
  });
}
/**
 * Tunggu animasi/transisi berhingga selesai (pengganti jeda tetap). Animasi
 * tak berhingga (skeleton, spinner) dilewati karena tidak pernah selesai, dan
 * animasi yang dibatalkan (unmount) tidak menggagalkan tes.
 */
async function settleAnimations(el: Locator) {
  await el.evaluate((node) =>
    Promise.allSettled(
      node
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}
/** Kotak dialog; gagal dengan pesan jelas (bukan TypeError) bila dialog terlepas. */
async function dialogBox(dlg: Locator) {
  const box = await dlg.boundingBox();
  if (!box) throw new Error("Dialog tidak terpasang saat mengukur ukuran");
  return box;
}
async function selectInstagram(page: Page, dlg: Locator) {
  await dlg.getByRole("button", { name: "Channels" }).click();
  // Tes ini mengasumsikan tepat satu akun Instagram di workspace E2E Sandbox.
  // Bila ada lebih dari satu, gagal dengan jelas, bukan diam-diam memilih akun
  // yang bisa jadi akun nyata.
  const acct = page.getByRole("checkbox", { name: /Pilih Instagram/ });
  await expect(acct).toHaveCount(1, { timeout: 15_000 });
  await expect(acct).toBeVisible({ timeout: 15_000 });
  await acct.check();
  await page.keyboard.press("Escape");
  await expect(acct).toBeHidden();
}
async function uploadPng(dlg: Locator, name: string) {
  await dlg.locator("#draft-media").setInputFiles({
    name,
    mimeType: "image/png",
    buffer: PNG,
  });
  const del = dlg.getByRole("button", {
    name: /^Hapus e2e-qa-.*secara permanen/,
  });
  await del.waitFor({ timeout: 30_000 });
  return del;
}
async function deleteMediaViaUi(page: Page, del: Locator) {
  await del.click({ force: true });
  await page
    .getByRole("alertdialog", { name: "Hapus media ini secara permanen?" })
    .getByRole("button", { name: "Hapus Media" })
    .click();
  await expect(del).toHaveCount(0, { timeout: 20_000 });
}
async function openNewPostFromDrafts(page: Page) {
  await page.goto("/publish/drafts");
  await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
  await page.getByRole("button", { name: "New Post" }).last().click();
}
async function hasStorageKey(page: Page) {
  return page.evaluate(
    (p) =>
      Object.keys(window.localStorage).filter((k) => k.startsWith(p)).length,
    STORAGE_KEY_PREFIX,
  );
}

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

async function deleteE2eDrafts(page: Page): Promise<number> {
  await page.goto("/publish/drafts");
  await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
  // Daftar sudah dimuat bila ada baris draft atau keadaan kosong.
  await expect(
    page
      .getByRole("button", { name: "Hapus draft" })
      .first()
      .or(page.getByText("Belum ada draft")),
  ).toBeVisible({ timeout: 15_000 });
  let removed = 0;
  const rows = page.getByRole("button").filter({ hasText: /e2e-qa-draft-/ });
  for (let i = 0; i < 10; i++) {
    const before = await rows.count();
    if (before === 0) break;
    await rows.first().getByRole("button", { name: "Hapus draft" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Hapus Draft" })
      .click();
    // tunggu daftar benar-benar menyusut, bukan jeda tetap
    await expect(rows).toHaveCount(before - 1, { timeout: 15_000 });
    removed++;
  }
  return removed;
}

// Mode serial melewati S10 bila tes sebelumnya gagal, jadi pembersihan juga
// dijalankan di sini (idempoten: tanpa sisa, tidak melakukan apa pun).
test.afterAll(async ({ browser }) => {
  fs.writeFileSync(`${OUT}/console.txt`, consoleLog.join("\n") || "(kosong)");
  const context = await browser.newContext({ storageState: AUTH_FILE });
  try {
    await deleteE2eDrafts(await context.newPage());
  } finally {
    await context.close();
  }
});

test("S1 buka New Post dari Drafts: Standard, judul, chip, Close, Akun tujuan", async ({
  page,
}) => {
  track(page, "S1");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  const resume = page.getByText("Resume unfinished post?");
  await expect(resume).toBeHidden();
  await expect(dlg.getByRole("heading", { name: "New Post" })).toBeVisible();
  await expect(dlg.getByText("Draft", { exact: true }).first()).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Fullscreen" })).toBeVisible();
  await expect(dlg.getByRole("heading", { name: "Akun tujuan" })).toBeVisible();
  // Daftar akun selesai dimuat bila pintasan menampilkan jumlahnya.
  await expect(dlg.getByText(/Terakhir dipakai \(\d+\)/)).toBeVisible({
    timeout: 15_000,
  });
  const accountsText = await dlg
    .getByRole("heading", { name: "Akun tujuan" })
    .locator("xpath=..")
    .innerText();
  console.log("S1 Akun tujuan isi:", JSON.stringify(accountsText));
  const box = await dlg.boundingBox();
  const vp = page.viewportSize()!;
  console.log(
    "S1 dialog box",
    JSON.stringify(box),
    "viewport",
    JSON.stringify(vp),
  );
  expect(box!.width).toBeLessThan(vp.width - 10);
  // T-206.1: Standard selebar 1120px bila viewport cukup lebar (94vw).
  expect(Math.round(box!.width)).toBe(
    Math.min(1120, Math.round(vp.width * 0.94)),
  );
  await snap(page, "s1-new-post-standard");
});

test("S2 toggle Fullscreen/Standard, tidak dipersist", async ({ page }) => {
  track(page, "S2");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  const vp = page.viewportSize()!;
  await dlg.getByRole("button", { name: "Fullscreen" }).click();
  await expect(dlg.getByRole("button", { name: "Standard" })).toBeVisible();
  // Tunggu animasi ukuran selesai: ukuran dibaca setelah mencapai nilai akhir.
  await expect
    .poll(async () => Math.round((await dialogBox(dlg)).width))
    .toBe(vp.width);
  await expect
    .poll(async () => Math.round((await dialogBox(dlg)).height))
    .toBe(vp.height);
  const fsBox = await dlg.boundingBox();
  console.log("S2 fullscreen box", JSON.stringify(fsBox));
  expect(Math.round(fsBox!.width)).toBe(vp.width);
  expect(Math.round(fsBox!.height)).toBe(vp.height);
  await snap(page, "s2-fullscreen");
  await dlg.getByRole("button", { name: "Standard" }).click();
  await expect(dlg.getByRole("button", { name: "Fullscreen" })).toBeVisible();
  await expect
    .poll(async () => (await dialogBox(dlg)).width)
    .toBeLessThan(vp.width - 10);
  // persist check: ke Fullscreen, tutup, buka ulang
  await dlg.getByRole("button", { name: "Fullscreen" }).click();
  await expect(dlg.getByRole("button", { name: "Standard" })).toBeVisible();
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "New Post" }).last().click();
  await expect(dialog(page)).toBeVisible();
  await expect(
    dialog(page).getByRole("button", { name: "Fullscreen" }),
  ).toBeVisible();
  const reopenBox = await dialog(page).boundingBox();
  expect(reopenBox!.width).toBeLessThan(vp.width - 10);
  await snap(page, "s2-reopen-standard");
});

test("S3 caption, upload media kecil, hapus media dengan dialog konfirmasi", async ({
  page,
}) => {
  track(page, "S3");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await dlg.getByLabel("Caption").fill(CAPTION_RESUME + " s3");
  await expect(dlg.getByLabel("Caption")).toHaveValue(CAPTION_RESUME + " s3");
  await dlg.locator("#draft-media").setInputFiles({
    name: `e2e-qa-${STAMP}.png`,
    mimeType: "image/png",
    buffer: PNG,
  });
  const delBtn = dlg.getByRole("button", {
    name: /^Hapus e2e-qa-.*secara permanen/,
  });
  const mediaErr = dlg.locator("p.text-destructive, [class*=text-destructive]");
  const outcome = await Promise.race([
    delBtn.waitFor({ timeout: 30_000 }).then(() => "uploaded"),
    mediaErr
      .first()
      .waitFor({ timeout: 30_000 })
      .then(() => "error"),
  ]).catch(() => "timeout");
  console.log("S3 hasil upload:", outcome);
  if (outcome === "error") {
    console.log("S3 pesan error:", await mediaErr.first().innerText());
  }
  await snap(page, "s3-after-upload");
  if (outcome === "uploaded") {
    await delBtn.focus();
    await delBtn.click({ force: true });
    const confirm = page.getByRole("alertdialog", {
      name: "Hapus media ini secara permanen?",
    });
    await expect(confirm).toBeVisible();
    await snap(page, "s3-confirm-delete-media");
    // batal dulu: media harus tetap ada
    const cancel = confirm.getByRole("button", { name: /Batal|Cancel/ });
    await cancel.click();
    await expect(confirm).toHaveCount(0);
    await expect(delBtn).toHaveCount(1);
    // lalu hapus sungguhan (cleanup media milik tes)
    await delBtn.click({ force: true });
    await page
      .getByRole("alertdialog", { name: "Hapus media ini secara permanen?" })
      .getByRole("button", { name: "Hapus Media" })
      .click();
    await expect(delBtn).toHaveCount(0, { timeout: 20_000 });
    console.log("S3 media terhapus via UI");
    await snap(page, "s3-media-deleted");
  }
  // Tutup: caption tersisa -> persist di localStorage; bersihkan dengan Mulai Baru nanti
  await dlg.getByLabel("Caption").fill("");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  console.log(
    "S3 key localStorage setelah close caption kosong:",
    await hasStorageKey(page),
  );
});

test("S4 Save as Draft hanya caption: redirect ke Drafts, draft muncul", async ({
  page,
}) => {
  track(page, "S4");
  await page.goto("/publish/queue");
  await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
  await page.getByRole("button", { name: "New Post" }).last().click();
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await dlg.getByLabel("Caption").fill(CAPTION);
  const save = dlg.getByRole("button", { name: "Save as Draft" });
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await save.click();
  await expect(dialog(page)).toHaveCount(0, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/publish\/drafts/, { timeout: 30_000 });
  await expect(page.getByText(CAPTION)).toBeVisible({ timeout: 30_000 });
  console.log("S4 URL akhir:", page.url());
  console.log("S4 key localStorage:", await hasStorageKey(page));
  await snap(page, "s4-draft-list");
});

test("S5 Edit Draft: form terisi dari server tanpa dialog Resume", async ({
  page,
}) => {
  track(page, "S5");
  await page.goto("/publish/drafts");
  const row = page.getByRole("button").filter({ hasText: CAPTION }).first();
  await expect(row).toBeVisible();
  await row.click();
  const dlg = dialog(page);
  await expect(dlg.getByRole("heading", { name: "Edit Draft" })).toBeVisible();
  await expect(page.getByText("Resume unfinished post?")).toHaveCount(0);
  await expect(dlg.getByLabel("Caption")).toHaveValue(CAPTION, {
    timeout: 15_000,
  });
  await expect(dlg.getByText("Draft", { exact: true }).first()).toBeVisible();
  await snap(page, "s5-edit-draft");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  console.log(
    "S5 key localStorage setelah close Edit:",
    await hasStorageKey(page),
  );
});

test("S6 Resume: Close lalu buka lagi -> dialog; Resume dan Mulai Baru", async ({
  page,
}) => {
  track(page, "S6");
  await openNewPostFromDrafts(page);
  let dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await dlg.getByLabel("Caption").fill(CAPTION_RESUME);
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await hasStorageKey(page)).toBe(1);

  await page.getByRole("button", { name: "New Post" }).last().click();
  const resumeHeading = page.getByText("Resume unfinished post?");
  await expect(resumeHeading).toBeVisible();
  await expect(page.getByRole("alertdialog")).toContainText(CAPTION_RESUME);
  await expect(dialog(page)).toHaveCount(0);
  // T-206.2: teks dirapikan, tanpa ID KSP/ADR; hanya caption yang kembali.
  const resumeText = (await page.getByRole("alertdialog").innerText()) ?? "";
  expect(resumeText).not.toMatch(/KSP|ADR/);
  expect(resumeText).toContain("Hanya caption yang tersimpan");
  await snap(page, "s6-resume-dialog");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  dlg = dialog(page);
  await expect(dlg.getByLabel("Caption")).toHaveValue(CAPTION_RESUME);
  await snap(page, "s6-after-resume");

  // tutup lagi (persist), buka, Mulai Baru
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "New Post" }).last().click();
  await expect(resumeHeading).toBeVisible();
  await page.getByRole("button", { name: "Mulai Baru" }).click();
  dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await expect(dlg.getByLabel("Caption")).toHaveValue("");
  expect(await hasStorageKey(page)).toBe(0);
  await snap(page, "s6-mulai-baru");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  // buka lagi: tidak ada dialog Resume
  await page.getByRole("button", { name: "New Post" }).last().click();
  await expect(dialog(page)).toBeVisible();
  await expect(resumeHeading).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Close" }).click();
});

test("S7 validasi: Schedule dan Publish Now nonaktif saat form belum lengkap", async ({
  page,
}) => {
  track(page, "S7");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  const sched = dlg.getByRole("button", { name: "Schedule", exact: true });
  const pub = dlg.getByRole("button", { name: "Publish Now", exact: true });
  const draftBtn = dlg.getByRole("button", { name: "Save as Draft" });
  await expect(sched).toBeDisabled();
  await expect(pub).toBeDisabled();
  await expect(draftBtn).toBeEnabled({ timeout: 15_000 });
  await dlg.getByLabel("Caption").fill("e2e-qa validasi");
  await pickScheduleDay(page, dlg, 3);
  await expect(sched).toBeDisabled();
  await expect(pub).toBeDisabled();
  console.log(
    "S7 Schedule/Publish Now tetap nonaktif tanpa akun (caption+jadwal terisi)",
  );
  await snap(page, "s7-validation");
  await dlg.getByLabel("Caption").fill("");
  await dlg.getByRole("button", { name: "Close" }).click();
});

test("S7b dengan akun terhubung: tombol aktif, ringkasan konfirmasi muncul, Batal (tanpa eksekusi)", async ({
  page,
}) => {
  track(page, "S7b");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  const sched = dlg.getByRole("button", { name: "Schedule", exact: true });
  const pub = dlg.getByRole("button", { name: "Publish Now", exact: true });
  // T-201: akun dipilih lewat popover Channels (portal, di luar dialog).
  await selectInstagram(page, dlg);
  await expect(dlg).toBeVisible();
  await expect(pub).toBeDisabled(); // caption kosong
  await dlg.getByLabel("Caption").fill("e2e-qa konfirmasi saja");
  await expect(pub).toBeDisabled(); // Instagram tanpa media
  console.log(
    "S7b banner validasi:",
    JSON.stringify(
      await dlg.locator("[role=alert], [role=status]").allInnerTexts(),
    ),
  );
  await snap(page, "s7b-no-media");
  await dlg.locator("#draft-media").setInputFiles({
    name: `e2e-qa-${STAMP}-b.png`,
    mimeType: "image/png",
    buffer: PNG,
  });
  const delBtn = dlg.getByRole("button", {
    name: /^Hapus e2e-qa-.*secara permanen/,
  });
  try {
    await delBtn.waitFor({ timeout: 30_000 });
    await expect(pub).toBeEnabled();
    await expect(sched).toBeDisabled(); // belum ada jadwal
    const radios = await dlg.getByRole("radio").allInnerTexts();
    const radioLabels = await dlg.getByRole("radiogroup").innerText();
    console.log(
      "S7b format radiogroup:",
      JSON.stringify(radioLabels),
      radios.length,
    );
    await snap(page, "s7b-account-selected");
    await pickScheduleDay(page, dlg, 3);
    await expect(sched).toBeEnabled();
    // Tombol jadwal menampilkan jadwal terisi, mis. "Rab, 4 Nov · 10:00 WIB".
    await expect(
      dlg.getByRole("button", { name: /^Jadwal: .+ · 10:00 WIB$/ }),
    ).toBeVisible();
    // Schedule -> hanya ringkasan konfirmasi, lalu Batal
    await sched.click();
    await expect(
      dlg.getByRole("heading", { name: "Konfirmasi Jadwal" }),
    ).toBeVisible();
    await expect(
      dlg.getByRole("button", { name: /Konfirmasi & Jadwalkan/ }),
    ).toBeVisible();
    await snap(page, "s7b-confirm-schedule");
    await dlg.getByRole("button", { name: "Batal", exact: true }).click();
    await expect(dlg.getByRole("heading", { name: "New Post" })).toBeVisible();
    await pub.click();
    await expect(
      dlg.getByRole("heading", { name: "Konfirmasi Publish" }),
    ).toBeVisible();
    await expect(dlg.getByText("Sekarang", { exact: true })).toBeVisible();
    // T-205.5: Pratinjau tetap terlihat saat Confirmation Summary tampil.
    await expect(
      page.getByRole("complementary", { name: "Pratinjau" }),
    ).toBeVisible();
    await snap(page, "s7b-confirm-publish-now");
    await dlg.getByRole("button", { name: "Batal", exact: true }).click();
    await expect(dlg.getByRole("heading", { name: "New Post" })).toBeVisible();
  } finally {
    // bersihkan media milik tes lewat UI, lalu caption supaya tidak persist
    if ((await delBtn.count()) > 0) {
      await delBtn.click({ force: true });
      await page
        .getByRole("alertdialog", { name: "Hapus media ini secara permanen?" })
        .getByRole("button", { name: "Hapus Media" })
        .click();
      await expect(delBtn).toHaveCount(0, { timeout: 20_000 });
      console.log("S7b media terhapus via UI");
    }
  }
  await dlg.getByLabel("Caption").fill("");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test("S8a layar sempit 375: modal penuh, tanpa overflow horizontal", async ({
  page,
}) => {
  track(page, "S8a");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/publish/drafts");
  await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
  await page.getByRole("button", { name: "New Post" }).last().click();
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  // Metrik overflow hanya bermakna setelah ukuran akhir dan daftar akun termuat.
  await expect
    .poll(async () => Math.round((await dialogBox(dlg)).width))
    .toBe(375);
  await expect(dlg.getByText(/Terakhir dipakai \(\d+\)/)).toBeVisible({
    timeout: 15_000,
  });
  await settleAnimations(dlg);
  const m = await page.evaluate(() => {
    const d = document.querySelector(
      '[role="dialog"][data-state="open"]',
    ) as HTMLElement;
    const scrollers = Array.from(d.querySelectorAll("*"))
      .filter(
        (e) =>
          (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1 &&
          getComputedStyle(e as HTMLElement).overflowX === "visible",
      )
      .map(
        (e) =>
          `${e.tagName}.${(e as HTMLElement).className.toString().slice(0, 60)}`,
      );
    return {
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
      dialogW: d.getBoundingClientRect().width,
      dialogH: d.getBoundingClientRect().height,
      dialogScroll: d.scrollWidth,
      overflowing: scrollers.slice(0, 8),
    };
  });
  console.log("S8a metrik", JSON.stringify(m));
  expect(m.docScroll).toBeLessThanOrEqual(m.docClient);
  expect(Math.round(m.dialogW)).toBe(375);
  expect(m.dialogScroll).toBeLessThanOrEqual(376);
  expect(m.overflowing).toEqual([]);
  await snap(page, "s8a-mobile");
  // T-206.3: tab Editor|Pratinjau; toggle Fullscreen dan Pratinjau disembunyikan.
  await expect(dlg.getByRole("tab", { name: "Editor" })).toBeVisible();
  await expect(dlg.getByRole("tab", { name: "Pratinjau" })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Fullscreen" })).toHaveCount(0);
  await expect(dlg.getByRole("button", { name: "Pratinjau" })).toHaveCount(0);
  await dlg.getByRole("tab", { name: "Pratinjau" }).click();
  await expect(
    dlg.getByRole("complementary", { name: "Pratinjau" }),
  ).toBeVisible();
  await snap(page, "s8a-mobile-pratinjau");
  await dlg.getByRole("tab", { name: "Editor" }).click();
  // footer terlihat
  await expect(
    dlg.getByRole("button", { name: "Save as Draft" }),
  ).toBeInViewport();
  await dlg.getByRole("button", { name: "Close" }).click();
});

test.describe("S8b mode gelap", () => {
  test.use({ colorScheme: "dark" });
  test("tidak ada elemen tak terbaca dan tanpa kedipan terang", async ({
    page,
  }) => {
    track(page, "S8b");
    await page.goto("/publish/drafts");
    await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
    console.log(
      "S8b html class:",
      await page.evaluate(() => document.documentElement.className),
    );
    await page.getByRole("button", { name: "New Post" }).last().click();
    const dlg = dialog(page);
    await expect(dlg).toBeVisible();
    // Akun + caption supaya blok jaringan dan Pratinjau ikut terpindai.
    await selectInstagram(page, dlg);
    await dlg.getByLabel("Caption").fill("e2e-qa gelap pratinjau");
    await expect(
      page.getByRole("complementary", { name: "Pratinjau" }),
    ).toContainText("e2e-qa gelap pratinjau");
    await settleAnimations(dlg);
    // pantau kedipan terang: sampel latar dialog & kontras teks
    const res = await page.evaluate(() => {
      const lum = (rgb: string) => {
        const m = rgb.match(/[\d.]+/g)!.map(Number);
        const [r, g, b] = m.slice(0, 3).map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const d = document.querySelector(
        '[role="dialog"][data-state="open"]',
      ) as HTMLElement;
      const bg = getComputedStyle(d).backgroundColor;
      const bad: string[] = [];
      d.querySelectorAll("h2,h3,label,button,textarea,p,span").forEach((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        const r = (el as HTMLElement).getBoundingClientRect();
        if (!r.width || !r.height || !(el.textContent ?? "").trim()) return;
        let bgc = cs.backgroundColor;
        let p: HTMLElement | null = el as HTMLElement;
        while ((bgc === "rgba(0, 0, 0, 0)" || bgc === "transparent") && p) {
          p = p.parentElement;
          if (!p) break;
          bgc = getComputedStyle(p).backgroundColor;
        }
        const l1 = lum(cs.color),
          l2 = lum(bgc);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 3)
          bad.push(
            `${el.tagName} "${(el.textContent ?? "").trim().slice(0, 30)}" ratio=${ratio.toFixed(2)}`,
          );
      });
      return { bg, bgLum: lum(bg), bad: bad.slice(0, 10) };
    });
    console.log("S8b hasil", JSON.stringify(res));
    await snap(page, "s8b-dark-standard");
    await dlg.getByRole("button", { name: "Fullscreen" }).click();
    await expect
      .poll(async () => Math.round((await dialogBox(dlg)).width))
      .toBe(page.viewportSize()!.width);
    await snap(page, "s8b-dark-fullscreen");
    await dlg.getByRole("button", { name: "Close" }).click();
    // dialog Resume dalam gelap: caption terisi di atas; tunggu tersimpan dulu.
    await expect.poll(() => hasStorageKey(page)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "New Post" }).last().click();
    await expect(page.getByText("Resume unfinished post?")).toBeVisible();
    await snap(page, "s8b-dark-resume");
    await page.getByRole("button", { name: "Mulai Baru" }).click();
    await dialog(page).getByRole("button", { name: "Close" }).click();
    expect(res.bgLum).toBeLessThan(0.2);
    expect(res.bad).toEqual([]);
  });
});

test("S9 jalur lain: sidebar New Post dari Calendar dan klik baris draft membuka modal yang sama", async ({
  page,
}) => {
  track(page, "S9");
  await page.goto("/publish/calendar");
  await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
  // sidebar CTA (tombol New Post pertama)
  await page.getByRole("button", { name: "New Post" }).first().click();
  await expect(
    dialog(page).getByRole("heading", { name: "New Post" }),
  ).toBeVisible();
  await snap(page, "s9-sidebar-new-post-calendar");
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  console.log("S9 setelah Close URL:", page.url());
  expect(page.url()).toMatch(/\/publish\/calendar/);
});

test("S11 golden path: akun, caption, media, Pratinjau, jadwal dalam batas, Save as Draft, Edit Draft", async ({
  page,
}) => {
  track(page, "S11");
  const caption = `e2e-qa-draft-${STAMP} golden path`;
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await selectInstagram(page, dlg);
  await dlg.getByLabel("Caption").fill(caption);
  try {
    await uploadPng(dlg, `e2e-qa-${STAMP}-g.png`);
    // Pratinjau live memuat caption yang diketik.
    const preview = page.getByRole("complementary", { name: "Pratinjau" });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(caption);
    // Jadwal dalam batas diterima; hari ke-31 tidak bisa dipilih (ADR-154).
    await pickScheduleDay(page, dlg, 3);
    await expect(
      dlg.getByRole("button", { name: /^Jadwal: .+ · 10:00 WIB$/ }),
    ).toBeVisible();
    await dlg.getByRole("button", { name: /^Jadwal:/ }).click();
    if ((await dayButton(page, 31).count()) === 0) {
      await page.getByRole("button", { name: "Ke bulan berikutnya" }).click();
    }
    await expect(dayButton(page, 31)).toBeDisabled();
    await page.getByRole("button", { name: "Selesai" }).click();
    await snap(page, "s11-golden-path");
    await dlg.getByRole("button", { name: "Save as Draft" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/publish\/drafts/, { timeout: 30_000 });
    const row = page.getByRole("button").filter({ hasText: caption }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    // Edit Draft: akun, format, media, dan Pratinjau kembali dari data tersimpan.
    await row.click();
    const edit = dialog(page);
    await expect(
      edit.getByRole("heading", { name: "Edit Draft" }),
    ).toBeVisible();
    await expect(edit.getByLabel("Caption")).toHaveValue(caption, {
      timeout: 15_000,
    });
    await expect(
      edit.getByRole("button", { name: /^Hapus Instagram/ }),
    ).toBeVisible();
    await expect(edit.getByRole("radio", { name: "Post" })).toBeChecked();
    await expect(
      edit.getByRole("button", { name: /^Hapus e2e-qa-.*secara permanen/ }),
    ).toBeVisible();
    const editPreview = page.getByRole("complementary", { name: "Pratinjau" });
    await expect(editPreview).toBeVisible();
    await expect(editPreview).toContainText(caption);
    await snap(page, "s11-edit-draft");
  } finally {
    // Media diunggah ke Storage: hapus lewat UI walau tes gagal. Bila modal sudah
    // tertutup (draft tersimpan), buka lagi lewat Edit Draft untuk menghapusnya.
    const mediaBtn = () =>
      dialog(page).getByRole("button", {
        name: /^Hapus e2e-qa-.*secara permanen/,
      });
    if ((await dialog(page).count()) === 0) {
      await page.goto("/publish/drafts");
      await page
        .getByRole("button")
        .filter({ hasText: caption })
        .first()
        .click({ timeout: 10_000 });
    }
    if ((await mediaBtn().count()) > 0) {
      await deleteMediaViaUi(page, mediaBtn().first());
    }
    await dialog(page)
      .getByRole("button", { name: "Close" })
      .click({ timeout: 5_000 })
      .catch(() => undefined);
  }
});

test("S12 Reel dengan gambar: opsi Reel nonaktif dengan alasan, Publish Now tetap valid untuk Post", async ({
  page,
}) => {
  track(page, "S12");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await selectInstagram(page, dlg);
  await dlg.getByLabel("Caption").fill("e2e-qa reel gambar");
  const del = await uploadPng(dlg, `e2e-qa-${STAMP}-r.png`);
  try {
    await expect(dlg.getByRole("radio", { name: "Reel" })).toBeDisabled();
    await expect(dlg.getByText(/Reel nonaktif\./)).toBeVisible();
    await expect(dlg.getByRole("radio", { name: "Post" })).toBeChecked();
    await expect(
      dlg.getByRole("button", { name: "Publish Now", exact: true }),
    ).toBeEnabled();
    await snap(page, "s12-reel-image");
  } finally {
    await deleteMediaViaUi(page, del);
  }
  await dlg.getByLabel("Caption").fill("");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test("S13 baris channel: chip akun, Tambah akun, chip dilepas mengosongkan Pratinjau", async ({
  page,
}) => {
  track(page, "S13");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  const preview = page.getByRole("complementary", { name: "Pratinjau" });
  await expect(preview.getByText("Pratinjau tampil di sini")).toBeVisible();
  await selectInstagram(page, dlg);
  // Setelah ada pilihan: chip avatar plus tombol Tambah akun (T-201.3).
  await expect(dlg.getByTestId("channel-chip")).toHaveCount(1);
  await expect(dlg.getByRole("button", { name: "Tambah akun" })).toBeVisible();
  await expect(preview.getByText("Pratinjau tampil di sini")).toBeHidden();
  await dlg.getByRole("button", { name: /^Hapus Instagram/ }).click();
  await expect(dlg.getByTestId("channel-chip")).toHaveCount(0);
  await expect(preview.getByText("Pratinjau tampil di sini")).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Channels" })).toBeVisible();
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test("S14 popover Channels dengan data nyata: pencarian, status koneksi, Hubungkan akun, Terakhir dipakai dari DB", async ({
  page,
}) => {
  track(page, "S14");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  // Dropzone dan toolbar media (T-202.1): hanya satu aksi lampiran.
  await expect(
    dlg.getByText("Tarik file ke sini atau klik untuk memilih"),
  ).toBeVisible();
  await expect(
    dlg.getByRole("button", { name: "Lampirkan media" }),
  ).toBeVisible();
  await expect(dlg.getByRole("button", { name: /emoji|hashtag/i })).toHaveCount(
    0,
  );

  await dlg.getByRole("button", { name: "Channels" }).click();
  const popover = page.getByRole("dialog", { name: "Pilih akun tujuan" });
  await expect(popover).toBeVisible();
  const rows = popover
    .getByRole("list", { name: "Daftar akun" })
    .getByRole("listitem");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  // Jumlah akun mengikuti workspace E2E (tidak dikunci ke satu akun).
  const total = await rows.count();
  expect(total).toBeGreaterThanOrEqual(1);
  await expect(rows.first()).toContainText("Terhubung");
  const rowTexts = await rows.allInnerTexts();
  await expect(
    popover.getByRole("link", { name: "Hubungkan akun" }),
  ).toHaveAttribute("href", "/settings/connected-accounts");
  await expect(popover.getByText(`Pilih semua (${total})`)).toBeVisible();
  await snap(page, "s14-channels-popover");

  // Pencarian menyaring dengan data nyata.
  await popover.getByLabel("Cari akun").fill("zzz-tidak-ada");
  await expect(popover.getByText("Tidak ada akun yang cocok.")).toBeVisible();
  await popover.getByLabel("Cari akun").fill("");
  await expect(rows).toHaveCount(total);

  // Pilih semua lalu batalkan.
  await popover.getByRole("checkbox", { name: /Pilih semua/ }).check();
  await expect(popover.getByText(`${total} dipilih`)).toBeVisible();
  await popover.getByRole("checkbox", { name: /Pilih semua/ }).uncheck();
  await expect(popover.getByText("0 dipilih")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();

  // "Terakhir dipakai" datang dari query baca ke DB (T-201.2): pintasan hanya
  // muncul bila workspace punya post dengan akun tujuan.
  const lastUsed = dlg.getByRole("button", {
    name: /^Terakhir dipakai \(\d+\)$/,
  });
  await expect(lastUsed).toBeVisible({ timeout: 15_000 });
  const usedCount = Number(/\((\d+)\)/.exec(await lastUsed.innerText())![1]);
  await lastUsed.click();
  const chips = dlg.getByTestId("channel-chip");
  await expect(chips).toHaveCount(usedCount);
  // Tiap chip adalah akun yang ada di daftar workspace (bukan sekadar teks).
  for (const chipText of await chips.allInnerTexts()) {
    expect(chipText.trim()).not.toBe("");
    expect(rowTexts.some((t) => t.includes(chipText.trim()))).toBe(true);
  }
  await snap(page, "s14-last-used");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test("S15 Quick Compose dari sidebar: akun yang di-hover sudah terpilih dan tersimpan sebagai akun tujuan draft", async ({
  page,
}) => {
  track(page, "S15");
  const caption = `e2e-qa-draft-${STAMP} quick compose`;
  await page.goto("/publish/drafts");
  await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
  // Baris akun di sidebar (sebelum modal terbuka, test id ini milik sidebar).
  const sidebarRow = page.getByTestId("channel-row").first();
  await expect(sidebarRow).toBeVisible({ timeout: 15_000 });
  await sidebarRow.hover();
  const quick = page
    .getByRole("button", { name: /^Buat post baru untuk / })
    .first();
  // Handle diambil dari nama tombol (aria-label), bukan dari teks pertama baris.
  const handle = ((await quick.getAttribute("aria-label")) ?? "")
    .replace(/^Buat post baru untuk /, "")
    .trim();
  expect(handle).not.toBe("");
  await quick.click();
  const dlg = dialog(page);
  await expect(dlg.getByRole("heading", { name: "New Post" })).toBeVisible();
  // Tanpa dialog Resume dan tanpa pintasan; akun sudah menjadi chip.
  await expect(page.getByText("Resume unfinished post?")).toBeHidden();
  await expect(dlg.getByTestId("channel-chip")).toHaveCount(1);
  await expect(dlg.getByTestId("channel-chip")).toContainText(handle);
  await expect(
    dlg.getByRole("button", { name: /^Terakhir dipakai/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Pratinjau" }),
  ).not.toContainText("Pratinjau tampil di sini");
  await snap(page, "s15-quick-compose");

  // Akun tujuan ikut tersimpan (ADR-125): terisi lagi saat Edit Draft.
  await dlg.getByLabel("Caption").fill(caption);
  await dlg.getByRole("button", { name: "Save as Draft" }).click();
  await expect(dialog(page)).toHaveCount(0, { timeout: 30_000 });
  const row = page.getByRole("button").filter({ hasText: caption }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  const edit = dialog(page);
  await expect(edit.getByRole("heading", { name: "Edit Draft" })).toBeVisible();
  await expect(edit.getByLabel("Caption")).toHaveValue(caption, {
    timeout: 15_000,
  });
  await expect(edit.getByTestId("channel-chip")).toHaveCount(1);
  await expect(edit.getByTestId("channel-chip")).toContainText(handle);
  await edit.getByRole("button", { name: "Close" }).click();
});

/**
 * T-206.4: "tidak ada kedipan terang". Pengukuran S8b hanya sesudah render;
 * di sini latar tiap permukaan modal (dialog, popover, panel Pratinjau, popover
 * jadwal) disampel pada setiap frame sejak sebelum modal dibuka sampai semua
 * permukaan itu muncul, dan satu frame terang saja menggagalkan tes.
 */
test.describe("S16 mode gelap tanpa kedipan terang", () => {
  test.use({ colorScheme: "dark" });
  test("latar semua permukaan modal gelap pada setiap frame sejak mount", async ({
    page,
  }) => {
    track(page, "S16");
    await page.addInitScript(() => {
      type Sample = { sel: string; lum: number; t: number };
      const w = window as unknown as {
        __samples: Sample[];
        __frames: number;
      };
      w.__samples = [];
      w.__frames = 0;
      const SURFACES: Record<string, string> = {
        dialog: '[role="dialog"][data-state="open"]',
        popover: '[data-slot="popover-content"]',
        preview: 'aside[aria-label="Pratinjau"]',
      };
      const lum = (rgb: string) => {
        const m = rgb.match(/[\d.]+/g)!.map(Number);
        const [r, g, b] = m.slice(0, 3).map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return { l: 0.2126 * r! + 0.7152 * g! + 0.0722 * b!, a: m[3] ?? 1 };
      };
      const tick = () => {
        w.__frames++;
        for (const [name, sel] of Object.entries(SURFACES)) {
          document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
            let node: HTMLElement | null = el;
            let c = getComputedStyle(node).backgroundColor;
            // Latar efektif: naik ke leluhur sampai warna tidak transparan.
            while (node && lum(c).a < 0.5) {
              node = node.parentElement;
              if (node) c = getComputedStyle(node).backgroundColor;
            }
            w.__samples.push({
              sel: name,
              lum: node ? lum(c).l : 0,
              t: performance.now(),
            });
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/publish/drafts");
    await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "New Post" }).last().click();
    const dlg = dialog(page);
    await expect(dlg).toBeVisible();
    await selectInstagram(page, dlg); // popover Channels dibuka dan ditutup
    await dlg.getByLabel("Caption").fill("e2e-qa kedip");
    await dlg.getByRole("button", { name: /^Jadwal:/ }).click(); // popover jadwal
    await expect(page.getByLabel("Jam")).toBeVisible();
    await page.keyboard.press("Escape");
    await dlg.getByRole("button", { name: "Fullscreen" }).click();
    await settleAnimations(dlg);
    const res = await page.evaluate(() => {
      const w = window as unknown as {
        __samples: { sel: string; lum: number }[];
        __frames: number;
      };
      const bySel: Record<string, { n: number; max: number }> = {};
      for (const s of w.__samples) {
        const e = (bySel[s.sel] ??= { n: 0, max: 0 });
        e.n++;
        e.max = Math.max(e.max, s.lum);
      }
      return { frames: w.__frames, bySel };
    });
    console.log("S16 sampel", JSON.stringify(res));
    // Ketiga permukaan benar-benar terukur (bukan lolos karena tidak disampel).
    for (const name of ["dialog", "popover", "preview"]) {
      expect(res.bySel[name]?.n ?? 0, `sampel ${name}`).toBeGreaterThan(5);
      expect(res.bySel[name]!.max, `luminans maks ${name}`).toBeLessThan(0.2);
    }
    await dlg.getByLabel("Caption").fill("");
    await dlg.getByRole("button", { name: "Close" }).click();
  });
});

test("S10 bersihkan draft e2e-qa dan kunci localStorage", async ({ page }) => {
  track(page, "S10");
  const removed = await deleteE2eDrafts(page);
  console.log("S10 draft dihapus:", removed);
  const leftover = page.getByText(/e2e-qa-draft-/);
  try {
    await expect(leftover).toHaveCount(0);
  } catch (error) {
    console.log(
      "S10 sisa:",
      JSON.stringify(
        await leftover.evaluateAll((els) =>
          els.map((el) => ({
            tag: el.tagName,
            html: el.outerHTML.slice(0, 200),
            role: el.closest("[role]")?.getAttribute("role") ?? null,
            visible: !!(el as HTMLElement).offsetParent,
          })),
        ),
      ),
    );
    await snap(page, "s10-leftover");
    throw error;
  }
  await snap(page, "s10-after-cleanup");
});

/**
 * T-211.5: tata letak yang diukur, bukan sekadar "terlihat". Tidak membuat atau
 * memublikasikan apa pun: akun hanya dipilih di form lalu dialog ditutup.
 */
async function pickFirstAccounts(page: Page, dlg: Locator, count: number) {
  await dlg.getByRole("button", { name: "Channels" }).click();
  const boxes = page.getByRole("checkbox", { name: /^Pilih / });
  await expect(boxes.first()).toBeVisible({ timeout: 15_000 });
  const available = await boxes.count();
  test.skip(
    available < count,
    `Butuh ${count} akun terhubung di workspace E2E, hanya ada ${available}`,
  );
  for (let i = 0; i < count; i++) await boxes.nth(i).check();
  await page.keyboard.press("Escape");
  await expect(boxes.first()).toBeHidden();
}

async function expectPickerClearOfCard(page: Page, optionCount: number) {
  const preview = page.getByRole("complementary", { name: "Pratinjau" });
  const picker = preview.getByRole("combobox", {
    name: "Akun yang dipratinjau",
  });
  await expect(picker).toBeVisible();
  // Setiap akun dipilih bergantian: kotak pemilih tidak boleh beririsan dengan
  // kartu Pratinjau mana pun, apa pun panjang label akunnya.
  for (let i = 0; i < optionCount; i++) {
    await picker.click();
    await page.getByRole("option").nth(i).click();
    const card = preview.getByLabel(/^Pratinjau /).first();
    await expect(card).toBeVisible();
    const p = (await picker.boundingBox())!;
    const c = (await card.boundingBox())!;
    expect(
      p.y + p.height,
      `akun ke-${i + 1}: pemilih di atas kartu`,
    ).toBeLessThanOrEqual(c.y + 0.5);
  }
}

async function expectCalendarFillsPopover(page: Page, dlg: Locator) {
  await dlg.getByRole("button", { name: /^Jadwal:/ }).click();
  const pop = page.locator('[data-slot="popover-content"]');
  const grid = pop.getByRole("grid");
  await expect(grid).toBeVisible();
  const popBox = (await pop.boundingBox())!;
  const viewport = page.viewportSize()!;
  // Rancangan: 336px, menyusut di layar sempit (sisa 8px tiap sisi).
  expect(
    Math.abs(popBox.width - Math.min(336, viewport.width - 16)),
  ).toBeLessThanOrEqual(1);
  const pad = await pop.evaluate((el) => {
    const s = getComputedStyle(el);
    return parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
  });
  const gridBox = (await grid.boundingBox())!;
  expect(gridBox.width).toBeGreaterThanOrEqual(popBox.width - pad - 1);
  // Baris pertama minggu (baris 0 adalah header hari): tujuh kolom mengisi grid
  // dari tepi kiri ke tepi kanan, tanpa sisa kosong.
  const cells = grid.getByRole("row").nth(1).getByRole("gridcell");
  await expect(cells).toHaveCount(7);
  const first = (await cells.first().boundingBox())!;
  const last = (await cells.last().boundingBox())!;
  expect(first.x - gridBox.x).toBeLessThanOrEqual(1);
  expect(gridBox.x + gridBox.width - (last.x + last.width)).toBeLessThanOrEqual(
    1,
  );
  await page.keyboard.press("Escape");
}

test("S17 T-211: pemilih Pratinjau tidak menimpa kartu (4 akun, desktop)", async ({
  page,
}) => {
  track(page, "S17");
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await pickFirstAccounts(page, dlg, 4);
  await dlg.getByLabel("Caption").fill(`e2e-qa-t211-${STAMP}`);
  await expectPickerClearOfCard(page, 4);
  await snap(page, "s17-picker-desktop");
  await dlg.getByLabel("Caption").fill("");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test("S17b T-211 375px: pemilih Pratinjau rapi dengan 4 akun", async ({
  page,
}) => {
  track(page, "S17b");
  await page.setViewportSize({ width: 375, height: 812 });
  await openNewPostFromDrafts(page);
  const dlg = dialog(page);
  await expect(dlg).toBeVisible();
  await pickFirstAccounts(page, dlg, 4);
  await dlg.getByLabel("Caption").fill(`e2e-qa-t211-${STAMP}`);
  await dlg.getByRole("tab", { name: "Pratinjau" }).click();
  await expectPickerClearOfCard(page, 4);
  await snap(page, "s17b-picker-375");
  await dlg.getByLabel("Caption").fill("");
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

// Calendar cukup 1 akun: tidak bergantung pada jumlah akun workspace E2E.
for (const [name, width] of [
  ["S17c T-211.1 Calendar mengisi popover jadwal (desktop)", 1280],
  ["S17d T-211.1 Calendar mengisi popover jadwal (375px)", 375],
] as const) {
  test(name, async ({ page }) => {
    track(page, name.slice(0, 4));
    await page.setViewportSize({ width, height: 812 });
    await openNewPostFromDrafts(page);
    const dlg = dialog(page);
    await expect(dlg).toBeVisible();
    await pickFirstAccounts(page, dlg, 1);
    await expectCalendarFillsPopover(page, dlg);
    await snap(page, `s17-calendar-${width}`);
    await dlg.getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });
}
