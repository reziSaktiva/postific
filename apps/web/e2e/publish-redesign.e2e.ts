import { expect, test, type Page } from "@playwright/test";

import { seedDbSkipReason } from "./support/seed-db";
import {
  cleanupPublishFixtures,
  listQueuedCaptions,
  readPostStatus,
  seedPublishFixtures,
  type PublishSeed,
} from "./support/seed-publish-db";

/**
 * S-008 Publish golden path (T-294 item 1, ADR-149, ADR-165): old routes,
 * the view switcher, the post preview with an inline video, Mark Ready in
 * Approvals, "Ajukan Review" from the Draft Editor (T-296), and the empty
 * Queue with best-time suggestions (T-291).
 *
 * Data is seeded straight into the E2E Sandbox workspace
 * (`support/seed-publish-db.ts`) and removed in `afterAll`. The test never
 * schedules or publishes; the only write through the UI is a new caption-only
 * post moved to In Review, and the In Review -> Ready to Schedule transition.
 */
const skip = seedDbSkipReason();
test.skip(skip !== null, skip ?? "");

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let seed: PublishSeed;

test.beforeAll(async () => {
  await cleanupPublishFixtures(); // leftovers of an interrupted run
  seed = await seedPublishFixtures();
});

test.afterAll(async () => {
  const removed = await cleanupPublishFixtures({ stamp: seed?.stamp });
  console.log("s008 seed removed:", JSON.stringify(removed));
});

function draftEditor(page: Page) {
  return page.getByRole("dialog").filter({ hasText: /Edit Draft|New Post/ });
}

function search(page: Page) {
  return new URL(page.url()).searchParams;
}

test("old routes land on the matching view of /publish", async ({ page }) => {
  const cases: [string, Record<string, string>][] = [
    ["/publish/calendar", { view: "calendar" }],
    ["/publish/calendar?view=week", { view: "calendar", range: "week" }],
    ["/publish/queue", { view: "list", tab: "queue" }],
    ["/publish/drafts", { view: "list", tab: "drafts" }],
    ["/publish/history", { view: "list", tab: "history" }],
  ];
  for (const [from, expected] of cases) {
    await page.goto(from);
    await expect(page).toHaveURL(/\/publish\?/);
    const params = search(page);
    for (const [key, value] of Object.entries(expected)) {
      expect(params.get(key), `${from} -> ${key}`).toBe(value);
    }
  }

  test.skip(!seed.videoPostId, "Supabase Storage is not configured");
  await page.goto(`/publish/history/${seed.videoPostId}`);
  await expect(page).toHaveURL(/\/publish\?/);
  expect(search(page).get("view")).toBe("list");
  expect(search(page).get("tab")).toBe("history");
  expect(search(page).get("post")).toBe(seed.videoPostId);
  await expect(page.getByRole("dialog")).toContainText(seed.captions.video, {
    timeout: 30_000,
  });
});

test("the view switcher moves between Calendar, List and Board", async ({
  page,
}) => {
  await page.goto("/publish?view=calendar");
  const switcher = page.getByRole("radiogroup", { name: "Tampilan" });
  await expect(switcher).toBeVisible({ timeout: 30_000 });

  await switcher.getByRole("radio", { name: "List" }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(
    page.getByRole("tablist", { name: "Daftar" }).getByText("Queue"),
  ).toBeVisible();

  await switcher.getByRole("radio", { name: "Board" }).click();
  await expect(page).toHaveURL(/view=board/);
  for (const column of ["Draft", "Approvals", "Scheduled", "Published"]) {
    await expect(page.getByRole("region", { name: column })).toBeVisible();
  }
  await expect(
    page
      .getByRole("region", { name: "Approvals" })
      .getByText(seed.captions.inReview),
  ).toBeVisible();

  await switcher.getByRole("radio", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/view=calendar/);

  // `/publish` without a view reopens the last used one (cookie).
  await switcher.getByRole("radio", { name: "Board" }).click();
  await expect(page).toHaveURL(/view=board/);
  await page.goto("/publish");
  await expect(page.getByRole("region", { name: "Approvals" })).toBeVisible({
    timeout: 30_000,
  });
});

test("post preview from a Calendar chip: popover, expand, video plays", async ({
  page,
}) => {
  test.skip(!seed.videoPostId, "Supabase Storage is not configured");
  await page.goto("/publish?view=calendar&range=month");
  const chip = page
    .getByRole("button", { name: new RegExp(seed.captions.video) })
    .first();
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await chip.click();

  const popover = page.getByRole("dialog", { name: "Pratinjau posting" });
  await expect(popover).toContainText(seed.captions.video, {
    timeout: 30_000,
  });
  await expect(popover).toContainText(seed.accountHandle);
  // Caption with a small poster first; the video plays in place when pressed.
  await popover.getByRole("button", { name: "Putar video" }).click();
  await expect(popover.locator("video[controls]")).toHaveCount(1);
  await expect(
    popover.getByRole("link", { name: /Go to post/ }),
  ).toHaveAttribute("href", new RegExp(seed.stamp));

  await popover.getByRole("button", { name: "Perbesar" }).click();
  await expect(popover).toHaveCount(0);
  const expanded = page.getByRole("dialog");
  await expect(expanded).toContainText(seed.captions.video, {
    timeout: 30_000,
  });

  const video = expanded.locator("video");
  await expect(video).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/sign\/media\//,
  );
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState), {
      timeout: 20_000,
    })
    .toBeGreaterThanOrEqual(1);
  await video.click();
  await video.evaluate((el: HTMLVideoElement) =>
    el.play().catch(() => undefined),
  );
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
});

