import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedDbSkipReason } from "./support/seed-db";
import {
  attachStoredThumbnailToP1,
  cleanupEngageFixtures,
  seedEngageFixtures,
  type EngageSeed,
} from "./support/seed-engage-db";

/**
 * Golden path Engage per posting (T-222.1, T-222.2, ADR-149, ADR-157, S-006):
 * daftar posting dan komentar terpilih, Resolve / Dismiss / Buka kembali
 * (dan persistensinya), filter Status / Akun / Platform, Sort, Date Range,
 * Reset, tampilan By post / List, Reply (komposer saja), post asal (T-056),
 * dan Refresh manual.
 *
 * Data disemai langsung di DB workspace E2E Sandbox (`support/seed-engage-db.ts`,
 * konvensi `e2e-data.ts`) dan dihapus di `afterEach`. Tes TIDAK PERNAH menekan
 * "Kirim" pada komposer balasan: balasan memanggil Outstand dari server
 * (Server Action), tidak bisa dicegat route mocking Playwright, jadi
 * pengiriman balasan sungguhan tidak tercakup di sini (lihat laporan T-222).
 * Posting disemai tanpa `outstand_post_id`, jadi Refresh tidak mengambil
 * komentar milik posting semai dari Outstand.
 */
const skip = seedDbSkipReason();
test.skip(skip !== null, skip ?? "");

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let seed: EngageSeed;

test.beforeAll(async () => {
  await cleanupEngageFixtures(); // sisa run lama yang terhenti (bukan run lain)
});

test.beforeEach(async () => {
  seed = await seedEngageFixtures();
});

test.afterEach(async () => {
  const removed = await cleanupEngageFixtures({ stamp: seed?.stamp });
  console.log("seed Engage dihapus:", JSON.stringify(removed));
});

type CommentKey = keyof EngageSeed["comments"];

/** Kartu posting di panel kiri, dicari lewat caption semai. */
function card(page: Page, caption: string): Locator {
  // Hanya kartu daftar (punya progress bar), bukan kartu pratinjau post asal.
  return page
    .locator("[data-slot=card]")
    .filter({ has: page.getByRole("progressbar") })
    .filter({ hasText: caption });
}

/** Satu baris komentar (By post maupun List), dicari lewat handle penulis. */
function row(page: Page, key: CommentKey): Locator {
  return page
    .locator("[data-status]")
    .filter({ hasText: seed.comments[key].handle });
}

async function openEngage(page: Page) {
  await page.goto("/engage");
  await expect(card(page, seed.captions.p1)).toBeVisible({ timeout: 60_000 });
}

async function selectPost(page: Page, caption: string) {
  await card(page, caption).getByRole("button").click();
  await expect(card(page, caption).getByRole("button")).toHaveAttribute(
    "aria-current",
    "true",
  );
}

/** Aksi hover pada satu komentar: Reply, Resolve, Dismiss, atau Buka kembali. */
async function commentAction(page: Page, key: CommentKey, label: string) {
  const { handle, content } = seed.comments[key];
  await page.getByText(content, { exact: true }).hover();
  await page
    .getByRole("group", { name: `Aksi untuk komentar ${handle}` })
    .getByRole("button", { name: label, exact: true })
    .click();
}

/** Handle komentar semai yang tampil, urut dari atas ke bawah. */
async function visibleCommentOrder(page: Page): Promise<string[]> {
  const labels = await page
    .locator(
      `[role=group][aria-label^="Aksi untuk komentar @e2e-eng-${seed.stamp}-"]`,
    )
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  return labels.map((l) => l.replace(/^.*-(c\d)$/, "$1"));
}

function filterPanelButton(page: Page) {
  return page.getByRole("button", { name: /^Filter dan urutan/ });
}

async function openFilterPanel(page: Page) {
  await filterPanelButton(page).click();
  await expect(page.getByText("Sort By")).toBeVisible();
}

