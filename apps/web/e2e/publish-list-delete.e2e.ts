import { expect, test } from "@playwright/test";

import { seedDbSkipReason, withTx } from "./support/seed-db";

/**
 * T-308 (S-009 follow-up): a draft deleted from the Drafts tab leaves the
 * list without a reload, even when Realtime does not deliver the change.
 * The List tab must then drop the card from the revalidated first page, as
 * the Board does. Seeds one draft in the E2E Sandbox workspace with SQL and
 * removes it in `afterAll` if the UI delete did not run.
 */
const CAPTION = `[e2e] t308 delete ${Date.now()}`;

test.skip(Boolean(seedDbSkipReason()), seedDbSkipReason() ?? "");

test.afterAll(async () => {
  await withTx(async (client, { workspaceId }) => {
    await client.query(
      `DELETE FROM "publishing_posts" WHERE "workspace_id" = $1 AND "caption" = $2`,
      [workspaceId, CAPTION],
    );
  });
});

test("a deleted draft leaves the Drafts tab without reload, with Realtime off", async ({
  page,
}) => {
  await withTx(async (client, { workspaceId, actorId }) => {
    await client.query(
      `INSERT INTO "publishing_posts"
         ("id", "workspace_id", "author_id", "caption", "status", "created_via", "created_at", "updated_at")
       VALUES (gen_random_uuid(), $1, $2, $3, 'draft', 'app', now(), now())`,
      [workspaceId, actorId, CAPTION],
    );
  });
  // No Realtime: only the revalidated first page can remove the card.
  await page.routeWebSocket(/realtime/, (ws) => ws.close());
  await page.goto("/publish?view=list&tab=drafts");

  const rows = page.locator('[data-slot="card"]', { hasText: CAPTION });
  await expect(rows).toHaveCount(1, { timeout: 60_000 });
  await rows.first().getByRole("button", { name: "Hapus draft" }).click();
  await page.getByRole("button", { name: "Hapus Draft", exact: true }).click();
  await expect(rows).toHaveCount(0, { timeout: 10_000 });
});
