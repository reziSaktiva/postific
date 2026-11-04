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
 * akun test) lalu menutup popover dengan "Selesai". Spesifikasi ini belum
 * dijalankan terhadap aplikasi karena tidak ada `.env.local` di worktree
 * jalur-a; jalankan di `local` sebelum dipercaya.
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
  await page.waitForTimeout(1500);
  let removed = 0;
  for (let i = 0; i < 10; i++) {
    const row = page.getByRole("button").filter({ hasText: /e2e-qa-draft-/ });
    if ((await row.count()) === 0) break;
    await row.first().getByRole("button", { name: "Hapus draft" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Hapus Draft" })
      .click();
    await page.waitForTimeout(1500);
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
  await page.waitForTimeout(2500);
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
  await page.waitForTimeout(500);
  const fsBox = await dlg.boundingBox();
  console.log("S2 fullscreen box", JSON.stringify(fsBox));
  expect.soft(Math.round(fsBox!.width)).toBe(vp.width);
  expect.soft(Math.round(fsBox!.height)).toBe(vp.height);
  await snap(page, "s2-fullscreen");
  await dlg.getByRole("button", { name: "Standard" }).click();
  await expect(dlg.getByRole("button", { name: "Fullscreen" })).toBeVisible();
  await page.waitForTimeout(500);
  const stBox = await dlg.boundingBox();
  expect(stBox!.width).toBeLessThan(vp.width - 10);
  // persist check: ke Fullscreen, tutup, buka ulang
  await dlg.getByRole("button", { name: "Fullscreen" }).click();
  await page.waitForTimeout(300);
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
  await dlg.getByRole("button", { name: "Channels" }).click();
  const acct = page.getByRole("checkbox", { name: /Pilih Instagram/ });
  await expect(acct).toBeVisible({ timeout: 15_000 });
  await acct.check();
  await page.keyboard.press("Escape");
  await expect(acct).toBeHidden();
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
  await page.waitForTimeout(1500);
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
    await page.waitForTimeout(1200);
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
    await page.waitForTimeout(400);
    await snap(page, "s8b-dark-fullscreen");
    await dlg.getByRole("button", { name: "Close" }).click();
    // dialog Resume dalam gelap
    await page.getByRole("button", { name: "New Post" }).last().click();
    await dialog(page).getByLabel("Caption").fill("e2e-qa gelap resume");
    await dialog(page).getByRole("button", { name: "Close" }).click();
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

test("S10 bersihkan draft e2e-qa dan kunci localStorage", async ({ page }) => {
  track(page, "S10");
  const removed = await deleteE2eDrafts(page);
  console.log("S10 draft dihapus:", removed);
  await expect(page.getByText(/e2e-qa-draft-/)).toHaveCount(0);
  await snap(page, "s10-after-cleanup");
});