async function chooseSort(page: Page, label: string) {
  await openFilterPanel(page);
  await page.getByRole("radio", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
}

async function chooseDateRange(page: Page, label: string) {
  await openFilterPanel(page);
  await page.getByRole("radio", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
}

async function chooseStatus(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Filter status komentar" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("daftar posting, komentar posting terpilih, dan post asal", async ({
  page,
}) => {
  await openEngage(page);

  // Kartu: posting semai dengan hitungan belum dibalas, dan kelompok tanpa posting.
  await expect(card(page, seed.captions.p2)).toBeVisible();
  await expect(card(page, seed.captions.p3)).toBeVisible();
  await expect(
    card(page, seed.captions.p1).getByLabel("2 belum dibalas"),
  ).toBeVisible();
  await expect(
    card(page, seed.captions.p3).getByLabel("1 belum dibalas"),
  ).toBeVisible();
  await expect(
    card(page, "Komentar yang tidak terhubung ke posting di Postific"),
  ).toBeVisible();

  // Pilih posting satu: ringkasan, urutan bawaan (belum dibalas dulu), post asal.
  await selectPost(page, seed.captions.p1);
  await expect(page.getByText("1 dibalas", { exact: true })).toBeVisible();
  await expect(page.getByText("/ 3 total komentar")).toBeVisible();
  await expect(row(page, "c1")).toBeVisible();
  await expect
    .poll(() => visibleCommentOrder(page))
    .toEqual(["c1", "c2", "c3"]);
  await expect(
    page.getByRole("link", { name: "Buka posting" }),
  ).toHaveAttribute("href", seed.p1Url);

  // Pilih posting dua: hanya komentarnya sendiri.
  await selectPost(page, seed.captions.p2);
  await expect(row(page, "c4")).toBeVisible();
  await expect(row(page, "c1")).toHaveCount(0);
});

test("Resolve, Dismiss, dan Buka kembali tersimpan di server", async ({
  page,
}) => {
  await openEngage(page);
  await selectPost(page, seed.captions.p1);
  const p1 = card(page, seed.captions.p1);

  await commentAction(page, "c1", "Resolve");
  await expect(
    page.getByText("Komentar ditandai Selesai").first(),
  ).toBeVisible();
  await expect(
    row(page, "c1").getByText("Selesai", { exact: true }),
  ).toBeVisible();
  await expect(p1.getByLabel("1 belum dibalas")).toBeVisible();

  await commentAction(page, "c2", "Dismiss");
  await expect(page.getByText("Komentar diabaikan").first()).toBeVisible();
  await expect(
    row(page, "c2").getByText("Diabaikan", { exact: true }),
  ).toBeVisible();
  await expect(p1.getByLabel("Semua komentar sudah ditangani")).toBeVisible();

  // Persisten: muat ulang halaman, status tetap dari server.
  await page.reload();
  await expect(p1).toBeVisible({ timeout: 60_000 });
  await selectPost(page, seed.captions.p1);
  await expect(
    row(page, "c1").getByText("Selesai", { exact: true }),
  ).toBeVisible();
  await expect(
    row(page, "c2").getByText("Diabaikan", { exact: true }),
  ).toBeVisible();
  await expect(
    row(page, "c3").getByText("Dibalas", { exact: true }),
  ).toBeVisible();

  // Buka kembali: kembali Belum dibalas dan dihitung lagi di kartu.
  await commentAction(page, "c1", "Buka kembali");
  await expect(page.getByText("Komentar dibuka kembali").first()).toBeVisible();
  await expect(
    row(page, "c1").getByText("Belum dibalas", { exact: true }),
  ).toBeVisible();
  await expect(p1.getByLabel("1 belum dibalas")).toBeVisible();

  await page.reload();
  await expect(p1).toBeVisible({ timeout: 60_000 });
  await selectPost(page, seed.captions.p1);
  await expect(
    row(page, "c1").getByText("Belum dibalas", { exact: true }),
  ).toBeVisible();
  await expect(
    row(page, "c2").getByText("Diabaikan", { exact: true }),
  ).toBeVisible();
});

test("Reply membuka komposer tanpa mengirim, dan nonaktif untuk komentar tanpa posting", async ({
  page,
}) => {
  await openEngage(page);
  await selectPost(page, seed.captions.p1);

  await commentAction(page, "c1", "Reply");
  await expect(page.getByText("Membalas")).toBeVisible();
  const draft = page.getByRole("textbox", { name: "Balasan" });
  const send = page.getByRole("button", { name: "Kirim", exact: true });
  await expect(draft).toBeEnabled();
  await expect(send).toBeDisabled();
  await draft.fill("e2e draf balasan, tidak dikirim");
  await expect(send).toBeEnabled(); // TIDAK diklik: balasan ke Outstand.
  await page.getByRole("button", { name: "Batalkan balasan" }).click();
  await expect(
    page.getByText("Pilih Reply pada sebuah komentar untuk membalas."),
  ).toBeVisible();

  // Kelompok tanpa posting: Reply nonaktif, Resolve tetap ada.
  await card(page, "Komentar yang tidak terhubung ke posting di Postific")
    .getByRole("button")
    .click();
  await expect(row(page, "c6")).toBeVisible();
  await expect(page.getByText("Komentar tanpa posting")).toBeVisible();
  const actions = page.getByRole("group", {
    name: `Aksi untuk komentar ${seed.comments.c6.handle}`,
  });
  await expect(
    actions.getByRole("button", { name: "Reply", exact: true }),
  ).toBeDisabled();
  await expect(
    actions.getByRole("button", { name: "Resolve", exact: true }),
  ).toBeEnabled();
});

