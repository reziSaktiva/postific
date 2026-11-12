import { expect, test } from "@playwright/test";

import { seedDbSkipReason } from "./support/seed-db";
import {
  attachStoredThumbnailToP1,
  cleanupEngageFixtures,
  findEngageP1PostId,
  seedEngageFixtures,
  type EngageSeed,
} from "./support/seed-engage-db";

/**
 * History Detail: thumbnail tersimpan posting impor tidak boleh menyusut di
 * layar sempit (T-232.4, ADR-149, ADR-158). Menjaga `*:shrink-0` pada kolom
 * scroll modal di `HistoryDetail.tsx`: tanpanya wrapper media
 * (`overflow-hidden`) menyusut jadi strip ~62px di 375px (ditemukan di
 * staging, PR 271).
 *
 * Data disemai di workspace E2E Sandbox lewat `support/seed-engage-db.ts`
 * (posting `published` tanpa `outstand_post_id`, thumbnail webp persegi 96x96
 * sungguhan di Storage) dan dihapus di `afterEach`. Tes hanya membaca.
 */
const skip = seedDbSkipReason();
test.skip(skip !== null, skip ?? "");

test.setTimeout(120_000);

let seed: EngageSeed;

test.beforeAll(async () => {
  await cleanupEngageFixtures();
});

test.beforeEach(async () => {
  seed = await seedEngageFixtures();
});

test.afterEach(async () => {
  await cleanupEngageFixtures({ stamp: seed?.stamp });
});

test("T-232.4: thumbnail posting impor di History Detail tidak menyusut di 375px", async ({
  page,
}) => {
  const attached = await attachStoredThumbnailToP1(seed);
  test.skip(!attached, "Supabase Storage tidak tersedia di lingkungan tes");
  const postId = await findEngageP1PostId(seed);
  expect(postId, "posting semai P1 harus ada").not.toBeNull();

  // Tinggi pendek: modal (`max-h-82vh`) meluap sehingga kolom scroll memaksa
  // anak menyusut bila `shrink-0` hilang (di 812px isi muat dan bug tak muncul).
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto(`/publish/history/${postId}`);

  const dialog = page.getByRole("dialog");
  const img = dialog.getByRole("img", { name: "Media post asal" });
  await expect(img).toBeVisible({ timeout: 60_000 });
  await expect(img).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/sign\/media\/.*\/imports\//,
  );
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  // Wrapper media = induk langsung gambar. Thumbnail persegi dan lebar penuh
  // (`fit="natural"`): tingginya harus mendekati lebarnya, bukan strip.
  const wrapper = img.locator(
    "xpath=ancestor::div[contains(@class,'overflow-hidden')][1]",
  );
  const box = await wrapper.boundingBox();
  expect(box, "wrapper media harus terukur").not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(box!.width * 0.9);

  // Gambar tidak terpotong oleh wrapper.
  const imgBox = await img.boundingBox();
  expect(imgBox!.height).toBeGreaterThanOrEqual(box!.height - 2);
});
