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

test("T-300: on a phone the Board scrolls sideways over a column with cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/publish?view=board");
  const published = page.getByRole("region", { name: "Published" });
  await expect(published).toBeVisible({ timeout: 30_000 });
  // The seed has published posts, so this column has its own card list; the
  // gestures start on its first card, where a finger lands.
  const card = published.getByRole("button").first();
  await expect(card).toBeVisible();
  const row = published.locator("..");
  const scrollLeft = () => row.evaluate((el) => el.scrollLeft);

  await published.scrollIntoViewIfNeeded();
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  const start = await scrollLeft();

  // Touch swipe (what King Rezi hit on a phone), through Chrome's gesture
  // synthesizer so overscroll chaining runs as it does for a finger.
  const cdp = await page.context().newCDPSession(page);
  // A phone has a touchscreen. The "Desktop Chrome" device has none, and
  // Chrome on the Linux CI runner then drops synthetic touch gestures (the
  // swipe never moved the row there; macOS ran it anyway; T-308).
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  const swipe = async (xDistance: number) => {
    const box = await card.boundingBox();
    if (!box) throw new Error("Published card has no box");
    await cdp.send("Input.synthesizeScrollGesture", {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
      xDistance,
      yDistance: 0,
      gestureSourceType: "touch",
      speed: 1200,
    });
  };
  // TEMPORARY T-308 diagnostics: why the touch swipe does not move the row
  // on the Linux CI runner. Logs only; removed once the cause is known.
  {
    const box = await card.boundingBox();
    const cx = Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2);
    const cy = Math.round((box?.y ?? 0) + (box?.height ?? 0) / 2);
    const facts = await row.evaluate(
      (el, [x, y]) => {
        const hit = document.elementFromPoint(x, y);
        let list: Element | null = hit;
        while (list && list !== el) {
          const style = getComputedStyle(list);
          if (/(auto|scroll)/.test(style.overflowY + style.overflowX)) break;
          list = list.parentElement;
        }
        const metrics = (node: Element | null) => {
          if (!(node instanceof HTMLElement)) return null;
          const style = getComputedStyle(node);
          return {
            cls: node.className.slice(0, 120),
            sl: node.scrollLeft,
            sw: node.scrollWidth,
            cw: node.clientWidth,
            ow: node.offsetWidth,
            sh: node.scrollHeight,
            ch: node.clientHeight,
            ox: style.overflowX,
            oy: style.overflowY,
            osx: style.overscrollBehaviorX,
            snap: style.scrollSnapType,
            ta: style.touchAction,
          };
        };
        return {
          ua: navigator.userAgent,
          dpr: devicePixelRatio,
          vw: innerWidth,
          coarse: matchMedia("(pointer: coarse)").matches,
          touchPoints: navigator.maxTouchPoints,
          hit: hit
            ? `${hit.tagName}.${String(hit.className).slice(0, 60)}`
            : null,
          row: metrics(el),
          list: list === el ? "row" : metrics(list),
        };
      },
      [cx, cy] as const,
    );
    console.log("[T-300 diag] facts", JSON.stringify({ cx, cy, start, facts }));
    const trace = async (label: string) => {
      const seen: number[] = [];
      for (const wait of [0, 200, 600, 1200]) {
        await page.waitForTimeout(wait === 0 ? 0 : 200 + wait / 3);
        seen.push(await scrollLeft());
      }
      console.log(`[T-300 diag] ${label}`, JSON.stringify(seen));
      await row.evaluate((el, left) => {
        el.scrollLeft = left;
      }, start);
      await page.waitForTimeout(500);
    };
    await cdp.send("Input.synthesizeScrollGesture", {
      x: cx,
      y: cy,
      xDistance: 250,
      yDistance: 0,
      gestureSourceType: "touch",
      speed: 1200,
    });
    await trace("synth touch 250");
    await cdp.send("Input.synthesizeScrollGesture", {
      x: cx,
      y: cy,
      xDistance: 330,
      yDistance: 0,
      gestureSourceType: "touch",
      speed: 800,
    });
    await trace("synth touch 330 slow");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: cy }],
    });
    for (let step = 1; step <= 10; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx + step * 30, y: cy }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await trace("dispatch touch drag 300");
    await cdp.send("Input.synthesizeScrollGesture", {
      x: cx,
      y: cy,
      xDistance: 250,
      yDistance: 0,
      gestureSourceType: "mouse",
      speed: 1200,
    });
    await trace("synth mouse 250");
  }

  // A positive xDistance moves the finger right, which scrolls left.
  await swipe(250);
  await expect.poll(scrollLeft).toBeLessThan(start);

  await published.scrollIntoViewIfNeeded();
  await expect.poll(scrollLeft).toBe(start);
  await swipe(-250);
  await expect.poll(scrollLeft).toBeGreaterThan(start);

  // Mouse wheel and trackpad take the same path.
  await published.scrollIntoViewIfNeeded();
  await card.hover();
  await page.mouse.wheel(-600, 0);
  await expect.poll(scrollLeft).toBeLessThan(start);
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