test("Mark Ready in Approvals moves the post to Ready to Schedule", async ({
  page,
}) => {
  await page.goto("/publish?view=list&tab=approvals");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: seed.captions.inReview })
    .first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: "Tandai Ready" }).click();
  await expect(page.getByText("Ditandai Ready to Schedule")).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(() => readPostStatus(seed.inReviewPostId), { timeout: 20_000 })
    .toBe("ready_to_schedule");

  await page.reload();
  await expect(
    page.getByRole("tablist", { name: "Daftar" }).getByText("Approvals"),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(seed.captions.inReview)).toHaveCount(0);

  // It now sits in Drafts with its new status.
  await page.goto("/publish?view=list&tab=drafts");
  await expect(
    page
      .locator('[data-slot="card"]')
      .filter({ hasText: seed.captions.inReview })
      .first(),
  ).toContainText("Ready to Schedule", { timeout: 30_000 });
});

test("Ajukan Review from the Draft Editor lands on Approvals", async ({
  page,
}) => {
  await page.goto("/publish?view=list&tab=drafts");
  await page.getByRole("button", { name: "New Post" }).first().click();
  const dlg = draftEditor(page);
  await expect(dlg).toBeVisible({ timeout: 30_000 });
  await dlg.getByLabel("Caption").fill(seed.captions.submitted);
  const submit = dlg.getByRole("button", { name: "Ajukan Review" });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();

  await expect(draftEditor(page)).toHaveCount(0, { timeout: 30_000 });
  // Starts on List · Drafts, so wait for the tab to change.
  await expect(page).toHaveURL(/view=list&tab=approvals/, { timeout: 30_000 });
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: seed.captions.submitted })
    .first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("In Review");
});

test("empty Queue shows best-time suggestions per account", async ({
  page,
}) => {
  // Suggestions only show on an empty Queue. Scheduled posts of another run
  // are never removed here (they may be scheduled at Outstand).
  const queued = await listQueuedCaptions();
  test.skip(
    queued.length > 0,
    `Queue of the E2E workspace is not empty: ${queued.join("; ")}`,
  );
  await page.goto("/publish?view=list&tab=queue");
  await expect(page.getByText("Antrean kosong")).toBeVisible({
    timeout: 30_000,
  });
  const section = page.getByRole("region", {
    name: `Saran waktu ${seed.accountHandle}`,
  });
  await expect(section).toBeVisible();
  const slots = section.getByRole("button", { name: "New" });
  await expect(slots).toHaveCount(3);

  // 4 buckets were seeded: "show more" reveals the fourth.
  await page
    .getByRole("button", { name: "Tampilkan lebih banyak waktu" })
    .click();
  await expect(slots).toHaveCount(4);

  // "+ New" opens the Draft Editor with that account; nothing is created.
  await slots.first().click();
  const dlg = draftEditor(page);
  await expect(dlg).toBeVisible({ timeout: 30_000 });
  await expect(dlg).toContainText(seed.accountHandle, { timeout: 15_000 });
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(draftEditor(page)).toHaveCount(0);
});
