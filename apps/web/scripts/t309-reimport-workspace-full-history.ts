/**
 * One-off full-history re-import for one workspace (T-309).
 *
 * King Rezi asked (2026-11-26) to re-import every post on every account of
 * one workspace (Cook It Real Good on staging) without the product import
 * limits, to get a thumbnail for every published post. The product limits
 * (ADR-093 point 9: 365-day lookback, 1000 posts per import, one manual
 * Sync Now per workspace per week, 24 h per account) stay as they are; this
 * script goes around them once, for one workspace, by hand.
 *
 * Per account:
 *   1. `importPosts` with `since` 2000-01-01 (full history) and `--limit` (default 1000).
 *   2. Poll the Outstand import job up to 10 minutes. The job runner gives up
 *      after 25 s, which is why the daily Instagram and TikTok syncs fail.
 *   3. `ImportPostsProcessUseCase.process`: new posts are inserted; posts
 *      already stored get their media links refreshed when the first link
 *      changed and they have no thumbnail (T-309 change in
 *      `upsert-imported-posts.ts`), which clears the failed thumbnail attempt.
 *   4. `ClassifyImportedPostTargetsUseCase.classifyBatch` for content format.
 *   5. The watermark moves to now only when the batch was not full.
 * Then the thumbnail queue is filled for each account, also when its import
 * failed or timed out (`import.media`, up to
 * 200 targets per account per run; the job runner on Railway processes it).
 * Run `--thumbnails-only` again after the runner has drained the queue to
 * queue the next 200.
 *
 * Default is a DRY RUN: prints the accounts and the current thumbnail counts,
 * calls nothing and writes nothing.
 *
 *   bun --env-file=.env.local run scripts/t309-reimport-workspace-full-history.ts --workspace=<id>
 *   bun --env-file=.env.local run scripts/t309-reimport-workspace-full-history.ts --workspace=<id> --execute
 *   bun --env-file=.env.local run scripts/t309-reimport-workspace-full-history.ts --workspace=<id> --execute --thumbnails-only
 *
 * `--execute` calls the real Outstand API and writes to the database that
 * `.env.local` points to. Get King Rezi's go-ahead first.
 */
import type { SocialPlatform, UserId } from "@postific/shared";
import {
  ClassifyImportedPostTargetsUseCase,
  ImportPostsProcessUseCase,
} from "@/domains/publishing";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { createEnqueueImportMediaUseCase } from "@/lib/jobs/import-media-composition";
import { withCurrentUser } from "@/lib/prisma/with-current-user";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

const DEFAULT_LIMIT = 1000;
/** Before any of the supported platforms existed: asks Outstand for everything. */
const FULL_HISTORY_SINCE = new Date("2000-01-01T00:00:00.000Z");
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;
const LOG = "[t309-reimport]";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reads as the owner: `publishing_*` rows are behind RLS (ADR-099). */
async function thumbnailCounts(workspaceId: string, userId: UserId) {
  return withCurrentUser(
    userId,
    (tx) => tx.$queryRaw<
      {
        platform: string;
        total: bigint;
        with_thumb: bigint;
        attempted_without: bigint;
        waiting: bigint;
      }[]
    >`
    SELECT ca.platform::text AS platform,
           count(*) AS total,
           count(pt.thumbnail_storage_path) AS with_thumb,
           count(*) FILTER (WHERE pt.thumbnail_storage_path IS NULL AND pt.thumbnail_attempted_at IS NOT NULL) AS attempted_without,
           count(*) FILTER (WHERE pt.thumbnail_storage_path IS NULL AND pt.thumbnail_attempted_at IS NULL) AS waiting
    FROM publishing_post_targets pt
    JOIN publishing_posts p ON p.id = pt.post_id
    JOIN workspace_connected_accounts ca ON ca.id = pt.connected_account_id
    WHERE p.workspace_id = ${workspaceId}::uuid
      AND p.status = 'imported'
      AND p.deleted_at IS NULL
    GROUP BY 1 ORDER BY 1`,
  );
}

async function printCounts(workspaceId: string, userId: UserId, label: string) {
  const rows = await thumbnailCounts(workspaceId, userId);
  console.log(`${LOG} thumbnails ${label}:`);
  for (const row of rows) {
    console.log(
      `  ${row.platform}: ${row.total} imported, ${row.with_thumb} with thumbnail, ${row.waiting} waiting, ${row.attempted_without} tried and failed`,
    );
  }
}

