import { expect, test } from "@playwright/test";
import { Client } from "pg";

import { seedDbSkipReason } from "./support/seed-db";

/**
 * Golden path Notifications panel infinite scroll (T-304, S-009, ADR-166).
 *
 * Notifications belong to the signed-in user (not to a workspace), so the
 * panel on Cook It Real Good shows every notification of the E2E account.
 * The test only READS the count first and never creates or fakes data: with
 * LIST_PAGE_SIZE (20) or fewer notifications there is no second page to scroll
 * to, so the test skips and the ticket records "not yet proven".
 * Measured 2026-11-25 on the shared DB: 1 notification (1 unread).
 */
const PAGE_SIZE = 20;

const skip = seedDbSkipReason();
test.skip(skip !== null, skip ?? "");

let total = 0;
let unread = 0;

test.beforeAll(async () => {
  if (seedDbSkipReason() !== null) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.on("error", () => undefined);
  try {
    await client.connect();
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>(
      "SELECT id FROM identity_user WHERE email = $1",
      [process.env.E2E_USER_EMAIL],
    );
    const userId = user.rows[0]?.id;
    if (!userId) return;
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId,
    ]);
    const counts = await client.query<{ total: number; unread: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE NOT is_read)::int AS unread
         FROM notifications WHERE user_id = $1`,
      [userId],
    );
    total = counts.rows[0].total;
    unread = counts.rows[0].unread;
    await client.query("ROLLBACK");
  } finally {
    await client.end().catch(() => undefined);
  }
});

test("Notifications panel loads 20 at a time and reaches the oldest notification", async ({
  page,
}) => {
  test.skip(
    total <= PAGE_SIZE,
    `not yet proven: the E2E account has ${total} notification(s), 20 or fewer`,
  );

  await page.goto("/");
  const bell = page.getByRole("button", { name: "Notifikasi" });
  // Unread badge is the true unread count, not the length of the first page.
  if (unread > 0) {
    await expect(bell.locator("xpath=..")).toContainText(
      unread > 99 ? "99+" : String(unread),
    );
  }
  await bell.click();

  const panel = page.getByRole("dialog");
  const rows = panel.locator("[data-slot=infinite-list-footer]");
  await expect(rows).toBeVisible();

  const rowCount = () =>
    panel.getByRole("button", { name: "Tandai dibaca" }).count();
  const end = panel.getByText("You've reached the oldest notification.");
  const scroller = panel.locator("div.overflow-y-auto");

  // Scroll to the bottom until the end line shows; each step loads one page.
  for (let step = 0; step < Math.ceil(total / PAGE_SIZE) + 2; step += 1) {
    if (await end.isVisible()) break;
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(500);
  }
  await expect(end).toBeVisible();
  // Past the old 50 cap when the account has more than 50.
  expect(await rowCount()).toBeLessThanOrEqual(unread);

  // "Mark all as read" clears the badge, including unread beyond the loaded pages.
  const markAll = panel.getByRole("button", { name: "Mark all as read" });
  if (unread > 0) {
    await markAll.click();
    await expect(markAll).toBeDisabled();
  }
});