test("filter Status menyaring komentar posting terpilih", async ({ page }) => {
  await openEngage(page);
  await selectPost(page, seed.captions.p1);
  await commentAction(page, "c1", "Resolve");
  await expect(
    row(page, "c1").getByText("Selesai", { exact: true }),
  ).toBeVisible();

  await chooseStatus(page, "Selesai");
  await expect(row(page, "c1")).toBeVisible();
  await expect(row(page, "c2")).toHaveCount(0);
  await expect(row(page, "c3")).toHaveCount(0);

  await chooseStatus(page, "Dibalas");
  await expect(row(page, "c3")).toBeVisible();
  await expect(row(page, "c1")).toHaveCount(0);

  await chooseStatus(page, "Semua");
  await expect(row(page, "c1")).toBeVisible();
  await expect(row(page, "c2")).toBeVisible();
  await expect(row(page, "c3")).toBeVisible();
});

test("Sort mengubah urutan komentar", async ({ page }) => {
  await openEngage(page);
  await selectPost(page, seed.captions.p1);
  await expect
    .poll(() => visibleCommentOrder(page))
    .toEqual(["c1", "c2", "c3"]);

  await chooseSort(page, "Terbaru");
  await expect
    .poll(() => visibleCommentOrder(page))
    .toEqual(["c3", "c1", "c2"]);
  await expect(filterPanelButton(page)).toHaveAccessibleName(
    "Filter dan urutan (1 aktif)",
  );

  await chooseSort(page, "Terlama");
  await expect
    .poll(() => visibleCommentOrder(page))
    .toEqual(["c2", "c1", "c3"]);

  await chooseSort(page, "Belum dibalas dulu");
  await expect
    .poll(() => visibleCommentOrder(page))
    .toEqual(["c1", "c2", "c3"]);
  await expect(filterPanelButton(page)).toHaveAccessibleName(
    "Filter dan urutan",
  );
});

test("Date Range menyaring posting menurut waktu komentar", async ({
  page,
}) => {
  await openEngage(page);
  await expect(card(page, seed.captions.p2)).toBeVisible(); // komentar 20 hari lalu

  await chooseDateRange(page, "7 hari terakhir");
  await expect(card(page, seed.captions.p2)).toHaveCount(0);
  await expect(card(page, seed.captions.p1)).toBeVisible();
  await expect(card(page, seed.captions.p3)).toBeVisible();

  await chooseDateRange(page, "30 hari terakhir");
  await expect(card(page, seed.captions.p2)).toBeVisible();
});