async function main(): Promise<void> {
  const workspaceId = arg("workspace");
  if (!workspaceId) throw new Error("--workspace=<id> is required");
  const limit = Number(arg("limit") ?? DEFAULT_LIMIT);
  const execute = process.argv.includes("--execute");
  const thumbnailsOnly = process.argv.includes("--thumbnails-only");

  const accounts = (
    await workspaceRepository.listAccountsForPeriodicImportSync()
  ).filter((account) => account.workspaceId === workspaceId);

  console.log(
    `${LOG} workspace ${workspaceId}: ${accounts.length} active accounts. ${execute ? "EXECUTE" : "DRY RUN"}${thumbnailsOnly ? " (thumbnails only)" : ""}, limit ${limit}.`,
  );
  for (const account of accounts) {
    console.log(`  ${account.platform} ${account.connectedAccountId}`);
  }
  const firstOwner = accounts[0]
    ? await workspaceRepository.findAccountOwnerByOutstandAccountId(
        accounts[0].outstandAccountId,
      )
    : null;
  if (!firstOwner) throw new Error("no active account with an owner found");
  await printCounts(workspaceId, firstOwner.ownerUserId, "before");
  if (!execute) return;

  const outstand = getOutstandAdapter();
  const processUseCase = new ImportPostsProcessUseCase(publishingRepository);
  const classifyUseCase = new ClassifyImportedPostTargetsUseCase(
    publishingRepository,
    outstand,
  );
  const enqueueImportMedia = createEnqueueImportMediaUseCase();

  for (const account of accounts) {
    const tag = `${account.platform} ${account.connectedAccountId}`;
    try {
      const owner =
        await workspaceRepository.findAccountOwnerByOutstandAccountId(
          account.outstandAccountId,
        );
      if (!owner) {
        console.warn(`${LOG} SKIP ${tag}: no workspace owner found`);
        continue;
      }
      const actingUserId = owner.ownerUserId;

      if (!thumbnailsOnly) {
        const until = new Date();
        // Explicit early `since`: do not rely on Outstand's default window.
        const handle = await outstand.importPosts(account.outstandAccountId, {
          since: FULL_HISTORY_SINCE,
          until,
          limit,
        });
        const startedAt = Date.now();
        let outcome = await outstand.fetchImportJobStatus(
          account.outstandAccountId,
          handle.importJobId,
        );
        while (
          outcome.status === "pending" &&
          Date.now() - startedAt < POLL_TIMEOUT_MS
        ) {
          await sleep(POLL_INTERVAL_MS);
          outcome = await outstand.fetchImportJobStatus(
            account.outstandAccountId,
            handle.importJobId,
          );
        }
        if (outcome.status !== "completed") {
          // Still queue the thumbnails below: targets already waiting may
          // have links that work.
          console.error(
            `${LOG} FAILED import ${tag}: status=${outcome.status} ${outcome.error ?? "(polling timed out)"}`,
          );
        } else {
          const processed = await processUseCase.process({
            workspaceId: account.workspaceId,
            connectedAccountId: account.connectedAccountId,
            platform: account.platform as SocialPlatform,
            posts: outcome.posts,
            actingUserId,
          });
          if (outcome.posts.length > 0) {
            await classifyUseCase.classifyBatch({
              workspaceId: account.workspaceId,
              connectedAccountId: account.connectedAccountId,
              platform: account.platform as SocialPlatform,
              posts: outcome.posts,
              actingUserId,
            });
          }
          // Same truncation rule as the product (`isImportTruncated`, T-143).
          const full = outcome.counts
            ? outcome.counts.imported +
                outcome.counts.skipped +
                outcome.counts.failed >=
              limit
            : outcome.posts.length >= limit;
          if (!full) {
            await workspaceRepository.updateImportWatermark({
              connectedAccountId: account.connectedAccountId,
              lastImportedUntil: until,
              actingUserId,
            });
          }
          console.log(
            `${LOG} OK ${tag}: fetched=${outcome.posts.length} inserted=${processed.insertedCount} existing=${processed.skippedDuplicateCount}${full ? " (batch FULL: rerun with a higher --limit)" : ""}`,
          );
        }
      }

      const queued = await enqueueImportMedia.enqueueForAccount({
        workspaceId: account.workspaceId,
        connectedAccountId: account.connectedAccountId,
        actingUserId,
      });
      console.log(`${LOG} ${tag}: ${queued} thumbnails queued`);
    } catch (error) {
      console.error(
        `${LOG} FAILED ${tag}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  await printCounts(workspaceId, firstOwner.ownerUserId, "after");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`${LOG} fatal:`, error);
    process.exit(1);
  });
