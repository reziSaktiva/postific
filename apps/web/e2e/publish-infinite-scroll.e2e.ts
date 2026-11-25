import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  MULTI_ACCOUNT_WORKSPACE_NAME,
  switchToWorkspaceNamed,
} from "./support/workspace";

/**
 * S-009 Publish infinite scroll (T-302, ADR-166, ADR-149) on the large real
 * workspace "Cook It Real Good" (King Rezi, 2026-11-25). Read only: the test
 * scrolls and filters, never saves, schedules or publishes; switching the
 * workspace changes only this test context's cookie.
 *
 * A section with 20 items or fewer there cannot show a second page: that
 * test is skipped with the reason, recorded as not yet proven, never faked.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.use({ viewport: { width: 1440, height: 900 } });

const PAGE_SIZE = 20;

async function apiTotal(page: Page, search: string): Promise<number> {
  const response = await page.request.get(`/api/publish/list${search}`);
  expect(response.ok(), `count ${search}`).toBe(true);
  return ((await response.json()) as { total: number }).total;
}

async function tabCount(page: Page, tab: string): Promise<number> {
  const count = page.getByTestId(`publish-tab-count-${tab}`);
  await expect(count).toBeVisible();
  return Number(await count.textContent());
}

/** Scrolls the list footer into view until more rows than `loaded` show. */
async function loadNextPage(page: Page, rows: Locator, loaded: number) {
  await page
    .locator('[data-slot="infinite-list-footer"]')
    .last()
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() => rows.count(), { timeout: 30_000 })
    .toBeGreaterThan(loaded);
}

test.beforeEach(async ({ page }) => {
  await switchToWorkspaceNamed(page, MULTI_ACCOUNT_WORKSPACE_NAME);
});

test("History loads the next page on scroll and its count is the true total", async ({
  page,
}) => {
  await page.goto("/publish?view=list&tab=history");
  const rows = page.getByTestId("publish-list-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });

  const total = await apiTotal(page, "?tab=history&count=1");
  expect(await tabCount(page, "history")).toBe(total);
  test.skip(
    total <= PAGE_SIZE,
    `History has ${total} posts here; a second page is not yet proven`,
  );

  // First page only, then the second page on scroll.
  await expect(rows).toHaveCount(PAGE_SIZE);
  await loadNextPage(page, rows, PAGE_SIZE);
  expect(await rows.count()).toBeLessThanOrEqual(2 * PAGE_SIZE);

  // Scroll to the end: every post loads once, no repeats, and the end line
  // shows; the loaded number is the count on the tab.
  const end = page.getByText("Sudah sampai posting terlama.");
  for (let guard = 0; guard < 60 && !(await end.isVisible()); guard += 1) {
    await loadNextPage(page, rows, await rows.count()).catch(() => undefined);
  }
  await expect(end).toBeVisible();
  await expect(rows).toHaveCount(total);

  // A day split across two pages keeps one heading.
  const headings = await page.locator("section > h3").allTextContents();
  expect(new Set(headings).size).toBe(headings.length);
});

test("a filter change clears the list and shows the first page and count for the new filter", async ({
  page,
}) => {
  await page.goto("/publish?view=list&tab=history");
  const rows = page.getByTestId("publish-list-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("checkbox", { name: "Error" }).check();
  await page.keyboard.press("Escape");

  const failedTotal = await apiTotal(
    page,
    "?tab=history&statuses=failed&count=1",
  );
  await expect(page.getByTestId("publish-tab-count-history")).toHaveText(
    String(failedTotal),
    { timeout: 30_000 },
  );
  if (failedTotal === 0) {
    await expect(rows).toHaveCount(0);
    return;
  }
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  await expect(rows).toHaveCount(Math.min(failedTotal, PAGE_SIZE));
  // Only Error cards are left: published cards of the old filter never show.
  await expect(rows.filter({ hasText: "Published" })).toHaveCount(0);

  // Reset brings the full History back from its first page.
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("button", { name: "Reset filter" }).click();
  await page.keyboard.press("Escape");
  const total = await apiTotal(page, "?tab=history&count=1");
  await expect(page.getByTestId("publish-tab-count-history")).toHaveText(
    String(total),
    { timeout: 30_000 },
  );
  await expect(rows).toHaveCount(Math.min(total, PAGE_SIZE));
});

test("a Board column loads its next page as that column is scrolled", async ({
  page,
}) => {
  await page.goto("/publish?view=board");
  const columns = page.locator('section[data-testid^="board-column-"]');
  await expect(columns).toHaveCount(5, { timeout: 30_000 });

  // The busiest column; its count is the true total, not "100+".
  let column: Locator | null = null;
  let columnId: string | null = null;
  let total = 0;
  for (const candidate of await columns.all()) {
    const count = Number(
      await candidate.getByTestId("board-column-count").textContent(),
    );
    if (count > total) {
      total = count;
      column = candidate;
      columnId = await candidate.getAttribute("data-testid");
    }
  }
  test.skip(
    !column || total <= PAGE_SIZE,
    `No Board column has more than ${PAGE_SIZE} cards here; not yet proven`,
  );
  const target = column as Locator;
  const cards = target.getByTestId("board-card");
  await expect(cards).toHaveCount(PAGE_SIZE);
  await expect(page.getByText("100+")).toHaveCount(0);

  await target
    .locator('[data-slot="infinite-list-footer"]')
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() => cards.count(), { timeout: 30_000 })
    .toBeGreaterThan(PAGE_SIZE);
  // The other columns did not load more.
  for (const other of await columns.all()) {
    if ((await other.getAttribute("data-testid")) === columnId) continue;
    expect(await other.getByTestId("board-card").count()).toBeLessThanOrEqual(
      PAGE_SIZE,
    );
  }
});