test("Reset mengembalikan Sort, Date Range, dan Platform ke bawaan", async ({
  page,
}) => {
  await openEngage(page);

  await openFilterPanel(page);
  await page.getByRole("radio", { name: "Terlama", exact: true }).click();
  await page
    .getByRole("radio", { name: "7 hari terakhir", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Platform", exact: true }).click();
  await page.getByRole("option", { name: "Facebook", exact: true }).click();

  await expect(card(page, seed.captions.p1)).toHaveCount(0);
  await expect(card(page, seed.captions.p3)).toBeVisible();
  await expect(filterPanelButton(page)).toHaveAccessibleName(
    "Filter dan urutan (3 aktif)",
  );

  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(card(page, seed.captions.p1)).toBeVisible();
  await expect(card(page, seed.captions.p2)).toBeVisible();
  await expect(card(page, seed.captions.p3)).toBeVisible();
  await expect(filterPanelButton(page)).toHaveAccessibleName(
    "Filter dan urutan",
  );
});

test("regresi: filter Akun dan Platform", async ({ page }) => {
  await openEngage(page);
  const accountSelect = page.getByRole("combobox", {
    name: "Filter akun atau channel",
  });

  await accountSelect.click();
  await page
    .getByRole("option", { name: seed.accounts.facebook, exact: true })
    .click();
  await expect(card(page, seed.captions.p1)).toHaveCount(0);
  await expect(card(page, seed.captions.p3)).toBeVisible();

  await accountSelect.click();
  await page
    .getByRole("option", { name: seed.accounts.instagram, exact: true })
    .click();
  await expect(card(page, seed.captions.p3)).toHaveCount(0);
  await expect(card(page, seed.captions.p1)).toBeVisible();
  await expect(card(page, seed.captions.p2)).toBeVisible();

  await accountSelect.click();
  await page.getByRole("option", { name: "Semua akun", exact: true }).click();
  await expect(card(page, seed.captions.p3)).toBeVisible();

  await openFilterPanel(page);
  await page.getByRole("combobox", { name: "Platform", exact: true }).click();
  await page.getByRole("option", { name: "Facebook", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(card(page, seed.captions.p1)).toHaveCount(0);
  await expect(card(page, seed.captions.p3)).toBeVisible();
});

test("pindah By post / List, aksi di List, dan buka posting dari List", async ({
  page,
}) => {
  await openEngage(page);
  const byPost = page.getByRole("radio", { name: "By post", exact: true });
  const list = page.getByRole("radio", { name: "List", exact: true });
  await expect(byPost).toBeChecked();

  await list.click();
  await expect(list).toBeChecked();
  // List: komentar lintas posting dengan baris konteks.
  for (const key of ["c1", "c2", "c3", "c4", "c5", "c6"] as const) {
    await expect(row(page, key)).toBeVisible({ timeout: 30_000 });
  }
  await expect(
    row(page, "c5").getByText(`Pada posting: ${seed.captions.p3}`),
  ).toBeVisible();
  await expect(
    row(page, "c6").getByRole("button", { name: "Tanpa posting" }),
  ).toBeVisible();

  // Aksi status di List.
  await commentAction(page, "c5", "Resolve");
  await expect(
    row(page, "c5").getByText("Selesai", { exact: true }),
  ).toBeVisible();

  // Reply inline di List: komposer saja (tidak dikirim); nonaktif tanpa posting.
  await commentAction(page, "c1", "Reply");
  await expect(page.getByText("Membalas")).toBeVisible();
  await page.getByRole("button", { name: "Batalkan balasan" }).click();
  await expect(
    page
      .getByRole("group", {
        name: `Aksi untuk komentar ${seed.comments.c6.handle}`,
      })
      .getByRole("button", { name: "Reply", exact: true }),
  ).toBeDisabled();

  // Filter Status berlaku di List.
  await chooseStatus(page, "Selesai");
  await expect(row(page, "c5")).toBeVisible();
  await expect(row(page, "c1")).toHaveCount(0);
  await chooseStatus(page, "Semua");
  await expect(row(page, "c1")).toBeVisible();

  // Buka posting dari baris List: pindah ke By post dengan posting itu terpilih.
  await row(page, "c5")
    .getByRole("button", { name: `Pada posting: ${seed.captions.p3}` })
    .click();
  await expect(byPost).toBeChecked();
  await expect(
    card(page, seed.captions.p3).getByRole("button"),
  ).toHaveAttribute("aria-current", "true");
  await expect(row(page, "c5")).toBeVisible();
  await expect(row(page, "c1")).toHaveCount(0);
});

test("regresi: Refresh manual tidak gagal dan data semai tetap ada", async ({
  page,
}) => {
  await openEngage(page);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText(/komentar baru|Tidak ada komentar baru/).first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText("Komentar terbaru belum dapat diambil"),
  ).toHaveCount(0);
  await expect(card(page, seed.captions.p1)).toBeVisible();
  await selectPost(page, seed.captions.p1);
  await expect(row(page, "c1")).toBeVisible();
});

/** PNG 1x1 transparan untuk gambar eksternal semai (tanpa jaringan sungguhan). */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("T-227: thumbnail dari media eksternal; gagal muat jatuh ke ikon", async ({
  page,
}) => {
  await page.route(seed.externalMedia.p2, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL_PNG }),
  );
  await page.route(seed.externalMedia.p3, (route) => route.abort());

  await openEngage(page);

  // P2 (media_ids kosong, URL eksternal valid): gambar eksternal tampil.
  await expect(
    card(page, seed.captions.p2).locator(`img[src="${seed.externalMedia.p2}"]`),
  ).toHaveCount(1);

  // P3 (URL eksternal gagal dimuat): gambar dibuang, ikon pengganti tampil.
  const p3 = card(page, seed.captions.p3);
  await expect(p3.locator("img")).toHaveCount(0);
  await expect(p3.locator("[aria-hidden=true] svg").first()).toBeVisible();

  // P1 (tanpa media sama sekali): tetap tanpa thumbnail, sesuai rancangan.
  await expect(card(page, seed.captions.p1).locator("img")).toHaveCount(0);

  // Layar sempit: kartu tetap terbaca, tanpa luapan horizontal.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(card(page, seed.captions.p2)).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("T-230: thumbnail tersimpan (signed URL Storage) tampil, mengalahkan URL eksternal", async ({
  page,
}) => {
  const attached = await attachStoredThumbnailToP1(seed);
  test.skip(!attached, "Supabase Storage tidak tersedia di lingkungan tes");
  await openEngage(page);

  // P1 punya thumbnail_storage_path (webp sungguhan di bucket `media`).
  const img = card(page, seed.captions.p1).locator("img");
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/sign\/media\/.*\/imports\//,
  );
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
});
